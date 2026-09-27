import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { COVERS, TOPIC_RULES, coverFor, coverUrl } from './covers'

describe('course covers', () => {
  it('matches the topic in English and Arabic', () => {
    expect(['emergency-exit', 'security-cctv']).toContain(coverFor({ id: 'a', title: 'Fire Safety Basics' }))
    expect(['emergency-exit', 'security-cctv']).toContain(coverFor({ id: 'b', title: 'مساعدة النزلاء في حالات الاخلاء و الطوارئ' }))
    expect(coverFor({ id: 'd', title: 'الرد على الهاتف' })).toBe('telephone')
    expect(coverFor({ id: 'e', title: 'خدمة ذوي الهمم' })).toBe('accessibility')
    expect(coverFor({ id: 'f', title: 'خدمة كبار السن' })).toBe('elderly-guests')
    expect(coverFor({ id: 'g', title: 'التعامل مع النزيل المريض او المصاب' })).toBe('first-aid')
    expect(coverFor({ id: 'h', title: 'المفقودات و الاشياء الثمينة' })).toBe('lost-valuables')
    expect(['work-stress', 'wellbeing']).toContain(coverFor({ id: 'i', title: 'التعامل مع ضغوطات العمل' }))
  })

  it('matches specific topics before broad ones', () => {
    // "lost child" must not fall into the generic guest-service pool
    expect(coverFor({ id: 'j', title: 'حالة الطفل التائه او الشخص المفقود' })).toBe('family-travel')
    // A complaint course is a complaint course even though it mentions guests
    expect(['service-counter', 'guest-conversation']).toContain(coverFor({ id: 'k', title: 'معالجة الشكاوى واستعادة ثقة الضيوف' }))
  })

  it('is deterministic and falls back to a neutral hospitality pool', () => {
    const one = coverFor({ id: '11111111-1111-1111-1111-111111111111', title: 'zzz' })
    expect(coverFor({ id: '11111111-1111-1111-1111-111111111111', title: 'zzz' })).toBe(one)
    expect(['hotel-lobby', 'front-desk', 'guest-conversation', 'training-session']).toContain(one)
  })

  it('rotates sibling courses within a topic pool', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 12; i++) seen.add(coverFor({ id: `svc-${i}`, title: 'Guest service basics' }))
    expect(seen.size).toBeGreaterThan(1)
  })

  it('only references photos that exist in the library', () => {
    const referenced = new Set<string>([...COVERS, ...TOPIC_RULES.flatMap((r) => r.pool)])
    for (const name of referenced) {
      expect(COVERS as readonly string[]).toContain(name)
      expect(existsSync(resolve(__dirname, '../../../../public/assets/photos', `${name}.webp`))).toBe(true)
    }
  })

  it('respects an explicit cover_image_url', () => {
    const customUrl = 'https://example.com/covers/custom.webp'
    expect(coverUrl({ id: 'custom-1', title: 'Any Title', cover_image_url: customUrl })).toBe(customUrl)
  })

  it('builds the library URL for mapped covers', () => {
    expect(coverUrl({ id: 'x', title: 'الرد على الهاتف' })).toBe('/assets/photos/telephone.webp')
  })
})
