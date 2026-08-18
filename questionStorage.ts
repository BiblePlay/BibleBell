import { questions as seedQuestions } from '../data/questions'
import type { QuizQuestion } from '../types'

const STORAGE_KEY = 'biblebell-questions-json'
const FIXED_SCORES = [10,10,20,20,30,30,40,40,50,50] as const
const EXPECTED_QUESTION_COUNT = 100
export function getFixedScore(number: number): number { return FIXED_SCORES[number - 1] ?? 10 }

function normalizeQuestion(question: Omit<QuizQuestion, 'score'> & Partial<Pick<QuizQuestion, 'score'>>): QuizQuestion {
  const type = question.type ?? 'general'
  const choices = Array.isArray(question.choices)
    ? question.choices.map((choice) => String(choice ?? '').trim()).filter(Boolean).slice(0, 4)
    : []
  // 과거 데이터에서 answerType이 빠져 있어도 보기 데이터가 있으면 객관식으로 복구합니다.
  const answerType = question.answerType === 'multiple' || choices.length > 0
    ? 'multiple'
    : 'short'

  return {
    ...question,
    type,
    answerType,
    score: getFixedScore(question.number),
    choices: choices.length > 0 ? choices : undefined,
    questionImageUrl: question.questionImageUrl ?? ((type === 'image' || type === 'person' || type === 'hidden') ? question.mediaUrl : undefined),
  }
}

export function loadQuestions(): QuizQuestion[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return seedQuestions.map(normalizeQuestion)
    const parsed = JSON.parse(saved)
    // 이전 GitHub 시연본의 50문제 localStorage가 남아 있어도 최종 100문제 seed로 자동 복구합니다.
    return Array.isArray(parsed) && parsed.length === EXPECTED_QUESTION_COUNT
      ? parsed.map(normalizeQuestion)
      : seedQuestions.map(normalizeQuestion)
  } catch { return seedQuestions.map(normalizeQuestion) }
}

export async function loadQuestionsFromProject(): Promise<QuizQuestion[]> {
  // 로컬에서는 Vite API를 우선 사용하고, GitHub Pages 같은 정적 웹에서는
  // public/content/questions.json으로 자동 폴백합니다.
  const sources = [
    '/BibleBell/api/questions',
    '/BibleBell/content/questions.json',
  ]

  let lastError: unknown = null

  for (const source of sources) {
    try {
      const response = await fetch(source, { cache: 'no-store' })
      if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`)

      const parsed = await response.json()
      if (!Array.isArray(parsed) || parsed.length !== EXPECTED_QUESTION_COUNT) {
        throw new Error(`${source}: questions.json은 정확히 ${EXPECTED_QUESTION_COUNT}문제여야 합니다.`)
      }

      const normalized = parsed.map(normalizeQuestion)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
      return normalized
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('프로젝트 문제 파일을 읽지 못했습니다.')
}

export function saveQuestions(questions: QuizQuestion[]): void {
  const normalized = questions.map(normalizeQuestion)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  void fetch('/BibleBell/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalized),
  }).then(async (response) => {
    if (!response.ok) throw new Error((await response.json()).message ?? '저장 실패')
  }).catch((error) => {
    console.error(error)
    window.alert(`프로젝트 파일 저장 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
  })
}

export async function uploadProjectAsset(questionId: string, kind: 'questionImage'|'answerImage'|'video'|'audio', file: Blob, filename: string): Promise<string> {
  const response = await fetch('/BibleBell/api/media', {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-Question-Id': questionId,
      'X-Asset-Kind': kind,
      'X-File-Name': encodeURIComponent(filename),
    },
    body: file,
  })
  const result = await response.json()
  if (!response.ok || !result.url) throw new Error(result.message ?? '미디어 저장 실패')
  return result.url
}
