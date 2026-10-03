import React, { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
    Award,
    Sparkles,
    Flame,
    ArrowRight,
    Trophy,
    Star
} from 'lucide-react'
import { cn } from '@/lib/utils'
import i18n from '@/i18n/i18n'

interface PlayerCelebrationModalProps {
    isOpen: boolean
    onClose: () => void
    moduleTitle: string
    recipientName?: string
    score?: number | null
    passed?: boolean | null
    timeSpentSeconds?: number
    isRTL?: boolean
    onBackToDashboard: () => void
}

export function PlayerCelebrationModal({
    isOpen,
    onClose,
    moduleTitle,
    recipientName = 'Hospitality Professional',
    score,
    passed = true,
    timeSpentSeconds = 0,
    isRTL = false,
    onBackToDashboard
}: PlayerCelebrationModalProps) {
    const [cardTransform, setCardTransform] = useState('')
    const containerRef = useRef<HTMLDivElement | null>(null)

    // Gold particle burst on mount
    useEffect(() => {
        if (!isOpen) return

        // Lightweight CSS / Canvas particle explosion
        const canvas = document.createElement('canvas')
        canvas.id = 'celebration-gold-particles'
        canvas.style.position = 'fixed'
        canvas.style.inset = '0'
        canvas.style.width = '100vw'
        canvas.style.height = '100vh'
        canvas.style.pointerEvents = 'none'
        canvas.style.zIndex = '9999'
        document.body.appendChild(canvas)

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const particles: Array<{
            x: number
            y: number
            vx: number
            vy: number
            size: number
            color: string
            alpha: number
            rotation: number
            vRot: number
        }> = []

        const colors = ['#C9A54D', '#F59E0B', '#FDE047', '#E2E8F0', '#FFFFFF']

        for (let i = 0; i < 90; i++) {
            particles.push({
                x: canvas.width / 2 + (Math.random() - 0.5) * 200,
                y: canvas.height / 2 + (Math.random() - 0.5) * 100,
                vx: (Math.random() - 0.5) * 16,
                vy: (Math.random() - 0.8) * 18,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1,
                rotation: Math.random() * 360,
                vRot: (Math.random() - 0.5) * 10
            })
        }

        let animFrame: number
        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            let alive = false

            particles.forEach((p) => {
                p.x += p.vx
                p.y += p.vy
                p.vy += 0.35 // Gravity
                p.rotation += p.vRot
                p.alpha -= 0.008

                if (p.alpha > 0) {
                    alive = true
                    ctx.save()
                    ctx.globalAlpha = Math.max(0, p.alpha)
                    ctx.translate(p.x, p.y)
                    ctx.rotate((p.rotation * Math.PI) / 180)
                    ctx.fillStyle = p.color
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
                    ctx.restore()
                }
            })

            if (alive) {
                animFrame = requestAnimationFrame(render)
            } else {
                canvas.remove()
            }
        }

        animFrame = requestAnimationFrame(render)

        return () => {
            cancelAnimationFrame(animFrame)
            canvas.remove()
        }
    }, [isOpen])

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left - rect.width / 2
        const y = e.clientY - rect.top - rect.height / 2
        const rotX = -(y / (rect.height / 2)) * 10
        const rotY = (x / (rect.width / 2)) * 10
        setCardTransform(`perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.02, 1.02, 1.02)`)
    }

    const handleMouseLeave = () => {
        setCardTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)')
    }

    if (!isOpen) return null

    const timeSpentMinutes = Math.max(1, Math.round(timeSpentSeconds / 60))

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ds-ink/85 animate-in fade-in duration-300">
            <div
                ref={containerRef}
                className="w-full max-w-xl rounded-[8px] bg-ds-ink border border-ds-warning/40 p-6 md:p-8 shadow-2xl text-center relative overflow-hidden"
            >
                {/* Background Ambient Glow */}
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-ds-warning/20 rounded-full blur-3xl pointer-events-none" />

                {/* Top Badge */}
                <div className="flex justify-center mb-4">
                    <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-ds-warning/20 border border-ds-warning/50 text-ds-warning text-xs font-bold uppercase tracking-widest shadow-lg">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>{i18n.t('training:screens.PlayerCelebrationModal.courseCompletedSuccessfully', 'Course Completed Successfully')}</span>
                    </div>
                </div>

                <h2 className="text-2xl md:text-3xl font-extrabold text-ds-on-ink mb-2 tracking-tight">
                    {i18n.t('training:screens.PlayerCelebrationModal.outstandingAchievement', 'Outstanding Achievement!')}
                </h2>
                <p className="text-sm text-ds-muted max-w-md mx-auto mb-6">
                    {isRTL
                        ? `لقد أتممت متطلبات دورة "${moduleTitle}" وتم توثيق شهادتك وساعاتك التدريبية في ملفك المهني.`
                        : `You have successfully completed "${moduleTitle}". Your certificate and training hours are officially logged.`}
                </p>

                {/* 3D Certificate Preview Card */}
                <div
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    style={{
                        transform: cardTransform,
                        transition: 'transform 0.15s ease-out'
                    }}
                    className="cursor-pointer mb-6 rounded-[8px] bg-ds-chrome border-2 border-ds-warning/60 p-6 text-ds-on-ink shadow-2xl relative group overflow-hidden"
                >
                    {/* Gold Foil Corner Accents */}
                    <div className="absolute top-0 start-0 w-8 h-8 border-t-2 border-s-2 border-ds-warning rounded-ss-xl m-2" />
                    <div className="absolute top-0 end-0 w-8 h-8 border-t-2 border-e-2 border-ds-warning rounded-se-xl m-2" />
                    <div className="absolute bottom-0 start-0 w-8 h-8 border-b-2 border-s-2 border-ds-warning rounded-es-xl m-2" />
                    <div className="absolute bottom-0 end-0 w-8 h-8 border-b-2 border-e-2 border-ds-warning rounded-ee-xl m-2" />

                    <div className="text-center space-y-2 py-2">
                        <div className="flex items-center justify-center gap-1.5 text-ds-warning text-xs font-semibold uppercase tracking-widest">
                            <Award className="h-4 w-4" />
                            <span>ALTUS ACADEMY • CERTIFICATE OF COMPLETION</span>
                        </div>
                        <h3 className="text-lg md:text-xl font-bold text-ds-on-ink tracking-wide">
                            {moduleTitle}
                        </h3>
                        <p className="text-xs text-ds-warning/90 font-medium">
                            {i18n.t('training:screens.PlayerCelebrationModal.awardedTo', 'Awarded to:')} <span className="text-ds-on-ink font-bold">{recipientName}</span>
                        </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-ds-warning/30 flex items-center justify-between text-xs text-ds-muted">
                        <span>{new Date().toLocaleDateString()}</span>
                        <div className="flex items-center gap-1 text-ds-warning font-bold">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            <span>{score !== null && score !== undefined ? `${score}% Score` : 'Certified'}</span>
                        </div>
                    </div>
                </div>

                {/* Stats Row (XP, Streak, Time) */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="p-3 rounded-[8px] bg-ds-ink/90 border border-ds-ink-secondary flex flex-col items-center justify-center">
                        <div className="flex items-center gap-1 text-ds-warning text-sm font-bold">
                            <Trophy className="h-4 w-4" />
                            <span>+50 XP</span>
                        </div>
                        <span className="text-[11px] text-ds-muted mt-0.5">{i18n.t('training:screens.PlayerCelebrationModal.earnedPoints', 'Earned Points')}</span>
                    </div>

                    <div className="p-3 rounded-[8px] bg-ds-ink/90 border border-ds-ink-secondary flex flex-col items-center justify-center">
                        <div className="flex items-center gap-1 text-ds-warning text-sm font-bold">
                            <Flame className="h-4 w-4 fill-current" />
                            <span>+1 Day</span>
                        </div>
                        <span className="text-[11px] text-ds-muted mt-0.5">{i18n.t('training:screens.PlayerCelebrationModal.learningStreak', 'Learning Streak')}</span>
                    </div>

                    <div className="p-3 rounded-[8px] bg-ds-ink/90 border border-ds-ink-secondary flex flex-col items-center justify-center">
                        <div className="text-ds-on-ink text-sm font-bold">
                            {timeSpentMinutes} {i18n.t('training:screens.PlayerCelebrationModal.min', 'min')}
                        </div>
                        <span className="text-[11px] text-ds-muted mt-0.5">{i18n.t('training:screens.PlayerCelebrationModal.timeInvested', 'Time Invested')}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button
                        size="lg"
                        onClick={onBackToDashboard}
                        className="w-full sm:w-auto px-6 bg-ds-ink hover:bg-ds-ink/90 text-ds-on-ink font-bold gap-2 shadow-lg"
                    >
                        <span>{i18n.t('training:screens.PlayerCelebrationModal.backToTrainingHub', 'Back to Training Hub')}</span>
                        <ArrowRight className={cn("h-4 w-4", isRTL && "rotate-180")} />
                    </Button>
                </div>
            </div>
        </div>
    )
}
