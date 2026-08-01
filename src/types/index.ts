export type CategoryId =
  | 'hidden' | 'memory' | 'ox' | 'sermon' | 'surprise'
  | 'joseph' | 'character' | 'initial' | 'bible' | 'teacher'

export type QuestionType =
  | 'general' | 'ox' | 'image' | 'person' | 'video' | 'hidden'

export type AnswerType = 'short' | 'multiple'

export interface Category {
  id: CategoryId
  title: string
  subtitle: string
  icon: string
  accent: string
}

export interface QuizQuestion {
  id: string
  categoryId: CategoryId
  number: number
  type?: QuestionType
  answerType?: AnswerType
  question: string
  answer: string
  choices?: string[]
  score: number
  hint?: string
  explanation?: string
  mediaUrl?: string
  questionImageUrl?: string
  answerImageUrl?: string
}

export interface TeamScore {
  id: number
  name: string
  score: number
}

export type Screen =
  | { name: 'home' }
  | { name: 'question'; questionId: string }
  | { name: 'admin' }
