import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useTenant } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import {
  CreditCard,
  Users,
  HardDrive,
  Cpu,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Subscription, SubscriptionPlan } from '@/lib/types/tenant'
import { formatDateTime } from '@/lib/utils'

const DEFAULT_STANDARD_PLAN: SubscriptionPlan = {
  id: '00000000-0000-0000-0000-000000000000',
  name: 'Standard Tier',
  code: 'standard',
  max_users: 25,
  max_storage_gb: 5,
  ai_monthly_quota_usd: 10.00,
  features: {
    custom_branding: false,
    ai_generation: true,
    api_access: false,
    advanced_analytics: false
  },
  is_active: true,
  created_at: new Date().toISOString()
}

import { platformService } from '@/services/platformService'

export function SubscriptionEntitlementsCard() {
  const { currentOrganization, isOrgAdmin } = useTenant()
  const { t, i18n } = useTranslation(['admin', 'common'])
  const isRtl = i18n.dir() === 'rtl'

  // 1. Query active subscription & plan
  const { data: subscription, isLoading: isLoadingSub } = useQuery<Subscription | null>({
    queryKey: ['org-subscription', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return null

      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          id,
          organization_id,
          plan_id,
          status,
          current_period_start,
          current_period_end,
          created_at,
          updated_at,
          plan:subscription_plans(*)
        `)
        .eq('organization_id', currentOrganization.id)
        .maybeSingle()

      if (error) {
        console.warn('Subscription fetch error:', error)
      }

      if (data && data.plan) {
        return {
          ...data,
          plan: Array.isArray(data.plan) ? data.plan[0] : data.plan
        } as unknown as Subscription
      }

      return null
    },
    enabled: !!currentOrganization?.id
  })

  // 2. Query effective entitlements & live usage counts from DB RPC
  const { data: entitlements, isLoading: isLoadingEntitlements } = useQuery({
    queryKey: ['org-effective-entitlements', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return null
      return platformService.getEffectiveEntitlements(currentOrganization.id)
    },
    enabled: !!currentOrganization?.id
  })

  // 3. Evaluate organization quotas (80%, 90%, 100% proactive alerts & metering)
  const { data: quotaEvaluation, isLoading: isLoadingQuotaEval } = useQuery({
    queryKey: ['org-quota-evaluation', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return null
      return platformService.evaluateOrganizationQuotas(currentOrganization.id)
    },
    enabled: !!currentOrganization?.id,
    staleTime: 60 * 1000
  })

  const planName = entitlements?.plan || subscription?.plan?.name || DEFAULT_STANDARD_PLAN.name
  const planCode = entitlements?.plan_code || subscription?.plan?.code || 'standard'

  // Metric values prioritized from quota evaluation RPC
  const userCount = quotaEvaluation?.utilization?.learners?.used ?? entitlements?.usage?.learners ?? 0
  const maxUsers = quotaEvaluation?.utilization?.learners?.max ?? entitlements?.max_learners ?? subscription?.plan?.max_users ?? DEFAULT_STANDARD_PLAN.max_users
  const userPercent = quotaEvaluation?.utilization?.learners?.pct ?? Math.min(100, Math.round((userCount / (maxUsers || 1)) * 100))

  const aiCreditsUsed = quotaEvaluation?.utilization?.ai_credits?.used ?? entitlements?.ai_credits_used ?? 0
  const aiMonthlyQuota = quotaEvaluation?.utilization?.ai_credits?.max ?? entitlements?.ai_credits_monthly ?? subscription?.plan?.ai_monthly_quota_usd ?? DEFAULT_STANDARD_PLAN.ai_monthly_quota_usd
  const aiPercent = quotaEvaluation?.utilization?.ai_credits?.pct ?? (aiMonthlyQuota > 0 ? Math.min(100, Math.round((aiCreditsUsed / (aiMonthlyQuota || 1)) * 100)) : 0)

  const storageUsedGb = quotaEvaluation?.utilization?.storage?.used_gb ?? (quotaEvaluation?.utilization?.storage?.used ? Number((quotaEvaluation.utilization.storage.used / (1024 * 1024 * 1024)).toFixed(2)) : 0)
  const maxStorageGb = quotaEvaluation?.utilization?.storage?.max_gb ?? entitlements?.max_storage_gb ?? subscription?.plan?.max_storage_gb ?? DEFAULT_STANDARD_PLAN.max_storage_gb
  const storagePercent = quotaEvaluation?.utilization?.storage?.pct ?? Math.min(100, Math.round((storageUsedGb / (maxStorageGb || 1)) * 100))

  const features = entitlements?.plan_features || subscription?.plan?.features || DEFAULT_STANDARD_PLAN.features

  // Capacity Threshold Assessment (80%, 90%, 100%)
  const maxPercent = Math.max(userPercent, aiPercent, storagePercent)
  const isAtCapacity = maxPercent >= 100
  const isUrgentWarning = maxPercent >= 90 && maxPercent < 100
  const isWarning = maxPercent >= 80 && maxPercent < 90
  const isNearLimit = maxPercent >= 80

  const handleUpgradeClick = () => {
    window.open('mailto:sales@altus-advisory.com?subject=Altus%20Subscription%20Quota%20Upgrade%20Inquiry', '_blank')
  }

  const planBadgeStyle = useMemo(() => {
    switch (planCode) {
      case 'enterprise':
        return 'bg-ds-accent-soft text-ds-accent border-ds-accent/30'
      case 'growth':
        return 'bg-ds-accent-soft text-ds-accent border-ds-accent/30'
      default:
        return 'bg-ds-surface-subtle text-ds-ink-secondary border-ds-border'
    }
  }, [planCode])

  const getCapacityBadge = (pct: number) => {
    if (pct >= 100) {
      return (
        <Badge variant="destructive" size="sm">
          {t('admin:quota_capacity_full', '100% Full')}
        </Badge>
      )
    }
    if (pct >= 90) {
      return (
        <Badge variant="warning" size="sm">
          {t('admin:quota_capacity_critical', '90%+ Critical')}
        </Badge>
      )
    }
    if (pct >= 80) {
      return (
        <Badge variant="warning" size="sm">
          {t('admin:quota_capacity_warning', '80%+ Warning')}
        </Badge>
      )
    }
    return null
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ds-border p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CreditCard aria-hidden="true" className="h-5 w-5 shrink-0 text-ds-accent" />
              <h3 className="text-base font-semibold text-ds-ink">
                {t('admin:subscription_and_entitlements', 'Your plan')}
              </h3>
              <Badge variant="outline" className={planBadgeStyle}>
                {planName}
              </Badge>
              <Badge variant="outline" size="sm" className="capitalize">
                {subscription?.status || 'active'}
              </Badge>
            </div>
            <p className="text-sm text-ds-muted">
              {t('admin:subscription_desc', 'What your plan includes and how much of it you are using.')}
              {subscription?.current_period_end && (
                <> {t('admin:renews_on_date', 'Renews on {{date}}.', { date: formatDateTime(subscription.current_period_end).split(',')[0] })}</>
              )}
            </p>
          </div>
          {isOrgAdmin && (
            <Button variant="outline" size="sm" onClick={handleUpgradeClick} className="shrink-0">
              {t('admin:upgrade_entitlements', 'Change plan')}
              <ArrowUpRight aria-hidden="true" className="rtl:-scale-x-100" />
            </Button>
          )}
        </div>

        {isNearLimit && (
          <div
            role="status"
            className={`mt-4 flex flex-col justify-between gap-3 rounded-[6px] border-s-[3px] px-4 py-3 text-sm sm:flex-row sm:items-center ${
              isAtCapacity ? 'border-ds-danger bg-ds-danger-soft' : 'border-ds-warning bg-ds-warning-soft'
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${isAtCapacity ? 'text-ds-danger' : 'text-ds-warning'}`} />
              <div className="space-y-0.5">
                <p className="font-semibold text-ds-ink">
                  {isAtCapacity
                    ? t('admin:capacity_100_warning', 'You have reached a plan limit. Adding people or content may be blocked until the plan changes.')
                    : isUrgentWarning
                      ? t('admin:capacity_90_warning', 'You have used over 90% of a plan limit.')
                      : t('admin:capacity_80_warning', 'You have used over 80% of a plan limit.')}
                </p>
                <p className="text-xs text-ds-ink-secondary">
                  {t('admin:alerts_notified_admins', 'Organization admins have been emailed about this.')}
                </p>
              </div>
            </div>
            {isOrgAdmin && (
              <Button size="sm" variant={isAtCapacity ? 'destructive' : 'default'} onClick={handleUpgradeClick} className="shrink-0">
                {t('admin:upgrade_entitlements', 'Change plan')}
              </Button>
            )}
          </div>
        )}
      </div>

      <CardContent className="space-y-6 p-5">
        {/* Resource Usage Quotas Progress Deck */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* 1. Active Users */}
          <div className="space-y-2 rounded-[6px] border border-ds-border bg-ds-surface-subtle p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4 text-ds-muted" />
                {t('admin:user_seats', 'User Seats')}
              </span>
              <div className="flex items-center gap-1.5">
                {getCapacityBadge(userPercent)}
                <span className="font-mono font-semibold tabular-nums text-ds-ink">
                  {userCount} / {maxUsers.toLocaleString()}
                </span>
              </div>
            </div>
            <Progress
              value={userPercent}
              className={userPercent >= 100 ? '[&>div]:bg-ds-danger' : userPercent >= 90 ? '[&>div]:bg-ds-danger' : userPercent >= 80 ? '[&>div]:bg-ds-warning' : '[&>div]:bg-ds-success'}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span className="font-medium">{userPercent}% {t('admin:utilized', 'used')}</span>
              <span>{Math.max(0, maxUsers - userCount).toLocaleString()} {t('admin:seats_remaining', 'available')}</span>
            </div>
          </div>

          {/* 3. Monthly AI Generation Quota */}
          <div className="space-y-2 rounded-[6px] border border-ds-border bg-ds-surface-subtle p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-ds-muted" />
                {t('admin:ai_monthly_compute', 'AI Monthly Credits')}
              </span>
              <div className="flex items-center gap-1.5">
                {getCapacityBadge(aiPercent)}
                <span className="font-mono font-semibold tabular-nums text-ds-ink">
                  {aiCreditsUsed} / {aiMonthlyQuota.toLocaleString()}
                </span>
              </div>
            </div>
            <Progress
              value={aiPercent}
              className={aiPercent >= 100 ? '[&>div]:bg-ds-danger' : aiPercent >= 90 ? '[&>div]:bg-ds-danger' : aiPercent >= 80 ? '[&>div]:bg-ds-warning' : '[&>div]:bg-ds-success'}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span className="font-medium">{aiPercent}% {t('admin:utilized', 'used')}</span>
              <span>{Math.max(0, aiMonthlyQuota - aiCreditsUsed).toLocaleString()} {t('admin:budget_left', 'left')}</span>
            </div>
          </div>

          {/* 4. Document & Media Storage */}
          <div className="space-y-2 rounded-[6px] border border-ds-border bg-ds-surface-subtle p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <HardDrive className="h-4 w-4 text-ds-muted" />
                {t('admin:cloud_storage', 'Cloud Storage')}
              </span>
              <div className="flex items-center gap-1.5">
                {getCapacityBadge(storagePercent)}
                <span className="font-mono font-semibold tabular-nums text-ds-ink">
                  {storageUsedGb.toFixed(1)} / {maxStorageGb} GB
                </span>
              </div>
            </div>
            <Progress
              value={storagePercent}
              className={storagePercent >= 100 ? '[&>div]:bg-ds-danger' : storagePercent >= 90 ? '[&>div]:bg-ds-danger' : storagePercent >= 80 ? '[&>div]:bg-ds-warning' : '[&>div]:bg-ds-success'}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span className="font-medium">{storagePercent}% {t('admin:utilized', 'used')}</span>
              <span>{(Math.max(0, maxStorageGb - storageUsedGb)).toFixed(1)} GB {t('admin:storage_free', 'free')}</span>
            </div>
          </div>
        </div>

        {/* Feature Entitlements Badges Grid */}
        <div className="space-y-3 pt-2">
          <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ds-muted">
            <ShieldCheck className="h-4 w-4 text-ds-muted" />
            <span>{t('admin:feature_entitlements', 'Included features')}</span>
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Custom Branding */}
            <div className={`p-3 rounded-[6px] border flex items-center gap-2.5 text-xs ${features?.custom_branding ? 'border-ds-border bg-ds-surface' : 'border-ds-border bg-ds-surface-subtle opacity-60'}`}>
              {features?.custom_branding ? (
                <CheckCircle2 className="h-4 w-4 text-ds-success shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">{t('admin:custom_branding', 'Custom Branding')}</span>
                <span className="text-[11px] text-muted-foreground">{t('admin:custom_theme_logos', 'White-labeling & colors')}</span>
              </div>
            </div>

            {/* AI Generation */}
            <div className={`p-3 rounded-[6px] border flex items-center gap-2.5 text-xs ${features?.ai_generation ? 'border-ds-border bg-ds-surface' : 'border-ds-border bg-ds-surface-subtle opacity-60'}`}>
              {features?.ai_generation ? (
                <CheckCircle2 className="h-4 w-4 text-ds-success shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">{t('admin:ai_generation_engine', 'AI Course Engine')}</span>
                <span className="text-[11px] text-muted-foreground">{t('admin:ai_course_gen', 'Multi-agent authoring')}</span>
              </div>
            </div>

            {/* API Access */}
            <div className={`p-3 rounded-[6px] border flex items-center gap-2.5 text-xs ${features?.api_access ? 'border-ds-border bg-ds-surface' : 'border-ds-border bg-ds-surface-subtle opacity-60'}`}>
              {features?.api_access ? (
                <CheckCircle2 className="h-4 w-4 text-ds-success shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">{t('admin:api_access_webhooks', 'API & Webhooks')}</span>
                <span className="text-[11px] text-muted-foreground">{t('admin:external_integrations', 'HRMS & SIEM sync')}</span>
              </div>
            </div>

            {/* Advanced Analytics */}
            <div className={`p-3 rounded-[6px] border flex items-center gap-2.5 text-xs ${features?.advanced_analytics ? 'border-ds-border bg-ds-surface' : 'border-ds-border bg-ds-surface-subtle opacity-60'}`}>
              {features?.advanced_analytics ? (
                <CheckCircle2 className="h-4 w-4 text-ds-success shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">{t('admin:advanced_analytics', 'Advanced Analytics')}</span>
                <span className="text-[11px] text-muted-foreground">{t('admin:skills_compliance', 'Skills & audit matrices')}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
