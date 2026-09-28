import { normalizeTranslationErrorMessage, splitPlainText } from '@/lib/translationUtils'
import { altusAI } from '@/lib/ai/client'
import { supabase } from '@/lib/supabase'
import { useMutation } from '@tanstack/react-query'

export type TranslationTargetLanguage =
    | 'en'
    | 'ar'
    | 'fr'
    | 'es'
    | 'de'
    | 'ru'
    | 'tr'
    | 'ur'
    | 'hi'
    | 'bn'
    | 'id'
    | 'tl'

type TranslationSourceLanguage = TranslationTargetLanguage | 'auto'

export const SUPPORTED_TRANSLATION_LANGUAGES: Array<{
    code: TranslationTargetLanguage
    label: string
    direction: 'ltr' | 'rtl'
}> = [
    { code: 'en', label: 'English', direction: 'ltr' },
    { code: 'ar', label: 'العربية (Arabic)', direction: 'rtl' },
    { code: 'ur', label: 'اردو (Urdu)', direction: 'rtl' },
    { code: 'hi', label: 'हिन्दी (Hindi)', direction: 'ltr' },
    { code: 'bn', label: 'বাংলা (Bengali)', direction: 'ltr' },
    { code: 'tl', label: 'Filipino (Tagalog)', direction: 'ltr' },
    { code: 'id', label: 'Bahasa Indonesia', direction: 'ltr' },
    { code: 'fr', label: 'Français (French)', direction: 'ltr' },
    { code: 'es', label: 'Español (Spanish)', direction: 'ltr' },
    { code: 'de', label: 'Deutsch (German)', direction: 'ltr' },
    { code: 'ru', label: 'Русский (Russian)', direction: 'ltr' },
    { code: 'tr', label: 'Türkçe (Turkish)', direction: 'ltr' }
]

export interface TranslationRequest {
    text?: string
    texts?: string[]
    file_url?: string
    file_type?: 'pdf' | 'docx'
    target_lang: TranslationTargetLanguage
    source_lang?: TranslationSourceLanguage
    preserve_format?: boolean
    strict_target_only?: boolean
}

export interface TranslationMeta {
    model_used?: string
    used_fallback?: boolean
    partial_failures?: number
    failed_segments?: number
    total_segments?: number
    translated_segments?: number
}

export interface TranslationResponse {
    translated_text?: string
    translated_texts?: string[]
    extracted_text?: string
    success: boolean
    source_lang: string
    target_lang: string
    cached?: boolean
    error?: string
    meta?: TranslationMeta
}

// In-memory LRU-like cache for ultra-fast instant rendering
const clientTranslationCache = new Map<string, string>()

function getCacheKey(text: string, targetLang: string): string {
    return `${targetLang}:::${text.trim()}`
}

export function useTranslationAI() {
    return useMutation({
        mutationFn: async (request: TranslationRequest): Promise<TranslationResponse> => {
            const {
                text = '',
                texts = [],
                target_lang,
                source_lang = 'auto',
                preserve_format = true,
                strict_target_only = false,
            } = request

            // Semantic chunking if a single long text is passed
            const isSingleLongText = Boolean(text && text.trim().length > 2000 && (!texts || texts.length === 0))
            const rawInputs = isSingleLongText
                ? splitPlainText(text, 2000)
                : text ? [text] : texts

            if (rawInputs.length === 0) {
                return {
                    translated_text: '',
                    translated_texts: [],
                    success: true,
                    source_lang,
                    target_lang,
                }
            }

            // 1. Check in-memory cache first (sub-millisecond instant return)
            const allCached = rawInputs.every(t => clientTranslationCache.has(getCacheKey(t, target_lang)))
            if (allCached) {
                const cachedResults = rawInputs.map(t => clientTranslationCache.get(getCacheKey(t, target_lang)) || t)
                const fullTranslatedText = isSingleLongText ? cachedResults.join('\n\n') : (cachedResults[0] || '')
                return {
                    translated_text: fullTranslatedText,
                    translated_texts: cachedResults,
                    success: true,
                    source_lang,
                    target_lang,
                    cached: true,
                    meta: {
                        model_used: 'client-memory-cache',
                        total_segments: rawInputs.length,
                        translated_segments: rawInputs.length,
                    }
                }
            }

            // 2. Primary: Execute via dedicated ai-translation edge function (Postgres cache + parallel execution)
            try {
                const edgeBody: Record<string, unknown> = {
                    target_lang,
                    source_lang,
                    preserve_format,
                    strict_target_only,
                }
                if (isSingleLongText) {
                    edgeBody.texts = rawInputs
                } else if (text) {
                    edgeBody.text = text
                } else {
                    edgeBody.texts = rawInputs
                }

                const { data, error } = await supabase.functions.invoke<TranslationResponse>('ai-translation', {
                    body: edgeBody,
                })

                if (!error && data && data.success !== false) {
                    const translatedResults = data.translated_texts || (data.translated_text ? [data.translated_text] : [])

                    // Cache in browser memory
                    translatedResults.forEach((trans, idx) => {
                        const original = rawInputs[idx]
                        if (original && trans) {
                            clientTranslationCache.set(getCacheKey(original, target_lang), trans)
                        }
                    })

                    const fullTranslatedText = isSingleLongText && translatedResults.length > 0
                        ? translatedResults.join('\n\n')
                        : (data.translated_text || translatedResults[0] || '')

                    return {
                        ...data,
                        translated_text: fullTranslatedText,
                        translated_texts: translatedResults,
                        meta: {
                            ...data.meta,
                            total_segments: rawInputs.length,
                            translated_segments: translatedResults.length,
                        }
                    }
                }

                if (error) {
                    console.warn('[useTranslationAI] ai-translation edge function returned error, falling back to altusAI:', error)
                }
            } catch (edgeErr) {
                console.warn('[useTranslationAI] ai-translation invocation threw, falling back to altusAI:', edgeErr)
            }

            // 3. Fallback: Execute via client altusAI engine (parallel Groq LPU / cascading providers)
            try {
                const targetLangObj = SUPPORTED_TRANSLATION_LANGUAGES.find(l => l.code === target_lang)
                const targetLangLabel = targetLangObj?.label || target_lang

                let translatedList: string[] = []
                if (rawInputs.length === 1) {
                    const single = await altusAI.translateText(rawInputs[0], target_lang, targetLangLabel)
                    translatedList = [single]
                } else {
                    translatedList = await altusAI.translateBatch(rawInputs, target_lang, targetLangLabel)
                }

                // Cache translated results in memory
                translatedList.forEach((trans, idx) => {
                    const original = rawInputs[idx]
                    if (original && trans) {
                        clientTranslationCache.set(getCacheKey(original, target_lang), trans)
                    }
                })

                const fullTranslatedText = isSingleLongText ? translatedList.join('\n\n') : (translatedList[0] || '')

                return {
                    translated_text: fullTranslatedText,
                    translated_texts: translatedList,
                    success: true,
                    source_lang,
                    target_lang,
                    meta: {
                        model_used: 'altusAI-fallback',
                        used_fallback: true,
                        total_segments: rawInputs.length,
                        translated_segments: translatedList.length,
                    }
                }
            } catch (err) {
                console.error('Translation error:', err)
                const errMsg = err instanceof Error ? err.message : 'Translation service temporarily unavailable'
                throw new Error(normalizeTranslationErrorMessage(errMsg))
            }
        }
    })
}
