import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useTenant } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import { ensureReadableOnWhiteText } from '@/lib/colorContrast'
import { useToast } from '@/components/ui/use-toast'
import { Globe, Image as ImageIcon, Upload, Loader2, X, type LucideIcon, Building, Palette, Mail } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { TenantEmailPreviewModal } from '@/components/admin/TenantEmailPreviewModal'
import { AITenantEmailBrandCopilotModal } from '@/components/admin/AITenantEmailBrandCopilotModal'
import type { AIEmailBrandSuggestions } from '@/components/admin/AITenantEmailBrandCopilotModal'

export function OrganizationProfileSettings() {
  const { currentOrganization, isOrgAdmin, refreshTenantData } = useTenant()
  const { toast } = useToast()
  const { t } = useTranslation(['admin', 'common'])

  // Identity & Branding
  const [name, setName] = useState(currentOrganization?.name || '')
  const [nameAr, setNameAr] = useState(currentOrganization?.name_ar || '')
  const [logoUrl, setLogoUrl] = useState(currentOrganization?.logo_url || '')
  const [faviconUrl, setFaviconUrl] = useState(currentOrganization?.favicon_url || '')
  const [primaryColor, setPrimaryColor] = useState(currentOrganization?.brand_colors?.primary || '#0f172a')
  const [secondaryColor, setSecondaryColor] = useState(currentOrganization?.brand_colors?.secondary || '#2563eb')
  const [accentColor, setAccentColor] = useState(currentOrganization?.brand_colors?.accent || '#d97706')

  // Email & Communication Branding
  const [emailSenderName, setEmailSenderName] = useState(currentOrganization?.email_sender_name || '')
  const [emailReplyTo, setEmailReplyTo] = useState(currentOrganization?.email_reply_to || '')
  const [supportEmail, setSupportEmail] = useState(currentOrganization?.support_email || '')
  const [websiteUrl, setWebsiteUrl] = useState(currentOrganization?.website_url || '')
  const [emailFooterText, setEmailFooterText] = useState(currentOrganization?.email_footer_text || '')
  const [emailFooterTextAr, setEmailFooterTextAr] = useState(currentOrganization?.email_footer_text_ar || '')

  const [isSaving, setIsSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const logoFileInputRef = useRef<HTMLInputElement>(null)
  const faviconFileInputRef = useRef<HTMLInputElement>(null)

  const uploadOrgImage = async (file: File, kind: 'logo' | 'favicon') => {
    if (!currentOrganization?.id) return
    const setUploading = kind === 'logo' ? setUploadingLogo : setUploadingFavicon
    const setUrl = kind === 'logo' ? setLogoUrl : setFaviconUrl
    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop() || (kind === 'favicon' ? 'ico' : 'png')
      // Org UUID must be the first path segment to satisfy the "media" bucket's
      // org-scoped storage RLS (see storage.foldername(name))[1] check).
      const filePath = `${currentOrganization.id}/org-branding/${kind}-${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file, { cacheControl: '3600', upsert: false })
      if (uploadError) throw uploadError

      // eslint-disable-next-line no-restricted-properties -- 'media' is a public bucket (verified live); a durable public URL is intended here.
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(filePath)
      setUrl(urlData.publicUrl)
      toast({
        title: kind === 'logo' ? t('admin:profile.logo_uploaded', 'Logo uploaded') : t('admin:profile.favicon_uploaded', 'Favicon uploaded'),
        description: t('admin:profile.save_to_apply', 'Select Save changes to apply it.'),
      })
    } catch (err: any) {
      toast({ title: t('admin:profile.upload_failed', 'Upload failed'), description: err.message, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleApplyAISuggestions = (sug: AIEmailBrandSuggestions) => {
    setEmailSenderName(sug.emailSenderName)
    setEmailReplyTo(sug.emailReplyTo)
    setSupportEmail(sug.supportEmail)
    setWebsiteUrl(sug.websiteUrl)
    setEmailFooterText(sug.emailFooterText)
    setEmailFooterTextAr(sug.emailFooterTextAr)
    setPrimaryColor(sug.brandColors.primary)
    setSecondaryColor(sug.brandColors.secondary)
    setAccentColor(sug.brandColors.accent)
  }

  useEffect(() => {
    if (currentOrganization) {
      setName(currentOrganization.name)
      setNameAr(currentOrganization.name_ar || '')
      setLogoUrl(currentOrganization.logo_url || '')
      setFaviconUrl(currentOrganization.favicon_url || '')
      setPrimaryColor(currentOrganization.brand_colors?.primary || '#0f172a')
      setSecondaryColor(currentOrganization.brand_colors?.secondary || '#2563eb')
      setAccentColor(currentOrganization.brand_colors?.accent || '#d97706')
      setEmailSenderName(currentOrganization.email_sender_name || '')
      setEmailReplyTo(currentOrganization.email_reply_to || '')
      setSupportEmail(currentOrganization.support_email || '')
      setWebsiteUrl(currentOrganization.website_url || '')
      setEmailFooterText(currentOrganization.email_footer_text || '')
      setEmailFooterTextAr(currentOrganization.email_footer_text_ar || '')
    }
  }, [currentOrganization])

  const saved = {
    name: currentOrganization?.name || '',
    nameAr: currentOrganization?.name_ar || '',
    logoUrl: currentOrganization?.logo_url || '',
    faviconUrl: currentOrganization?.favicon_url || '',
    primaryColor: currentOrganization?.brand_colors?.primary || '#0f172a',
    secondaryColor: currentOrganization?.brand_colors?.secondary || '#2563eb',
    accentColor: currentOrganization?.brand_colors?.accent || '#d97706',
    emailSenderName: currentOrganization?.email_sender_name || '',
    emailReplyTo: currentOrganization?.email_reply_to || '',
    supportEmail: currentOrganization?.support_email || '',
    websiteUrl: currentOrganization?.website_url || '',
    emailFooterText: currentOrganization?.email_footer_text || '',
    emailFooterTextAr: currentOrganization?.email_footer_text_ar || '',
  }
  const draft = {
    name, nameAr, logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor,
    emailSenderName, emailReplyTo, supportEmail, websiteUrl, emailFooterText, emailFooterTextAr,
  }
  const isDirty = (Object.keys(saved) as (keyof typeof saved)[]).some((k) => saved[k] !== draft[k])

  const handleDiscard = () => {
    setName(saved.name)
    setNameAr(saved.nameAr)
    setLogoUrl(saved.logoUrl)
    setFaviconUrl(saved.faviconUrl)
    setPrimaryColor(saved.primaryColor)
    setSecondaryColor(saved.secondaryColor)
    setAccentColor(saved.accentColor)
    setEmailSenderName(saved.emailSenderName)
    setEmailReplyTo(saved.emailReplyTo)
    setSupportEmail(saved.supportEmail)
    setWebsiteUrl(saved.websiteUrl)
    setEmailFooterText(saved.emailFooterText)
    setEmailFooterTextAr(saved.emailFooterTextAr)
  }

  const handleSave = async () => {
    if (!currentOrganization?.id) return
    setIsSaving(true)

    try {
      const updatedColors = { primary: primaryColor, secondary: secondaryColor, accent: accentColor }
      const { error } = await supabase
        .from('organizations')
        .update({
          name,
          name_ar: nameAr || null,
          logo_url: logoUrl || null,
          favicon_url: faviconUrl || null,
          brand_colors: updatedColors,
          email_sender_name: emailSenderName || null,
          email_reply_to: emailReplyTo || null,
          support_email: supportEmail || null,
          website_url: websiteUrl || null,
          email_footer_text: emailFooterText || null,
          email_footer_text_ar: emailFooterTextAr || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentOrganization.id)

      if (error) throw error

      await refreshTenantData()
      toast({
        title: t('admin:profile.saved', 'Profile and branding saved'),
      })
    } catch (err: unknown) {
      const error = err as { message?: string }
      toast({
        title: t('common:error', 'Error'),
        description: error?.message || 'Failed to save organization settings',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Same guard the live header applies (Header.tsx / lib/colorContrast.ts) — the header
  // only ever uses primaryColor as its background with fixed white text, so this preview
  // should show admins the same darkened result they'll actually get, not the raw pick.
  const readablePrimaryColor = ensureReadableOnWhiteText(primaryColor)

  const colorField = (id: string, label: string, value: string, onChange: (v: string) => void) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!isOrgAdmin}
          className="h-9 w-12 cursor-pointer rounded-[6px] border border-ds-border bg-ds-surface p-0.5 disabled:cursor-not-allowed"
        />
        <span className="font-mono text-xs text-ds-muted">{value}</span>
      </div>
    </div>
  )

  const imageField = (
    kind: 'logo' | 'favicon',
    label: string,
    url: string,
    clear: () => void,
    uploading: boolean,
    inputRef: React.RefObject<HTMLInputElement | null>,
    accept: string,
    Icon: LucideIcon,
  ) => (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-ds-border bg-ds-surface-subtle">
          {url ? <img src={url} alt="" className="h-full w-full object-contain" /> : <Icon aria-hidden="true" className="h-4 w-4 text-ds-muted" />}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadOrgImage(file, kind)
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!isOrgAdmin || uploading}
          onClick={() => inputRef.current?.click()}
          className="flex-1"
        >
          {uploading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Upload aria-hidden="true" />}
          {url ? t('admin:replace', 'Replace') : t('admin:upload', 'Upload')}
        </Button>
        {url && isOrgAdmin && (
          <Button
            aria-label={kind === 'logo' ? t('common:a11y.removeLogo', 'Remove logo') : t('common:a11y.removeFavicon', 'Remove favicon')}
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={clear}
            className="shrink-0 text-ds-muted hover:text-ds-danger"
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {isOrgAdmin && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <AITenantEmailBrandCopilotModal
            orgName={name}
            orgNameAr={nameAr}
            slug={currentOrganization?.slug}
            industry={currentOrganization?.industry}
            currentPrimaryColor={primaryColor}
            currentSecondaryColor={secondaryColor}
            currentAccentColor={accentColor}
            onApply={handleApplyAISuggestions}
            disabled={!isOrgAdmin}
          />
          <TenantEmailPreviewModal
            orgName={name}
            orgNameAr={nameAr}
            logoUrl={logoUrl}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            accentColor={accentColor}
            senderName={emailSenderName}
            replyTo={emailReplyTo}
            supportEmail={supportEmail}
            websiteUrl={websiteUrl}
            footerText={emailFooterText}
            footerTextAr={emailFooterTextAr}
          />
        </div>
      )}

      {!isOrgAdmin && (
        <p className="rounded-[6px] border border-ds-border bg-ds-surface-subtle px-4 py-3 text-sm text-ds-muted">
          {t('admin:profile.read_only', 'Only organization admins can change the profile and branding.')}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel icon={Building} title={t('admin:org_identity', 'Identity')} description={t('admin:org_identity_desc', 'The name people see, in English and Arabic, and your logo.')}>
          <div className="space-y-2">
            <Label htmlFor="org-name">{t('admin:org_name', 'Organization name (English)')}</Label>
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isOrgAdmin} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-name-ar">{t('admin:org_name_ar', 'Organization name (Arabic)')}</Label>
            <Input id="org-name-ar" value={nameAr} onChange={(e) => setNameAr(e.target.value)} disabled={!isOrgAdmin} dir="rtl" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {imageField('logo', t('admin:logo_url', 'Logo (PNG or SVG)'), logoUrl, () => setLogoUrl(''), uploadingLogo, logoFileInputRef, 'image/*', ImageIcon)}
            {imageField('favicon', t('admin:favicon_url', 'Browser tab icon'), faviconUrl, () => setFaviconUrl(''), uploadingFavicon, faviconFileInputRef, 'image/*,.ico', Globe)}
          </div>
          <p className="text-xs text-ds-muted">
            {t('admin:profile.identifier', 'Organization ID')}: <span className="font-mono">{currentOrganization?.slug || currentOrganization?.id}</span>
          </p>
        </Panel>

        <Panel icon={Palette} title={t('admin:brand_styling', 'Colours')} description={t('admin:brand_styling_desc', 'Used in the header, buttons and emails for your organization.')}>
          <div className="grid grid-cols-3 gap-3">
            {colorField('org-color-primary', t('admin:color_primary', 'Primary'), primaryColor, setPrimaryColor)}
            {colorField('org-color-secondary', t('admin:color_secondary', 'Secondary'), secondaryColor, setSecondaryColor)}
            {colorField('org-color-accent', t('admin:color_accent', 'Accent'), accentColor, setAccentColor)}
          </div>
          <div className="space-y-3 rounded-[6px] border border-ds-border bg-ds-surface-subtle p-4">
            <p className="text-xs font-semibold text-ds-muted">{t('admin:preview', 'Preview')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-[6px] px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: readablePrimaryColor }}>
                {name || t('admin:profile.preview_header', 'Header')}
              </span>
              <span className="rounded-[6px] px-4 py-2 text-xs font-medium text-white" style={{ backgroundColor: secondaryColor }}>
                {t('admin:profile.preview_button', 'Button')}
              </span>
              <span className="rounded-[6px] px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: accentColor }}>
                {t('admin:profile.preview_badge', 'Badge')}
              </span>
            </div>
            {readablePrimaryColor !== primaryColor && (
              <p className="text-xs text-ds-warning">
                {t('admin:primary_color_darkened_notice', {
                  adjusted: readablePrimaryColor,
                  defaultValue: `Your header background will show as ${readablePrimaryColor}. ${primaryColor} is too light for the header's white text to stay readable.`,
                })}
              </p>
            )}
          </div>
        </Panel>
      </div>

      <Panel icon={Mail} title={t('admin:email_branding_title', 'Emails')} description={t('admin:email_branding_desc', 'How invitations, password resets and reminders are signed.')}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email-sender-name">{t('admin:sender_name', 'Sender name')}</Label>
            <Input id="email-sender-name" value={emailSenderName} onChange={(e) => setEmailSenderName(e.target.value)} disabled={!isOrgAdmin} />
            <p className="text-xs text-ds-muted">{t('admin:sender_name_hint', 'Shown as the "From" name.')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-reply-to">{t('admin:reply_to_email', 'Reply-to address')}</Label>
            <Input id="email-reply-to" value={emailReplyTo} onChange={(e) => setEmailReplyTo(e.target.value)} disabled={!isOrgAdmin} type="email" />
            <p className="text-xs text-ds-muted">{t('admin:reply_to_hint', 'Where replies go.')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-email">{t('admin:support_email', 'Support email')}</Label>
            <Input id="support-email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} disabled={!isOrgAdmin} type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website-url">{t('admin:website_url', 'Website')}</Label>
            <Input id="website-url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} disabled={!isOrgAdmin} placeholder="https://" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footer-text-en">{t('admin:footer_text_en', 'Email footer (English)')}</Label>
            <Textarea id="footer-text-en" value={emailFooterText} onChange={(e) => setEmailFooterText(e.target.value)} disabled={!isOrgAdmin} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footer-text-ar">{t('admin:footer_text_ar', 'Email footer (Arabic)')}</Label>
            <Textarea id="footer-text-ar" value={emailFooterTextAr} onChange={(e) => setEmailFooterTextAr(e.target.value)} disabled={!isOrgAdmin} dir="rtl" rows={2} />
          </div>
        </div>
      </Panel>

      {isOrgAdmin && isDirty && (
        <div role="status" className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-[8px] border border-ds-border bg-ds-surface px-4 py-3 shadow-lg shadow-black/10 dark:shadow-black/40 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-ds-ink">{t('admin:profile.unsaved', 'You have unsaved changes to the profile and branding.')}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleDiscard} disabled={isSaving}>
              {t('admin:profile.discard', 'Discard')}
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 aria-hidden="true" className="animate-spin" />}
              {t('admin:profile.save', 'Save changes')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Panel({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-[8px] border border-ds-border bg-ds-surface p-4 sm:p-5">
      <div className="flex items-start gap-3 border-b border-ds-border pb-3">
        <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-ds-accent" />
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold text-ds-ink">{title}</h3>
          <p className="text-xs text-ds-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}
