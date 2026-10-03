import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Award, LineChart, Users } from 'lucide-react'

import { AssignTrainingWizardModal } from '@/components/training/AssignTrainingWizardModal'
import { TrainingTrackCommandCenter } from '@/components/training/hub/TrainingTrackCommandCenter'
import { useTenant } from '@/contexts/TenantContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { WorkspaceHeader, headerActionClass } from '@/ui'

/**
 * Manage > Course tracking. The per-course tracking command centre:
 * completion by course, stalled learners, drop-off analysis, and follow-up actions.
 */
export default function CourseTracking() {
    const { t } = useTranslation('training')
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { currentOrganization } = useTenant()
    const { can, canAny } = useCapabilities()
    const [wizardOpen, setWizardOpen] = useState(false)

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <WorkspaceHeader
                eyebrow={t('tracking.eyebrow', 'Manage')}
                title={t('tracking.title', 'Course tracking')}
                context={currentOrganization?.name ?? null}
                actions={
                    <>
                        <Link to="/manage/compliance" className={headerActionClass.secondary}>
                            <LineChart aria-hidden="true" className="h-4 w-4" />
                            {t('tracking.complianceTrends', 'Compliance trends')}
                        </Link>
                        <Link to="/manage/certificates" className={`${headerActionClass.secondary} hidden sm:inline-flex`}>
                            <Award aria-hidden="true" className="h-4 w-4" />
                            {t('tracking.certificates', 'Certificates')}
                        </Link>
                        {can('assignment.manage') && (
                            <button
                                type="button"
                                onClick={() => setWizardOpen(true)}
                                className={headerActionClass.primary}
                            >
                                <Users aria-hidden="true" className="h-4 w-4" />
                                {t('assign_wizard', 'Assign to team')}
                            </button>
                        )}
                    </>
                }
            />
            <TrainingTrackCommandCenter
                canManageModules={canAny('content.author', 'content.publish')}
                onNavigateToBuilder={(id) => navigate(`/studio/courses/${id}`)}
            />
            <AssignTrainingWizardModal
                open={wizardOpen}
                onOpenChange={setWizardOpen}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['learning-assignments'] })}
            />
        </div>
    )
}
