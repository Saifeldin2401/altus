import { describe, expect, it } from 'vitest'
import enKnowledge from '@/i18n/locales/en/knowledge.json'
import arKnowledge from '@/i18n/locales/ar/knowledge.json'

describe('Editor & Author Inspector Translations', () => {
  it('provides bilingual translations for editor.general_department', () => {
    expect(enKnowledge.editor.general_department).toBe('All departments')
    expect(arKnowledge.editor.general_department).toBe('جميع الأقسام')
  })

  it('provides bilingual translations for main team and authoring controls', () => {
    expect(enKnowledge.editor.main_team_topic).toBe('Department / Team')
    expect(arKnowledge.editor.main_team_topic).toBe('القسم / الفريق')

    expect(enKnowledge.editor.select_department).toBe('Select main team...')
    expect(arKnowledge.editor.select_department).toBe('اختر الفريق الرئيسي...')

    expect(enKnowledge.editor.category_optional).toBe('Sub-Category (Optional)')
    expect(arKnowledge.editor.category_optional).toBe('الفئة الفرعية (اختياري)')
  })

  it('provides bilingual translations for Master Studio and Brand Discipline controls', () => {
    expect(enKnowledge.editor.master_studio).toBe('Master Studio')
    expect(arKnowledge.editor.master_studio).toBe('استوديو المعايير الرئيسية')

    expect(enKnowledge.editor.property_studio).toBe('Property Studio')
    expect(arKnowledge.editor.property_studio).toBe('استوديو إجراءات الفندق')

    expect(enKnowledge.editor.master_studio_mode).toBe('Master Studio Mode')
    expect(arKnowledge.editor.master_studio_mode).toBe('وضع استوديو المعايير الموحدة')

    expect(enKnowledge.editor.brand_classification_title).toBe('Brand Discipline & Classification')
    expect(arKnowledge.editor.brand_classification_title).toBe('التخصص التشغيلي والتصنيف المؤسسي')

    expect(enKnowledge.editor.target_discipline).toBe('Target Operational Discipline')
    expect(arKnowledge.editor.target_discipline).toBe('التخصص التشغيلي المستهدف')

    expect(enKnowledge.editor.all_departments_brand).toBe('All Departments (General Brand Standard)')
    expect(arKnowledge.editor.all_departments_brand).toBe('جميع الأقسام (معيار عام للعلامة التجارية)')

    expect(enKnowledge.editor.visibility.master_all_properties).toBe('All Hotel Properties (Chain-Wide)')
    expect(arKnowledge.editor.visibility.master_all_properties).toBe('كافة فنادق السلسلة (معيار موحد)')
  })
})
