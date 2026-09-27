/**
 * "Ask the knowledge base" - a short, cited answer drawn only from the
 * organization's published, indexed SOPs, policies and guides.
 *
 * 1. Retrieval: ranked full-text search (tenant-scoped RPC), then a keyword
 *    ILIKE fallback. Both run as the member, so RLS limits them to what the
 *    member may read. There is NO "top documents" fallback - an unrelated
 *    article must never be presented as the source of an answer.
 * 2. Passages: the paragraphs of each article that best match the question,
 *    not the article's first lines.
 * 3. Answer: the model may only use those passages, must cite them by number,
 *    and must say when they do not cover the question. Citations that point at
 *    no passage are dropped; an answer with no valid citation is not shown.
 */

import { supabase } from '@/lib/supabase'
import { extractSearchKeywords } from '@/lib/ai/rag'
import { BaseAIAgent, type AgentExecutionOptions } from '@/lib/ai/agents/baseAgent'
import type { AgentExecutionResult, AgentRole } from '@/lib/ai/agents/types'

export interface KnowledgePassage {
  articleId: string
  title: string
  contentType: string | null
  text: string
}

export type KnowledgeAnswer =
  | { status: 'answered'; steps: string[]; sources: KnowledgePassage[] }
  | { status: 'not_found'; sources: KnowledgePassage[] }

const MAX_ARTICLES = 5
const PASSAGES_PER_ARTICLE = 2
const PASSAGE_CHARS = 700

const htmlToText = (html: string) =>
  html
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/div)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()

/** Paragraphs of `text` ranked by how many query terms they contain. */
export function bestPassages(text: string, terms: string[], count = PASSAGES_PER_ARTICLE): string[] {
  const paragraphs = text.split('\n').map((p) => p.trim()).filter((p) => p.length > 20)
  const lowered = terms.map((t) => t.toLowerCase())
  const scored = paragraphs
    .map((p, index) => {
      const lp = p.toLowerCase()
      const score = lowered.reduce((n, t) => n + (lp.includes(t) ? 1 : 0), 0)
      return { p, index, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, count)
    .sort((a, b) => a.index - b.index)
  return scored.map((x) => (x.p.length > PASSAGE_CHARS ? `${x.p.slice(0, PASSAGE_CHARS)}…` : x.p))
}

interface DocRow { id: string; title: string; title_ar: string | null; content_type: string | null; content: string | null; content_ar: string | null; description: string | null }

export async function findKnowledgePassages(question: string, organizationId: string | null, isArabic: boolean): Promise<KnowledgePassage[]> {
  const terms = extractSearchKeywords(question)
  const words = terms.length > 0 ? terms : question.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  if (words.length === 0) return []

  let ids: string[] = []
  const { data: ranked } = await supabase.rpc('search_knowledge_articles', {
    p_query: words.join(' OR '),
    p_content_type: null,
    p_status: 'PUBLISHED',
    p_department_id: null,
    p_limit: MAX_ARTICLES,
    p_offset: 0,
    p_organization_id: organizationId,
  })
  ids = ((ranked ?? []) as { id: string }[]).map((r) => r.id)

  const select = 'id, title, title_ar, content_type, content, content_ar, description'
  const base = () => supabase
    .from('documents')
    .select(select)
    .eq('status', 'PUBLISHED')
    .eq('knowledge_base_status', 'indexed')
    .eq('is_active_kb_version', true)
    .eq('is_deleted', false)

  let rows: DocRow[] = []
  if (ids.length > 0) {
    const { data } = await base().in('id', ids)
    rows = ((data ?? []) as DocRow[]).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
  } else {
    const safe = words.map((w) => w.replace(/[%,()]/g, '')).filter(Boolean)
    if (safe.length === 0) return []
    const or = safe.map((w) => `title.ilike.%${w}%,content.ilike.%${w}%,content_ar.ilike.%${w}%`).join(',')
    const { data } = await base().or(or).limit(MAX_ARTICLES)
    rows = (data ?? []) as DocRow[]
  }

  const passages: KnowledgePassage[] = []
  for (const row of rows) {
    const body = htmlToText((isArabic && row.content_ar) || row.content || row.content_ar || row.description || '')
    for (const text of bestPassages(body, words)) {
      passages.push({ articleId: row.id, title: (isArabic && row.title_ar) || row.title, contentType: row.content_type, text })
    }
  }
  return passages.slice(0, MAX_ARTICLES * PASSAGES_PER_ARTICLE)
}

interface AnswerInput { question: string; passages: KnowledgePassage[]; isArabic: boolean }
interface AnswerOutput { found: boolean; steps: { text: string; sources: number[] }[] }

class KnowledgeAnswerAgent extends BaseAIAgent<AnswerInput, AnswerOutput> {
  public readonly role: AgentRole = 'knowledge'
  public readonly name = 'Knowledge Base Answer'
  public readonly nameAr = 'إجابة قاعدة المعرفة'
  public readonly defaultSystemPrompt =
    'You answer hotel staff questions using ONLY the numbered passages from their own organization\'s published SOPs and policies. ' +
    'Never use outside knowledge, never invent times, amounts, phone numbers, names or rules. ' +
    'If the passages do not answer the question, say so by returning found=false.'

  public async process(input: AnswerInput, options: AgentExecutionOptions = {}): Promise<AgentExecutionResult<AnswerOutput>> {
    const numbered = input.passages.map((p, i) => `[${i + 1}] (${p.title})\n${p.text}`).join('\n\n')
    const prompt = `Question: ${input.question}

Passages:
${numbered}

Reply in ${input.isArabic ? 'Arabic' : 'English'} with ONLY this JSON:
{"found": true|false, "steps": [{"text": "one short actionable step or fact", "sources": [passage numbers used]}]}
Rules: 2-6 steps, in the order staff should act. Every step must cite at least one passage number it came from. If the passages do not answer the question, return {"found": false, "steps": []}.`
    return this.executePrompt<AnswerOutput>(prompt, { ...options, jsonMode: true, temperature: 0.1, silent: true })
  }
}

const answerAgent = new KnowledgeAnswerAgent()

/**
 * Unanswered questions feed the knowledge team's "searched but not found"
 * report (get_knowledge_analytics_zero_result_searches). The organization is
 * filled in from the member by the search_logs trigger. Best-effort only.
 */
function logUnanswered(question: string) {
  void supabase.auth.getUser()
    .then(({ data }) => supabase.from('search_logs').insert({ user_id: data.user?.id ?? null, query: question.slice(0, 300), result_count: 0 }))
    .catch(() => undefined)
}

export async function answerFromKnowledge(question: string, organizationId: string | null, isArabic: boolean): Promise<KnowledgeAnswer> {
  const passages = await findKnowledgePassages(question, organizationId, isArabic)
  if (passages.length === 0) {
    logUnanswered(question)
    return { status: 'not_found', sources: [] }
  }

  const result = await answerAgent.process({ question, passages, isArabic })
  const data = result.data
  const steps = (data?.found ? data.steps ?? [] : [])
    .map((s) => ({
      text: typeof s?.text === 'string' ? s.text.trim() : '',
      sources: (Array.isArray(s?.sources) ? s.sources : []).filter((n) => Number.isInteger(n) && n >= 1 && n <= passages.length),
    }))
    .filter((s) => s.text && s.sources.length > 0)

  if (steps.length === 0) {
    logUnanswered(question)
    return { status: 'not_found', sources: passages }
  }

  const used = [...new Set(steps.flatMap((s) => s.sources))].sort((a, b) => a - b)
  const sources = used.map((n) => passages[n - 1])
  // Renumber citations to the order sources are listed in.
  const renumber = new Map(used.map((n, i) => [n, i + 1]))
  return {
    status: 'answered',
    steps: steps.map((s) => `${s.text} ${s.sources.map((n) => `[${renumber.get(n)}]`).join('')}`),
    sources,
  }
}
