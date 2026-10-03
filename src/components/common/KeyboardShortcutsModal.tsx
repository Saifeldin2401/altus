import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Command } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

export function KeyboardShortcutsModal() {
    const [open, setOpen] = useState(false)
    const { t } = useTranslation('common')
    const navigate = useNavigate()

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement
            // Don't trigger if typing in an input or textarea
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

            // "?" key for help (Shift + /)
            if (e.key === '?') {
                e.preventDefault()
                setOpen(true)
            }

            // "n" key for new task
            if (e.key && e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault()
                navigate('/tasks?create=true')
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [navigate])

    const shortcuts = [
        { keys: ['⌘ / Ctrl', 'K'], action: t('shortcuts.command_palette', 'Command palette'), desc: 'Search everything quickly' },
        { keys: ['/'], action: t('shortcuts.search', 'Search'), desc: 'Focus the search bar directly' },
        { keys: ['N'], action: t('shortcuts.new_task', 'New task'), desc: 'Create a new task instantly' },
        { keys: ['?'], action: t('shortcuts.help', 'Keyboard shortcuts'), desc: 'Show this shortcuts menu' },
    ]

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md bg-ds-surface border-ds-border">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold text-ds-ink">
                        <Command className="w-5 h-5 text-ds-ink" />
                        {t('shortcuts.title', 'Keyboard Shortcuts')}
                    </DialogTitle>
                    <DialogDescription className="text-ds-muted font-medium">
                        {t('shortcuts.desc', 'Boost your productivity with these quick keystrokes.')}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 mt-4">
                    {shortcuts.map((shortcut, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-[8px] bg-ds-surface-subtle hover:bg-ds-surface-subtle/80 border border-ds-border transition-colors group">
                            <div>
                                <div className="font-semibold text-ds-ink-secondary text-sm group-hover:text-ds-ink transition-colors">{shortcut.action}</div>
                                <div className="text-xs text-ds-muted">{shortcut.desc}</div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {shortcut.keys.map((key, j) => (
                                    <kbd key={j} className="h-7 min-w-7 px-2 inline-flex items-center justify-center font-sans font-bold text-[12px] text-ds-ink-secondary bg-ds-surface border border-ds-border rounded-md shadow-sm">
                                        {key}
                                    </kbd>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
}
