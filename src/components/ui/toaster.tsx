import { useTranslation } from 'react-i18next'
import { Toaster as SonnerToaster } from 'sonner'
import { useMediaQuery } from '@/hooks/useMediaQuery'

/**
 * Enhanced Sonner-powered Toaster with premium mobile-first design.
 * 
 * Mobile Enhancements:
 * - Uses top-center on mobile to avoid covering mobile navigation
 * - Uses bottom-center on desktop for better UX
 * - Full-width toasts on mobile for better readability
 * - Larger touch targets for close buttons
 * - Enhanced swipe gestures
 * - Improved typography and spacing
 * - Better color contrast
 * - Smooth animations optimized for mobile
 */
export function Toaster() {
    const { i18n } = useTranslation()
    const isRTL = i18n.dir() === 'rtl'
    const isMobile = useMediaQuery('(max-width: 640px)')

    // Use top-center on mobile to avoid covering bottom nav
    // Use bottom-center on desktop for better UX
    const position = isMobile ? 'top-center' : 'bottom-center'

    return (
        <SonnerToaster
            position={position}
            dir={isRTL ? 'rtl' : 'ltr'}
            style={{ zIndex: 99999 }}
            expand={true}
            richColors
            closeButton
            duration={4000}
            gap={10}
            visibleToasts={3}
            toastOptions={{
                classNames: {
                    // Base toast styling - mobile optimized
                    toast: `
                        group toast 
                        font-sans 
                        shadow-xl 
                        border 
                        rounded-[8px] 
                        px-4 py-4 
                        text-sm 
                        w-full 
                        max-w-[calc(100vw-2rem)]
                        sm:max-w-[400px]
                        min-h-[64px]
                        flex items-center gap-3
                        data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]
                        data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]
                        data-[swipe=cancel]:translate-x-0
                        data-[swipe=end]:animate-swipe-out
                    `,
                    // Title styling
                    title: `
                        font-semibold 
                        text-[15px] 
                        leading-tight
                        line-clamp-2
                    `,
                    // Description styling
                    description: `
                        text-[13px] 
                        opacity-85
                        leading-relaxed
                        line-clamp-2
                        mt-0.5
                    `,
                    // Action button styling
                    actionButton: `
                        bg-ds-ink 
                        text-white 
                        hover:bg-ds-ink/90 
                        text-xs 
                        font-semibold 
                        px-4 
                        py-2 
                        rounded-lg 
                        transition-all
                        active:scale-95
                        touch-target
                        min-h-[36px]
                    `,
                    // Cancel button styling
                    cancelButton: `
                        text-muted-foreground 
                        hover:text-foreground 
                        text-xs 
                        font-medium 
                        px-3 
                        py-2 
                        rounded-lg 
                        transition-colors
                        touch-target
                    `,
                    // Close button - larger for mobile touch
                    closeButton: `
                        opacity-0 
                        group-hover:opacity-100 
                        transition-opacity
                        absolute
                        top-2
                        end-2
                        p-2
                        rounded-full
                        hover:bg-black/5
                        touch-target
                        min-h-[36px]
                        min-w-[36px]
                        flex items-center justify-center
                    `,
                    // Success variant - enhanced
                    success: `
                        border-ds-success/30 
                        bg-ds-success-soft 
                        text-ds-success 
                    `,
                    // Error variant - enhanced
                    error: `
                        border-ds-danger/30 
                        bg-ds-danger-soft 
                        text-ds-danger 
                    `,
                    // Warning variant - enhanced
                    warning: `
                        border-ds-warning/30 
                        bg-ds-warning-soft 
                        text-ds-warning 
                    `,
                    // Info variant - enhanced
                    info: `
                        border-ds-info/30 
                        bg-ds-info-soft 
                        text-ds-info 
                    `,
                    // Loading variant
                    loading: `
                        border-ds-border 
                        bg-ds-surface-subtle 
                        text-ds-ink 
                    `,
                }
            }}

        />
    )
}
