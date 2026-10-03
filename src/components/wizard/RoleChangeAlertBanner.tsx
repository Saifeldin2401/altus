import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldAlert, ArrowRight, X } from 'lucide-react'
import { useWizard } from '@/hooks/useWizard'
import { useTranslation } from 'react-i18next'

export const RoleChangeAlertBanner: React.FC = () => {
  const { hasRoleChanged, previousRole, blueprint, openWhatCanIDo, dismissRoleChangeNotice } = useWizard()
  const { t } = useTranslation('wizard')

  if (!hasRoleChanged) {
    return null
  }

  return (
    <div className="bg-ds-warning/10 border-b border-ds-warning/20 text-foreground px-4 py-2.5 transition-all duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap text-sm">
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="h-7 w-7 rounded-full bg-ds-warning/20 text-ds-warning flex items-center justify-center shrink-0">
            <ShieldAlert className="h-4 w-4" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-xs sm:text-sm">
              {t('role_change.banner_title', 'Your organizational role has been updated:')}
            </span>
            <Badge variant="outline" className="text-xs bg-ds-warning/10 border-ds-warning/30 text-ds-warning font-semibold">
              {blueprint.roleName}
            </Badge>
            {previousRole && (
              <span className="text-xs text-muted-foreground">
                ({t('role_change.previous', 'previously')} {previousRole})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button 
            size="sm" 
            onClick={openWhatCanIDo}
            className="h-7 text-xs bg-ds-warning hover:bg-ds-warning text-white dark:text-ds-on-ink gap-1.5 shadow-sm"
          >
            {t('role_change.view_guide', 'View Role Guide')}
            <ArrowRight className="h-3 w-3" />
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={dismissRoleChangeNotice}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
