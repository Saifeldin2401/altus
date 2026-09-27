/**
 * Universal Knowledge Article & SOP Multi-Agent Orchestrator
 * 
 * Coordinates the full multi-agent lifecycle for Knowledge Base creation:
 * Request → Research Agent + RAG Grounding → Specialized Content Agent (SOP/Policy/Checklist/FAQ/QuickRef) → Recraft Vector Visual Schematics → Compliance Shield → Unified Output
 */

import { researchAgent } from '../researchAgent'
import { knowledgeAgent } from '../knowledgeAgent'
import { imageAgent } from '../imageAgent'
import { complianceShield } from '@/lib/ai/complianceShield'
import { extractJsonFromText } from '@/lib/ai/client'
import { sopWriterAgent } from './sopWriterAgent'
import { policyArchitectAgent } from './policyArchitectAgent'
import { checklistArchitectAgent } from './checklistArchitectAgent'
import { faqArchitectAgent } from './faqArchitectAgent'
import { quickRefArchitectAgent } from './quickRefArchitectAgent'
import type { CourseVisualAsset } from '@/types/aiCourseEngine'
import type { ModelProvider } from '../types'
import type {
  GeneratedKnowledgeArticle,
  KnowledgeArticleGenerationConfig,
  KnowledgePipelineEventListener,
} from './types'

class KnowledgeArticleOrchestrator {
  private static instance: KnowledgeArticleOrchestrator

  private constructor() {}

  public static getInstance(): KnowledgeArticleOrchestrator {
    if (!KnowledgeArticleOrchestrator.instance) {
      KnowledgeArticleOrchestrator.instance = new KnowledgeArticleOrchestrator()
    }
    return KnowledgeArticleOrchestrator.instance
  }

  /**
   * Orchestrate full multi-agent generation of an authentic 5-star hotel knowledge base document
   */
  public async orchestrate(
    config: KnowledgeArticleGenerationConfig,
    onProgress?: KnowledgePipelineEventListener
  ): Promise<GeneratedKnowledgeArticle> {
    const startTime = Date.now()
    const pipelineRunId = `kb-pipe-${Date.now()}`
    const modelsUsedSet = new Set<string>()

    const emit = (
      phase: 'discovery' | 'synthesis' | 'visuals' | 'translation' | 'qa_compliance' | 'completed',
      agentName: string,
      agentNameAr: string,
      progressPercentage: number,
      detail: string,
      detailAr: string,
      modelUsed?: string
    ) => {
      if (modelUsed) modelsUsedSet.add(modelUsed)
      if (onProgress) {
        onProgress({
          pipelineRunId,
          phase,
          agentName,
          agentNameAr,
          progressPercentage,
          detail,
          detailAr,
          modelUsed,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // ========================================================================
    // 1. DISCOVERY & RAG GROUNDING
    // ========================================================================
    emit(
      'discovery',
      'Research & RAG Grounding Agent',
      'وكيل البحث واسترجاع المعايير',
      15,
      'Researching international luxury service standards and retrieving grounded hotel documents...',
      'البحث عن معايير الخدمة العالمية واسترجاع وثائق الفندق المرجعية...'
    )

    const [researchResult, knowledgeResult] = await Promise.all([
      researchAgent
        .process({
          topic: config.title,
          department: config.department,
          targetAudience: config.targetAudience,
          rawSourceMaterial: config.sourceDocumentText,
        }, { preferredModel: config.preferredModel })
        .catch(() => ({ data: undefined, modelUsed: 'Auto Router' })),
      knowledgeAgent
        .process({
          query: `${config.title} ${config.department || ''} standard`,
          limit: 3,
        })
        .catch(() => ({ data: undefined, modelUsed: 'PostgreSQL RAG' })),
    ])

    if (researchResult.modelUsed) modelsUsedSet.add(researchResult.modelUsed)

    const enrichedConfig: KnowledgeArticleGenerationConfig = {
      ...config,
      sourceDocumentText: [
        config.sourceDocumentText || '',
        researchResult.data?.keyOperationalStandards?.join('\n') || '',
        knowledgeResult.data?.keyProceduresExtracted?.join('\n') || '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    }

    emit(
      'discovery',
      'Research & RAG Grounding Agent',
      'وكيل البحث واسترجاع المعايير',
      30,
      `[Model: ${researchResult.modelUsed || 'Auto Router'}] Grounded ${knowledgeResult.data?.relevantArticles?.length || 0} reference docs & ${researchResult.data?.serviceBenchmarks?.length || 0} service benchmarks`,
      `تم استرجاع ${knowledgeResult.data?.relevantArticles?.length || 0} وثيقة مرجعية و ${researchResult.data?.serviceBenchmarks?.length || 0} معايير الخدمة العالمية`,
      researchResult.modelUsed
    )

    // ========================================================================
    // 2. SPECIALIZED CONTENT AGENT SYNTHESIS
    // ========================================================================
    emit(
      'synthesis',
      'Specialized Content Architect Agent',
      'وكيل الصياغة التخصصية',
      45,
      `Synthesizing ${config.contentType.toUpperCase()} operational structure in English and Arabic...`,
      `صياغة وثيقة ${config.contentType.toUpperCase()} باللغتين العربية والإنجليزية...`
    )

    // ========================================================================
    // 2. DISPATCH TO SPECIALIZED CONTENT ARCHITECT AGENT
    // ========================================================================
    emit(
      'synthesis',
      'Specialized Content Architect Agent',
      'وكيل الصياغة التخصصية',
      40,
      `[Model: ${config.preferredModel || 'auto'}] Synthesizing comprehensive ${config.contentType.toUpperCase()} standard with 5-star depth...`,
      `صياغة معايير المحتوى بدقة وجودة 5 نجوم...`,
      config.preferredModel || 'auto'
    )

    let rawAgentResult: any = null
    let modelUsed = 'gemini-2.5-flash'
    let providerUsed: ModelProvider | undefined = 'gemini'

    switch (config.contentType) {
      case 'policy': {
        const res = await policyArchitectAgent.process(enrichedConfig, {
          preferredModel: config.preferredModel,
        })
        rawAgentResult = res.data
        modelUsed = res.modelUsed
        providerUsed = res.providerUsed
        break
      }

      case 'checklist': {
        const res = await checklistArchitectAgent.process(enrichedConfig, {
          preferredModel: config.preferredModel,
        })
        rawAgentResult = res.data
        modelUsed = res.modelUsed
        providerUsed = res.providerUsed
        break
      }

      case 'faq': {
        const res = await faqArchitectAgent.process(enrichedConfig, {
          preferredModel: config.preferredModel,
        })
        rawAgentResult = res.data
        modelUsed = res.modelUsed
        providerUsed = res.providerUsed
        break
      }

      // Reference cards and how-to guides use the quick-reference architect.
      case 'reference':
      case 'guide': {
        const res = await quickRefArchitectAgent.process(enrichedConfig, {
          preferredModel: config.preferredModel,
        })
        rawAgentResult = res.data
        modelUsed = res.modelUsed
        providerUsed = res.providerUsed
        break
      }

      case 'sop':
      default: {
        const res = await sopWriterAgent.process(enrichedConfig, {
          preferredModel: config.preferredModel,
        })
        rawAgentResult = res.data
        modelUsed = res.modelUsed
        providerUsed = res.providerUsed
        break
      }
    }

    modelsUsedSet.add(modelUsed)

    // Normalize all output fields with bulletproof fallbacks
    const normalized = this.normalizeAgentOutput(rawAgentResult, config)

    emit(
      'synthesis',
      'Specialized Content Architect Agent',
      'وكيل الصياغة التخصصية',
      70,
      `[Model: ${modelUsed}] Completed ${config.contentType.toUpperCase()} synthesis with ${normalized.read_time}m reading depth`,
      `تم إنجاز صياغة المحتوى بنجاح بدقة قراءة ${normalized.read_time} دقائق`,
      modelUsed
    )

    // ========================================================================
    // 3. RECRAFT VECTOR SCHEMATIC ENGINE (AI Visuals)
    // ========================================================================
    let visualAsset: CourseVisualAsset | undefined = undefined

    if (config.enableVectorSchematic !== false) {
      const chosenImageModel = config.imageModel || 'google-imagen-3'
      emit(
        'visuals',
        'Creative Visual Director AI',
        'وكيل الوسائط البصرية والتصميم الذكي',
        80,
        `[Model: ${chosenImageModel}] Synthesizing 5-star operational visual asset...`,
        `توليد الوسائط البصرية وسير العمليات التوضيحي...`,
        chosenImageModel
      )

      try {
        const imgResult = await imageAgent.process(
          {
            lesson: {
              id: `kb-doc-${Date.now()}`,
              title: normalized.title,
              description: [normalized.description, config.customVisualPrompt].filter(Boolean).join(' - '),
              learningOutcomes: [normalized.summary],
            } as any,
            courseTitle: `Knowledge Base • ${config.department || 'Operations'}`,
            moduleTitle: normalized.title,
            imageModel: chosenImageModel,
            preferredStyle: config.visualStyle || 'technical_diagram',
            preferredAspectRatio: config.aspectRatio || '16:9',
            costTierPreference: 'free_first',
          },
          { pipelineRunId, phase: 'multimedia_generation', silent: true }
        )

        if (imgResult.data) {
          visualAsset = imgResult.data
          modelsUsedSet.add(imgResult.modelUsed || chosenImageModel)
        }
      } catch (err) {
        console.warn('[KnowledgeOrchestrator] Visual agent notice:', err)
      }
    }

    // ========================================================================
    // 4. QA & REGULATORY COMPLIANCE AUDITING
    // ========================================================================
    emit(
      'qa_compliance',
      'KSA Regulatory Compliance Shield',
      'درع الامتثال للأنظمة السعودية',
      90,
      'Auditing document against Saudi Ministry of Tourism, Balady, and Civil Defense mandates...',
      'مطابقة الوثيقة مع لوائح وزارة السياحة والبلدية والدفاع المدني...'
    )

    // Wrap the generated article in the section shape the compliance shield audits.
    const articleAuditSection = [
      {
        id: 'sec-1',
        title: normalized.title,
        description: normalized.description,
        order: 0,
        items: [
          {
            id: 'item-1',
            type: 'text' as const,
            title: normalized.title,
            content: normalized.content_html,
            order: 0,
          },
        ],
      },
    ]

    const complianceReport = complianceShield.auditModule(articleAuditSection)
    const complianceScore = complianceReport.score
    const complianceNotes = complianceReport.findings.map((f) => `[${f.authorityName}] ${f.title}`)

    // ========================================================================
    // 5. COMPLETED & PACKAGED
    // ========================================================================
    const totalDurationMs = Date.now() - startTime
    const allModelsUsed = Array.from(modelsUsedSet)

    emit(
      'completed',
      'Knowledge Base Orchestrator',
      'المنسق العام لقواعد المعرفة',
      100,
      `Document successfully created in ${(totalDurationMs / 1000).toFixed(1)}s with ${complianceScore}/100 compliance score.`,
      `تم إنجاز الوثيقة بنجاح خلال ${(totalDurationMs / 1000).toFixed(1)} ثانية وبدرجة امتثال ${complianceScore}/100.`,
      allModelsUsed.join(', ')
    )

    return {
      title: normalized.title,
      title_ar: normalized.title_ar,
      description: normalized.description,
      description_ar: normalized.description_ar,
      summary: normalized.summary,
      summary_ar: normalized.summary_ar,
      content_html: normalized.content_html,
      content_html_ar: normalized.content_html_ar,
      content_type: config.contentType,
      sop_code: normalized.sop_code,
      estimated_read_time_minutes: normalized.read_time,
      suggested_tags: normalized.tags,
      checklist_items: normalized.checklist_items,
      faq_items: normalized.faq_items,
      critical_control_points: normalized.critical_control_points,
      service_benchmarks: normalized.service_benchmarks,
      contingency_protocols: normalized.contingency_protocols,
      visual_asset: visualAsset,
      compliance_score: complianceScore,
      compliance_notes: complianceNotes,
      models_used: allModelsUsed,
      model_used: modelUsed,
      provider_used: providerUsed,
      cost_tier: 'free',
      total_duration_ms: totalDurationMs,
    }
  }

  /**
   * Robust output normalizer across different model output formats
   */
  private normalizeAgentOutput(
    raw: any,
    fallbackConfig: KnowledgeArticleGenerationConfig
  ) {
    let data = raw
    if (typeof data === 'string') {
      const extracted = extractJsonFromText(data)
      if (extracted && typeof extracted === 'object') {
        data = extracted
      }
    }

    const str = (...values: unknown[]): string => {
      for (const v of values) if (typeof v === 'string' && v.trim()) return v.trim()
      return ''
    }
    const list = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : []

    // Only what the model actually returned. Nothing here is invented: a
    // missing field stays empty so the author sees exactly what the AI wrote.
    const content_html = str(data?.contentHtml, data?.content_html, data?.content)
    if (!content_html) {
      throw new Error('The AI did not return any article text. Nothing was created - try again, or add source material for it to work from.')
    }

    const title = str(data?.title) || fallbackConfig.title
    const title_ar = str(data?.titleAr, data?.title_ar)
    const description = str(data?.description, data?.desc)
    const description_ar = str(data?.descriptionAr, data?.description_ar)
    const summary = str(data?.summary, data?.executive_summary)
    const summary_ar = str(data?.summaryAr, data?.summary_ar)
    const content_html_ar = str(data?.contentHtmlAr, data?.content_html_ar, data?.content_ar)

    const rawChecklist = data?.checklistItems || data?.checklist_items || []
    const checklist_items = (Array.isArray(rawChecklist) ? rawChecklist : [])
      .filter((c: any) => str(c?.text, c?.name))
      .map((c: any, i: number) => ({
        id: c.id || `chk-${i + 1}`,
        text: str(c.text, c.name),
        text_ar: str(c.text_ar, c.textAr, c.name_ar),
        category: str(c.category),
        required: c.required !== false,
        standardBenchmark: str(c.standardBenchmark, c.standard_benchmark),
        responsibleRole: str(c.responsibleRole, c.responsible_role),
      }))

    const rawFaq = data?.faqItems || data?.faq_items || []
    const faq_items = (Array.isArray(rawFaq) ? rawFaq : [])
      .filter((f: any) => str(f?.question) && str(f?.answer))
      .map((f: any, i: number) => ({
        id: f.id || `faq-${i + 1}`,
        question: str(f.question),
        question_ar: str(f.question_ar, f.questionAr),
        answer: str(f.answer),
        answer_ar: str(f.answer_ar, f.answerAr),
        category: str(f.category),
        escalationPoint: str(f.escalationPoint, f.escalation_point),
      }))

    return {
      title,
      title_ar,
      description,
      description_ar,
      summary,
      summary_ar,
      content_html,
      content_html_ar,
      sop_code: str(data?.sopCode, data?.sop_code, data?.policyCode, data?.policy_code, data?.code),
      read_time: Number(data?.estimatedReadTimeMinutes || data?.estimated_read_time_minutes) || Math.max(1, Math.round(content_html.replace(/<[^>]+>/g, ' ').split(/\s+/).length / 200)),
      tags: list(data?.suggestedTags ?? data?.suggested_tags),
      checklist_items,
      faq_items,
      critical_control_points: list(data?.criticalControlPoints ?? data?.critical_control_points),
      service_benchmarks: list(data?.serviceBenchmarks ?? data?.service_benchmarks),
      contingency_protocols: list(data?.contingencyProtocols ?? data?.contingency_protocols),
    }
  }
}

export const knowledgeArticleOrchestrator = KnowledgeArticleOrchestrator.getInstance()
