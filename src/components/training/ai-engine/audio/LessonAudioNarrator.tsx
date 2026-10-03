import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Volume2,
  Play,
  Pause,
  Gauge,
} from 'lucide-react'
import { audioSynthesisEngine, type AudioLanguage } from '@/lib/ai/audio/audioSynthesisEngine'
import { cn } from '@/lib/utils'

interface LessonAudioNarratorProps {
  lessonTitle: string
  lessonContent: string
  className?: string
}

export function LessonAudioNarrator({
  lessonTitle,
  lessonContent,
  className,
}: LessonAudioNarratorProps) {
  const { t, i18n } = useTranslation('training')
  const isRTL = i18n.dir() === 'rtl'

  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0)
  const [selectedLanguage, setSelectedLanguage] = useState<AudioLanguage>(
    isRTL ? 'ar-SA' : 'en-US'
  )

  useEffect(() => {
    return () => {
      audioSynthesisEngine.stopSpeech()
    }
  }, [])

  const handleTogglePlay = () => {
    if (isPlaying) {
      audioSynthesisEngine.stopSpeech()
      setIsPlaying(false)
    } else {
      setIsPlaying(true)
      const fullNarration = `${lessonTitle}. \n\n ${lessonContent}`
      audioSynthesisEngine.playNativeSpeech(
        fullNarration,
        selectedLanguage,
        playbackSpeed,
        () => setIsPlaying(false)
      )
    }
  }

  const cycleSpeed = () => {
    const nextSpeed = playbackSpeed === 1.0 ? 1.25 : playbackSpeed === 1.25 ? 1.5 : 1.0
    setPlaybackSpeed(nextSpeed)
    if (isPlaying) {
      audioSynthesisEngine.stopSpeech()
      const fullNarration = `${lessonTitle}. \n\n ${lessonContent}`
      audioSynthesisEngine.playNativeSpeech(
        fullNarration,
        selectedLanguage,
        nextSpeed,
        () => setIsPlaying(false)
      )
    }
  }

  const toggleLanguage = () => {
    const nextLang: AudioLanguage = selectedLanguage === 'ar-SA' ? 'en-US' : 'ar-SA'
    setSelectedLanguage(nextLang)
    if (isPlaying) {
      audioSynthesisEngine.stopSpeech()
      setIsPlaying(false)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 p-2.5 px-3 rounded-[8px] border border-ds-border bg-ds-surface-subtle/80 shadow-xs',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-ds-info/10 text-ds-info flex items-center justify-center">
          <Volume2 className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-ds-ink">
              {t('audio.narratorTitle', 'AI Audio Briefing')}
            </span>
            <Badge variant="outline" className="text-[11px] font-semibold bg-ds-surface px-1 py-0 text-ds-info border-ds-info/30">
              {selectedLanguage === 'ar-SA' ? '🇸🇦 Saudi Voice' : '🇬🇧 UK English'}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isPlaying
              ? t('audio.playing', 'Playing audio narration...')
              : t('audio.listenBriefing', 'Listen to lesson summary & SOP points')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Speed Toggle */}
        <Button
          size="sm"
          variant="ghost"
          onClick={cycleSpeed}
          className="h-7 text-[11px] font-semibold px-1.5"
          title="Playback speed"
        >
          <Gauge className="w-3 h-3 me-1" />
          <span>{playbackSpeed}x</span>
        </Button>

        {/* Language Dialect Switcher */}
        <Button
          size="sm"
          variant="ghost"
          onClick={toggleLanguage}
          className="h-7 text-[11px] font-semibold px-2"
        >
          <span>{selectedLanguage === 'ar-SA' ? 'AR' : 'EN'}</span>
        </Button>

        {/* Play/Pause Button */}
        <Button
          size="sm"
          onClick={handleTogglePlay}
          className={cn(
            'h-7 text-xs px-3 font-semibold text-white shadow-xs gap-1',
            isPlaying ? 'bg-ds-ink hover:bg-ds-ink/90' : 'bg-ds-info hover:bg-ds-info'
          )}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span>{t('audio.pause', 'Pause')}</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>{t('audio.play', 'Play Audio')}</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
