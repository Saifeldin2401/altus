import type { TFunction } from 'i18next'

import type { QuestionDifficulty, QuestionStatus, QuestionType } from '@/types/questions'
import { DIFFICULTY_CONFIG, QUESTION_TYPE_CONFIG, STATUS_CONFIG } from '@/types/questions'

/** Translated labels for question type, difficulty and status (English defaults from types/questions). */
export function questionLabels(t: TFunction) {
  return {
    type: (type: QuestionType | string) =>
      t(`quizBank.type.${type}`, QUESTION_TYPE_CONFIG[type as QuestionType]?.label ?? String(type)),
    difficulty: (d: QuestionDifficulty | string) =>
      t(`quizBank.difficulty.${d}`, DIFFICULTY_CONFIG[d as QuestionDifficulty]?.label ?? String(d)),
    status: (s: QuestionStatus | string) =>
      t(`quizBank.status.${s}`, STATUS_CONFIG[s as QuestionStatus]?.label ?? String(s)),
  }
}
