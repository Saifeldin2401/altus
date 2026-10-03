import { useAuth } from '@/hooks/useAuth'
import { useMaintenanceMode, useAppBranding } from '@/hooks/useSystemSettings'
import { ShieldAlert, Wrench, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function MaintenanceGuard({ children }: { children: React.ReactNode }) {
    const { isMaintenance, isLoading } = useMaintenanceMode()
    const { profile } = useAuth()
    const { appName, companyName } = useAppBranding()

    const role = String(profile?.role || '')
    const isAdmin = ['administrator', 'super_admin', 'corporate_admin', 'training_manager', 'regional_admin', 'property_manager'].includes(role)

    // If maintenance mode is ON and user is NOT an admin, block access
    if (!isLoading && isMaintenance && !isAdmin) {
        return (
            <div className="min-h-screen bg-ds-ink text-ds-on-ink flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-ds-ink border border-ds-ink-secondary rounded-[8px] p-8 shadow-2xl space-y-6">
                    <div className="w-16 h-16 bg-ds-warning/10 border border-ds-warning/30 rounded-[8px] flex items-center justify-center mx-auto text-ds-warning">
                        <Wrench className="w-8 h-8 animate-pulse" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold tracking-tight">{appName} Under Maintenance</h1>
                        <p className="text-sm text-ds-muted">
                            {companyName} platform administrators have enabled system maintenance mode.
                        </p>
                    </div>

                    <div className="p-4 bg-ds-ink/50 rounded-[8px] border border-ds-ink-secondary/50 text-xs text-ds-muted flex items-center gap-3 text-start">
                        <ShieldAlert className="w-5 h-5 text-ds-warning flex-shrink-0" />
                        <span>Scheduled upgrades and system optimization are currently in progress. Access will resume shortly.</span>
                    </div>

                    <Button
                        onClick={() => window.location.reload()}
                        className="w-full bg-ds-accent hover:bg-ds-warning text-ds-ink font-semibold gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Check Again
                    </Button>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
