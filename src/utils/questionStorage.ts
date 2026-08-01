import { questions as seedQuestions } from '../data/questions'
import type { QuizQuestion } from '../types'

const STORAGE_KEY = 'biblebell-questions-json'

const FIXED_SCORES = [
  10, 10,
  20, 20,
  30, 30,
  40, 40,
  50, 50,
] as const

export function getFixedScore(number: number): number {
  return FIXED_SCORES[number - 1] ?? 10
}

function normalizeQuestion(
  question: Omit<QuizQuestion, 'score'> &
    Partial<Pick<QuizQuestion, 'score'>>,
): QuizQuestion {
  const type = question.type ?? 'general'

  return {
    ...question,
    type,
    answerType: question.answerType ?? 'short',
    score: getFixedScore(question.number),
    choices:
      question.answerType === 'multiple' &&
      Array.isArray(question.choices)
        ? question.choices.slice(0, 4)
        : undefined,
    questionImageUrl:
      question.questionImageUrl ??
      ((type === 'image' ||
        type === 'person' ||
        type === 'hidden')
        ? question.mediaUrl
        : undefined),
  }
}

export function loadQuestions(): QuizQuestion[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)

    if (!saved) {
      return seedQuestions.map(normalizeQuestion)
    }

    const parsed = JSON.parse(saved)

    return Array.isArray(parsed)
      ? parsed.map(normalizeQuestion)
      : seedQuestions.map(normalizeQuestion)
  } catch {
    return seedQuestions.map(normalizeQuestion)
  }
}

export function saveQuestions(
  questions: QuizQuestion[],
): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(questions.map(normalizeQuestion)),
  )
}
