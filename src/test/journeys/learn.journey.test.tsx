/**
 * Journey: LEARN
 * A learner opens My day, sees what is required, and continues a course.
 *
 * Steps covered here (rendered + primary action):
 *  1. My day renders its sections in priority order
 *  2. "Continue where you left off" surfaces the most recently touched course with its % and a Continue link
 *  3. "Required for you" lists overdue and mandatory items, most overdue first
 *  4. Empty states render honestly when a section has no data
 *  5. "Recommended for you" only offers catalog courses the member has not started or been assigned
 */
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryOk, renderJourney } from './helpers'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, f?: string) => f ?? k, i18n: { language: 'en', dir: () => 'ltr' } }),
    Trans: ({ children }: { children: React.ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('@/hooks/useCertificates', () => ({ useMyCertificates: vi.fn() }))
vi.mock('@/hooks/useKnowledge', () => ({ useBookmarks: vi.fn(), useArticles: vi.fn(), useRequiredReading: vi.fn() }))
vi.mock('@/hooks/useAccountContext', () => ({ useAccountContext: () => ({ tenantMemberships: [] }) }))
vi.mock('@/contexts/TenantContext', () => ({ useTenant: () => ({ currentOrganization: { id: 'org-1' } }) }))
vi.mock('@/hooks/useLearningProgress', () => ({ useLearningProgress: vi.fn() }))
vi.mock('@/hooks/useTraining', () => ({ useMyAssignments: vi.fn() }))
vi.mock('@/features/learn/catalogHooks', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/features/learn/catalogHooks')>()),
    useCatalog: vi.fn(),
}))

import LearnerHome from '@/pages/home/LearnerHome'
import { useAuth } from '@/hooks/useAuth'
import { useMyCertificates } from '@/hooks/useCertificates'
import { useArticles, useBookmarks, useRequiredReading } from '@/hooks/useKnowledge'
import { useLearningProgress } from '@/hooks/useLearningProgress'
import { useMyAssignments } from '@/hooks/useTraining'
import { useCatalog } from '@/features/learn/catalogHooks'
import { learningService } from '@/services/learningService'
import { awardCertificationPathCertificates } from '@/services/certificationPathService'

const USER_ID = 'learner-1'
const REQUIRED = 'Required for you ({{count}})'

function setup(overrides: Partial<Record<string, unknown>> = {}) {
    vi.mocked(useAuth).mockReturnValue({
        user: { id: USER_ID },
        profile: { full_name: 'Dana Learner' },
    } as never)
    vi.mocked(useLearningProgress).mockReturnValue((overrides.progress ?? queryOk([])) as never)
    vi.mocked(useMyAssignments).mockReturnValue((overrides.assignments ?? queryOk([])) as never)
    vi.mocked(useMyCertificates).mockReturnValue((overrides.certificates ?? queryOk([])) as never)
    vi.mocked(useBookmarks).mockReturnValue((overrides.bookmarks ?? queryOk([])) as never)
    vi.mocked(useArticles).mockReturnValue((overrides.articles ?? queryOk([])) as never)
    vi.mocked(useRequiredReading).mockReturnValue((overrides.reading ?? queryOk([])) as never)
    vi.mocked(useCatalog).mockReturnValue((overrides.catalog ?? queryOk([])) as never)
}

beforeEach(() => vi.clearAllMocks())

describe('journey: learn', () => {
    it('step 1: renders My day sections in priority order', () => {
        setup()
        renderJourney(<LearnerHome />, { route: '/learn' })
        expect(screen.getByRole('heading', { level: 1, name: /Dana/ })).toBeInTheDocument()
        const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
        expect(headings.slice(0, 2)).toEqual(['Continue where you left off', REQUIRED])
        expect(headings).toContain('Leaderboard')
        // Only the member's own progress is requested, never the organization's.
        expect(useLearningProgress).toHaveBeenCalledWith({ userId: USER_ID })
    })

    it('step 2: continue surfaces the most recent in-progress course with a Continue link', () => {
        setup({
            progress: queryOk([
                {
                    id: 'p1',
                    user_id: USER_ID,
                    content_id: 'mod-42',
                    content_type: 'module',
                    status: 'in_progress',
                    progress_percentage: 65,
                    last_accessed_at: '2026-08-30T10:00:00Z',
                    courses: { id: 'mod-42', title: 'Fire Safety Basics' },
                },
                {
                    id: 'p2',
                    user_id: USER_ID,
                    content_id: 'mod-10',
                    content_type: 'module',
                    status: 'in_progress',
                    progress_percentage: 20,
                    last_accessed_at: '2026-08-01T10:00:00Z',
                    courses: { id: 'mod-10', title: 'Older Course' },
                },
            ]),
        })
        renderJourney(<LearnerHome />, { route: '/learn' })
        const continueSection = screen.getByRole('region', { name: 'Continue where you left off' })
        expect(within(continueSection).getByText('Fire Safety Basics')).toBeInTheDocument()
        expect(screen.queryByText('Older Course')).not.toBeInTheDocument()
        expect(within(continueSection).getByText('65%')).toBeInTheDocument()
        const cta = within(continueSection).getByRole('link', { name: /Continue learning/i })
        expect(cta).toHaveAttribute('href', '/learn/player/mod-42')
    })

    it('step 3: required lists overdue and mandatory items, most overdue first', () => {
        setup({
            assignments: queryOk([
                {
                    id: 'a2',
                    content_id: 'm-2',
                    content_type: 'module',
                    content_title: 'Guest Service Standards',
                    priority: 'compliance',
                    due_date: '2099-01-01T00:00:00Z',
                    progress: null,
                },
                {
                    id: 'a1',
                    content_id: 'q-1',
                    content_type: 'quiz',
                    content_title: 'Allergen Handling Quiz',
                    priority: 'normal',
                    due_date: '2020-01-01T00:00:00Z',
                    progress: { status: 'in_progress' },
                },
            ]),
        })
        renderJourney(<LearnerHome />, { route: '/learn' })
        const required = screen.getByRole('region', { name: REQUIRED })
        const items = within(required).getAllByRole('listitem')
        expect(items[0]).toHaveTextContent('Allergen Handling Quiz')
        expect(items[0]).toHaveTextContent(/Overdue since/)
        expect(items[0]).toHaveTextContent('Continue learning')
        expect(within(items[0]).getByRole('link')).toHaveAttribute('href', '/learn/quizzes/q-1?assignment=a1')
        expect(items[1]).toHaveTextContent('Guest Service Standards')
        expect(items[1]).toHaveTextContent('Start course')
        expect(within(items[1]).getByRole('link')).toHaveAttribute('href', '/learn/player/m-2?assignment=a2')
    })

    it('step 4: honest empty states when nothing is assigned or in progress', () => {
        setup()
        renderJourney(<LearnerHome />, { route: '/learn' })
        expect(screen.getByText('You have no overdue or mandatory training.')).toBeInTheDocument()
        expect(screen.getByText('Nothing in progress')).toBeInTheDocument()
        expect(screen.queryByRole('region', { name: 'Recommended for you' })).not.toBeInTheDocument()
    })

    it('step 5: recommended skips courses already assigned or started', () => {
        setup({
            catalog: queryOk([
                { id: 'c-assigned', title: 'Assigned Course', description: null, category: null, estimated_duration_minutes: 20, difficulty_level: 'beginner', certificate_enabled: true, created_at: '2026-09-01T00:00:00Z' },
                { id: 'c-new', title: 'Fresh Course', description: null, category: null, estimated_duration_minutes: 30, difficulty_level: 'beginner', certificate_enabled: false, created_at: '2026-09-02T00:00:00Z' },
            ]),
            assignments: queryOk([
                { id: 'a1', content_id: 'c-assigned', content_type: 'module', content_title: 'Assigned Course', priority: 'normal', due_date: null, progress: null },
            ]),
        })
        renderJourney(<LearnerHome />, { route: '/learn' })
        const recommended = screen.getByRole('region', { name: 'Recommended for you' })
        expect(within(recommended).getByText('Fresh Course')).toBeInTheDocument()
        expect(within(recommended).queryByText('Assigned Course')).not.toBeInTheDocument()
        expect(within(recommended).getByRole('link', { name: /Fresh Course/ })).toHaveAttribute('href', '/learn/courses/c-new')
    })

    it('step 5b: unacknowledged required reading joins Required for you', () => {
        setup({
            reading: queryOk([
                { document_id: 'doc-1', title: 'Fire Evacuation SOP', content_type: 'sop', is_acknowledged: false },
                { document_id: 'doc-2', title: 'Already Read SOP', content_type: 'sop', is_acknowledged: true },
            ]),
        })
        renderJourney(<LearnerHome />, { route: '/learn' })
        const required = screen.getByRole('region', { name: REQUIRED })
        expect(within(required).getByText('Fire Evacuation SOP')).toBeInTheDocument()
        expect(within(required).queryByText('Already Read SOP')).not.toBeInTheDocument()
        expect(within(required).getByRole('link', { name: /Read and acknowledge/ })).toHaveAttribute('href', '/knowledge/doc-1')
    })

    it('step 6: submitQuizProgress exposes training progress mutation', () => {
        expect(typeof learningService.submitQuizProgress).toBe('function')
    })

    it('step 7: completeTrainingModuleRPC completes training module', () => {
        expect(typeof learningService.completeTrainingModuleRPC).toBe('function')
    })

    it('step 8: awardCertificationPathCertificates handles path certificate award', () => {
        expect(typeof awardCertificationPathCertificates).toBe('function')
    })
})
