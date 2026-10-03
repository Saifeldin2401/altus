import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle, Info, Trash2 } from 'lucide-react'
type ConfirmationVariant = 'danger' | 'warning' | 'info' | 'success'

interface ConfirmationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void | Promise<void>
    title: string
    description: string
    confirmText?: string
    cancelText?: string
    variant?: ConfirmationVariant
    isLoading?: boolean
}

const variantConfig = {
    danger: {
        icon: Trash2,
        iconColor: 'text-ds-danger',
        iconBg: 'bg-ds-danger-soft',
        buttonClass: 'bg-ds-danger hover:bg-ds-danger/90',
    },
    warning: {
        icon: AlertTriangle,
        iconColor: 'text-ds-warning',
        iconBg: 'bg-ds-warning-soft',
        buttonClass: 'bg-ds-warning hover:bg-ds-warning/90',
    },
    info: {
        icon: Info,
        iconColor: 'text-ds-info',
        iconBg: 'bg-ds-info-soft',
        buttonClass: 'bg-ds-ink hover:bg-ds-ink/90',
    },
    success: {
        icon: CheckCircle,
        iconColor: 'text-ds-success',
        iconBg: 'bg-ds-success-soft',
        buttonClass: 'bg-ds-success hover:bg-ds-success/90',
    },
}

export function ConfirmationDialog({
    open,
    onOpenChange,
    onConfirm,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isLoading = false,
}: ConfirmationDialogProps) {
    const config = variantConfig[variant]
    const Icon = config.icon

    const handleConfirm = async () => {
        try {
            await onConfirm()
        } catch (error) {
            console.error('Confirmation action failed:', error)
            toast({
                title: 'Action Failed',
                description: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
                variant: 'destructive',
            })
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={(v) => { if (!isLoading) onOpenChange(v) }}>
            <AlertDialogContent className="sm:max-w-[425px]">
                <AlertDialogHeader>
                    <div className="flex items-start gap-4">
                        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', config.iconBg)}>
                            <Icon aria-hidden="true" className={cn('h-5 w-5', config.iconColor)} />
                        </div>
                        <div className="flex-1">
                            <AlertDialogTitle className="text-start">{title}</AlertDialogTitle>
                            <AlertDialogDescription className="text-start mt-2">
                                {description}
                            </AlertDialogDescription>
                        </div>
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter className="sm:gap-x-2">
                    <AlertDialogCancel disabled={isLoading}>{cancelText}</AlertDialogCancel>
                    <Button
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className={cn(config.buttonClass, 'text-white')}
                    >
                        {isLoading ? (
                            <>
                                <div className="me-2 h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-current" />
                                Processing...
                            </>
                        ) : (
                            confirmText
                        )}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

// Convenience hook for using confirmation dialogs
