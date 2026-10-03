/**
 * SectionLinkButton - Copy link to specific section
 * 
 * Adds a clickable link icon next to headings that copies
 * a deep-link URL to that specific section.
 */

import { cn } from '@/lib/utils'
import { Check, Link2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface SectionLinkButtonProps {
    sectionId: string
    className?: string
}

export function SectionLinkButton({ sectionId, className }: SectionLinkButtonProps) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        const url = `${window.location.origin}${window.location.pathname}#${sectionId}`

        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            toast.success('Section link copied to clipboard')
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Fallback
            const textarea = document.createElement('textarea')
            textarea.value = url
            textarea.style.position = 'fixed'
            textarea.style.opacity = '0'
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand('copy')
            document.body.removeChild(textarea)
            setCopied(true)
            toast.success('Section link copied to clipboard')
            setTimeout(() => setCopied(false), 2000)
        }
    }

    return (
        <button
            onClick={handleCopy}
            className={cn(
                "inline-flex items-center justify-center ms-2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200",
                "text-ds-muted hover:text-ds-info hover:bg-ds-info-soft",
                copied && "text-ds-success bg-ds-success-soft",
                className
            )}
            title={copied ? "Copied!" : "Copy link to this section"}
        >
            {copied ? (
                <Check className="w-4 h-4" />
            ) : (
                <Link2 className="w-4 h-4" />
            )}
        </button>
    )
}

export default SectionLinkButton
