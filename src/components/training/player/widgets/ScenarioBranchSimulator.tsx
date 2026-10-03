import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    CheckCircle2,
    XCircle,
    RotateCcw,
    Award,
    Sparkles,
    AlertCircle,
    UserCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import i18n from '@/i18n/i18n'

interface ScenarioOption {
    id: string
    text: string
    text_ar?: string
    isBestChoice: boolean
    feedback: string
    feedback_ar?: string
    pointsAwarded?: number
}

interface ScenarioBranchSimulatorProps {
    title?: string
    scenarioText: string
    scenarioText_ar?: string
    guestRole?: string
    options: ScenarioOption[]
    isRTL?: boolean
}

export function ScenarioBranchSimulator({
    title,
    scenarioText,
    scenarioText_ar,
    guestRole,
    options,
    isRTL = false
}: ScenarioBranchSimulatorProps) {
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
    const [isSubmitted, setIsSubmitted] = useState(false)

    const handleSelect = (id: string) => {
        if (isSubmitted) return
        setSelectedOptionId(id)
        setIsSubmitted(true)
    }

    const handleReset = () => {
        setSelectedOptionId(null)
        setIsSubmitted(false)
    }

    const chosenOption = options.find(o => o.id === selectedOptionId)
    const displayText = isRTL && scenarioText_ar ? scenarioText_ar : scenarioText

    return (
        <div className="my-6 rounded-[8px] bg-ds-ink border border-ds-warning/30 p-6 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-[8px] bg-ds-warning/20 border border-ds-warning/40 flex items-center justify-center text-ds-warning">
                        <UserCheck className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-ds-on-ink">
                                {title || (i18n.t('training:screens.ScenarioBranchSimulator.hotelScenarioDecisionSimulator', 'Hotel Scenario Decision Simulator'))}
                            </h4>
                            <Badge className="bg-ds-warning/20 text-ds-warning border-ds-warning/40 text-[11px]">
                                {guestRole || (i18n.t('training:screens.ScenarioBranchSimulator.frontlineScenario', 'Frontline Scenario'))}
                            </Badge>
                        </div>
                        <p className="text-[11px] text-ds-muted">
                            {i18n.t('training:screens.ScenarioBranchSimulator.chooseTheBest5Star', 'Choose the best 5-star service standard response')}
                        </p>
                    </div>
                </div>

                {isSubmitted && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        className="h-8 px-2 text-xs text-ds-muted hover:text-ds-on-ink gap-1"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>{i18n.t('training:screens.ScenarioBranchSimulator.tryAgain', 'Try Again')}</span>
                    </Button>
                )}
            </div>

            {/* Scenario Narrative Box */}
            <div className="rounded-[8px] bg-ds-ink/90 border border-ds-ink-secondary p-4 text-sm text-ds-on-ink leading-relaxed relative">
                <div className="text-[11px] font-semibold tracking-wider uppercase text-ds-warning/90 mb-1.5 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    <span>{i18n.t('training:screens.ScenarioBranchSimulator.situationBrief', 'Situation Brief')}</span>
                </div>
                <p className="text-ds-on-ink">{displayText}</p>
            </div>

            {/* Decision Choices */}
            <div className="space-y-2.5">
                <span className="text-xs font-semibold text-ds-muted">
                    {i18n.t('training:screens.ScenarioBranchSimulator.whatIsYourImmediateCourse', 'What is your immediate course of action?')}
                </span>

                {options.map((opt, idx) => {
                    const isSelected = selectedOptionId === opt.id
                    const showCorrect = isSubmitted && opt.isBestChoice
                    const showWrong = isSubmitted && isSelected && !opt.isBestChoice
                    const optText = isRTL && opt.text_ar ? opt.text_ar : opt.text

                    return (
                        <button
                            key={opt.id}
                            disabled={isSubmitted}
                            onClick={() => handleSelect(opt.id)}
                            className={cn(
                                "w-full text-start p-4 rounded-[8px] border transition-all text-xs md:text-sm flex items-start gap-3 relative group",
                                !isSubmitted && "bg-ds-ink/60 border-ds-ink-secondary hover:border-ds-warning/50 hover:bg-ds-ink text-ds-on-ink cursor-pointer active:scale-[0.99]",
                                showCorrect && "bg-ds-success/20 border-ds-success text-ds-success shadow-lg",
                                showWrong && "bg-ds-danger/20 border-ds-danger text-ds-danger",
                                isSubmitted && !isSelected && !opt.isBestChoice && "opacity-40 border-ds-ink-secondary bg-ds-ink"
                            )}
                        >
                            <span className={cn(
                                "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                                showCorrect
                                    ? "bg-ds-success text-ds-ink"
                                    : showWrong
                                        ? "bg-ds-danger text-ds-on-ink"
                                        : "bg-ds-ink text-ds-muted group-hover:bg-ds-on-ink/15"
                            )}>
                                {showCorrect ? <CheckCircle2 className="h-4 w-4" /> : showWrong ? <XCircle className="h-4 w-4" /> : String.fromCharCode(65 + idx)}
                            </span>

                            <div className="flex-1">
                                <p className="leading-relaxed font-medium">{optText}</p>
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* Explanation & Feedback Card */}
            {isSubmitted && chosenOption && (
                <div
                    className={cn(
                        "rounded-[8px] p-4 border animate-in fade-in slide-in-from-top-2 duration-300 text-xs md:text-sm leading-relaxed",
                        chosenOption.isBestChoice
                            ? "bg-ds-success/20 border-ds-success/60 text-ds-success"
                            : "bg-ds-warning/20 border-ds-warning/60 text-ds-warning"
                    )}
                >
                    <div className="flex items-center gap-2 font-bold mb-1.5">
                        {chosenOption.isBestChoice ? (
                            <>
                                <Award className="h-4 w-4 text-ds-success" />
                                <span>{i18n.t('training:screens.ScenarioBranchSimulator.excellentChoice5StarStandard', 'Excellent Choice! 5-Star Standard (+15 XP)')}</span>
                            </>
                        ) : (
                            <>
                                <AlertCircle className="h-4 w-4 text-ds-warning" />
                                <span>{i18n.t('training:screens.ScenarioBranchSimulator.coachingFeedbackBestPractice', 'Coaching Feedback & Best Practice:')}</span>
                            </>
                        )}
                    </div>
                    <p className="whitespace-pre-wrap">
                        {isRTL && chosenOption.feedback_ar ? chosenOption.feedback_ar : chosenOption.feedback}
                    </p>
                </div>
            )}
        </div>
    )
}
