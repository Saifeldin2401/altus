/**
 * Course and article cover art.
 *
 * Courses usually have no uploaded image, so each gets a photograph from the
 * Altus photo library (public/assets/photos, Unsplash License) chosen by what
 * it is about: English and Arabic keywords in the title and description first,
 * then the course category. Each topic maps to a small pool and siblings
 * rotate deterministically through it (hash of the id), so a row of courses on
 * the same topic does not repeat one photo - while never picking an unrelated
 * image. An uploaded cover_image_url always wins.
 */

export const COVERS = [
  'front-desk', 'hotel-lobby', 'concierge-desk', 'telephone', 'housekeeping', 'guest-room',
  'restaurant-service', 'chef-kitchen', 'arabic-coffee', 'saudi-hospitality', 'guest-conversation',
  'service-counter', 'team-meeting', 'training-session', 'handshake', 'family-travel', 'elderly-guests',
  'accessibility', 'diverse-guests', 'security-cctv', 'emergency-exit', 'first-aid', 'wellbeing',
  'work-stress', 'luggage', 'lost-valuables', 'checklist', 'certificate', 'mobile-learning',
] as const

export type CoverName = (typeof COVERS)[number]

export interface CourseCoverTarget {
  id: string
  title?: string | null
  category?: string | null
  description?: string | null
  cover_image_url?: string | null
}

/**
 * Topic rules, most specific first. The first rule whose words appear in the
 * title/description decides the pool. Arabic words cover the Arabic course
 * titles actually in the catalog (e.g. "التعامل مع النزيل غير الراضي").
 */
export const TOPIC_RULES: { topic: string; pool: readonly CoverName[]; words: string[] }[] = [
  { topic: 'emergency', pool: ['emergency-exit', 'security-cctv'], words: ['evacuat', 'emergency', 'fire', 'إخلاء', 'اخلاء', 'طوارئ', 'حريق'] },
  { topic: 'medical', pool: ['first-aid'], words: ['first aid', 'sick', 'injur', 'medical', 'المريض', 'المصاب', 'إسعاف', 'اسعاف'] },
  { topic: 'missing-person', pool: ['family-travel'], words: ['lost child', 'missing person', 'التائه', 'الشخص المفقود'] },
  { topic: 'lost-property', pool: ['lost-valuables'], words: ['lost and found', 'lost & found', 'valuables', 'lost property', 'المفقودات', 'الثمينة'] },
  { topic: 'security', pool: ['security-cctv'], words: ['security', 'suspici', 'surveillance', 'safety', 'أمن', 'امن', 'الاشتباه', 'سلامة'] },
  { topic: 'accessibility', pool: ['accessibility'], words: ['disabilit', 'wheelchair', 'accessib', 'people of determination', 'ذوي الهمم', 'الإعاقة', 'الاعاقة'] },
  { topic: 'elderly', pool: ['elderly-guests'], words: ['elderly', 'senior', 'كبار السن', 'المسنين'] },
  { topic: 'children', pool: ['family-travel'], words: ['child', 'kids', 'family', 'الاطفال', 'الأطفال', 'العائلات', 'طفل'] },
  { topic: 'culture', pool: ['diverse-guests', 'saudi-hospitality'], words: ['culture', 'cultural', 'language', 'diversity', 'الثقافات', 'اللغة', 'ثقافة'] },
  { topic: 'saudi', pool: ['saudi-hospitality', 'arabic-coffee'], words: ['hafawah', 'karam', 'saudi', 'arabic coffee', 'dallah', 'حفاوة', 'كرم', 'القهوة العربية', 'السعودية', 'مرحبا'] },
  { topic: 'telephone', pool: ['telephone'], words: ['telephone', 'phone', 'call handling', 'switchboard', 'الهاتف', 'هاتف', 'مكالمات'] },
  { topic: 'stress', pool: ['work-stress', 'wellbeing'], words: ['stress', 'burnout', 'pressure', 'ضغوطات', 'ضغط', 'الإجهاد'] },
  { topic: 'wellbeing', pool: ['wellbeing'], words: ['wellbeing', 'well-being', 'wellness', 'self-care', 'work-life', 'balance', 'spa', 'اعتني بنفسك', 'إعتني بنفسك', 'الرفاهية', 'التوازن', 'الصحة'] },
  { topic: 'complaints', pool: ['service-counter', 'guest-conversation'], words: ['complaint', 'dissatisf', 'apolog', 'service recovery', 'unreasonable', 'الشكاوى', 'غير الراضي', 'الاعتذار', 'اللا معقولة', 'استعادة ثقة'] },
  { topic: 'emotions', pool: ['guest-conversation', 'service-counter'], words: ['angry', 'impatient', 'anxious', 'empathy', 'listening', 'الغاضب', 'غير الصبور', 'القلق', 'التعاطف', 'الاستماع'] },
  { topic: 'communication', pool: ['guest-conversation', 'handshake', 'team-meeting'], words: ['communicat', 'body language', 'courtes', 'etiquette', 'التواصل', 'لغة الجسد', 'المجاملات', 'تكييف'] },
  { topic: 'teamwork', pool: ['team-meeting', 'checklist'], words: ['team', 'interdepart', 'priorit', 'responsib', 'الاقسام', 'الأقسام', 'الاولويات', 'الأولويات', 'المسؤولية', 'فريق'] },
  { topic: 'presence', pool: ['handshake', 'front-desk'], words: ['confidence', 'deportment', 'grooming', 'presence', 'impression', 'الثقة بالنفس', 'الوقار', 'الحضور المهني', 'الانطباع'] },
  { topic: 'requests', pool: ['concierge-desk', 'front-desk'], words: ['guest request', 'alternative', 'follow up', 'concierge', 'طلبات', 'البدائل', 'نتابع'] },
  { topic: 'anticipation', pool: ['restaurant-service', 'concierge-desk'], words: ['anticipat', 'proactive', 'initiative', 'الاستباقية', 'المبادرة'] },
  { topic: 'vip', pool: ['guest-room', 'hotel-lobby'], words: ['vip', 'repeat guest', 'loyal', 'butler', 'suite', 'المهمين', 'متكرري', 'كبار الشخصيات'] },
  { topic: 'female-guests', pool: ['front-desk'], words: ['women guests', 'female guests', 'النزيلات'] },
  { topic: 'outage', pool: ['front-desk', 'service-counter'], words: ['outage', 'disruption', 'تعطل'] },
  { topic: 'housekeeping', pool: ['housekeeping', 'guest-room'], words: ['housekeeping', 'room cleaning', 'laundry', 'linen', 'turndown', 'inventory', 'تدبير', 'تنظيف', 'الغرف', 'بياضات'] },
  { topic: 'kitchen', pool: ['chef-kitchen'], words: ['chef', 'kitchen', 'cook', 'culinary', 'haccp', 'food safety', 'مطبخ', 'طهي', 'شيف', 'سلامة الغذاء'] },
  { topic: 'dining', pool: ['restaurant-service', 'arabic-coffee'], words: ['food', 'beverage', 'f&b', 'restaurant', 'dining', 'waiter', 'coffee', 'tea', 'مطعم', 'طعام', 'مشروبات', 'قهوة', 'شاي'] },
  { topic: 'luggage', pool: ['luggage'], words: ['luggage', 'bell', 'porter', 'حقائب', 'أمتعة', 'الامتعة'] },
  { topic: 'front-office', pool: ['front-desk', 'concierge-desk', 'hotel-lobby'], words: ['front office', 'front desk', 'reception', 'check-in', 'check in', 'checkout', 'arrival', 'استقبال', 'تسجيل'] },
  { topic: 'compliance', pool: ['checklist', 'certificate'], words: ['compliance', 'sop', 'policy', 'audit', 'standard', 'procedure', 'امتثال', 'معايير', 'إجراءات', 'اجراءات', 'سياسات', 'تدقيق'] },
  { topic: 'learning', pool: ['training-session', 'mobile-learning'], words: ['training', 'onboarding', 'induction', 'masterclass', 'master class', 'تدريب', 'تهيئة'] },
  { topic: 'service', pool: ['front-desk', 'guest-conversation', 'hotel-lobby', 'restaurant-service'], words: ['guest', 'service', 'hospitality', 'welcome', 'نزيل', 'ضيف', 'الضيوف', 'خدمة', 'ضيافة'] },
]

/** When nothing in the text matches: the course category, then a neutral hospitality pool. */
const CATEGORY_POOLS: { match: string[]; pool: readonly CoverName[] }[] = [
  { match: ['food', 'f&b', 'culinary', 'dining'], pool: ['restaurant-service', 'chef-kitchen'] },
  { match: ['front', 'reception'], pool: ['front-desk', 'concierge-desk'] },
  { match: ['housekeep', 'room', 'laundry'], pool: ['housekeeping', 'guest-room'] },
  { match: ['secur', 'safe'], pool: ['security-cctv', 'emergency-exit'] },
  { match: ['compliance', 'sop', 'audit', 'standard'], pool: ['checklist', 'certificate'] },
]
const GENERAL_POOL: readonly CoverName[] = ['hotel-lobby', 'front-desk', 'guest-conversation', 'training-session']

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const pick = (pool: readonly CoverName[], id: string) => pool[hash(id) % pool.length]

export function coverFor(course: CourseCoverTarget): CoverName {
  const text = `${course.title ?? ''} ${course.description ?? ''}`.toLowerCase()
  for (const rule of TOPIC_RULES) {
    if (rule.words.some((w) => text.includes(w))) return pick(rule.pool, course.id)
  }
  const category = (course.category ?? '').toLowerCase()
  for (const c of CATEGORY_POOLS) {
    if (c.match.some((m) => category.includes(m))) return pick(c.pool, course.id)
  }
  return pick(GENERAL_POOL, course.id)
}

export function coverUrl(course: CourseCoverTarget): string {
  if (course.cover_image_url && course.cover_image_url.trim().length > 0) return course.cover_image_url
  return `/assets/photos/${coverFor(course)}.webp`
}
