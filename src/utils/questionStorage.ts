import { questions as seedQuestions } from '../data/questions'
import type { QuizQuestion } from '../types'
import { storePortableAsset, writePortableAssetToLinkedFolder } from './portableData'

const STORAGE_KEY = 'biblebell-questions-json'
const USER_DATA_KEY = 'biblebell-user-data-active'
const FIXED_SCORES = [10,10,20,20,30,30,40,40,50,50] as const
const EXPECTED_QUESTION_COUNT = 100
export function getFixedScore(number: number): number { return FIXED_SCORES[number - 1] ?? 10 }

function normalizeQuestion(question: Omit<QuizQuestion, 'score'> & Partial<Pick<QuizQuestion, 'score'>>): QuizQuestion {
  const type = question.type ?? 'general'
  const hasChoices = Array.isArray(question.choices) && question.choices.length > 0
  const answerType = question.answerType === 'multiple' || hasChoices ? 'multiple' : 'short'
  return {
    ...question,
    type,
    answerType,
    score: getFixedScore(question.number),
    choices: answerType === 'multiple' && Array.isArray(question.choices) ? question.choices.slice(0, 4) : undefined,
    questionImageUrl: question.questionImageUrl ?? ((type === 'image' || type === 'person' || type === 'hidden') ? question.mediaUrl : undefined),
  }
}

function isStaticHostedMode() {
  return window.location.hostname.endsWith('github.io')
}

function safeExtension(filename: string, contentType = '') {
  const match = filename.toLowerCase().match(/(\.[a-z0-9]{1,8})$/)
  if (match) return match[1]
  const byType: Record<string, string> = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp',
    'video/mp4': '.mp4', 'video/webm': '.webm',
    'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/mp4': '.m4a',
  }
  return byType[contentType] ?? '.bin'
}

function canonicalMediaUrl(questionId: string, kind: 'questionImage'|'answerImage'|'video'|'audio', filename: string, contentType: string) {
  const directory = kind === 'questionImage' || kind === 'answerImage' ? 'images' : kind === 'video' ? 'videos' : 'audio'
  const suffix = kind === 'questionImage' ? 'question' : kind === 'answerImage' ? 'answer' : kind
  const ext = safeExtension(filename, contentType)
  return `/BibleBell/content/media/${directory}/${questionId}-${suffix}${ext}`
}

export function loadQuestions(): QuizQuestion[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return seedQuestions.map(normalizeQuestion)
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) && parsed.length === EXPECTED_QUESTION_COUNT
      ? parsed.map(normalizeQuestion)
      : seedQuestions.map(normalizeQuestion)
  } catch { return seedQuestions.map(normalizeQuestion) }
}

export async function loadQuestionsFromProject(): Promise<QuizQuestion[]> {
  // GitHub 공개웹에서 사용자가 자기 문제를 저장한 뒤에는
  // 새 배포가 올라와도 개인 데이터를 공개 샘플 100문제로 덮어쓰지 않습니다.
  if (isStaticHostedMode() && window.localStorage.getItem(USER_DATA_KEY) === '1') {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
      if (Array.isArray(saved) && saved.length === EXPECTED_QUESTION_COUNT) {
        return saved.map(normalizeQuestion)
      }
    } catch { /* 공개 샘플로 복구 */ }
  }

  let parsed: unknown = null

  try {
    const apiResponse = await fetch('/BibleBell/api/questions', { cache: 'no-store' })
    if (apiResponse.ok) parsed = await apiResponse.json()
  } catch {
    // GitHub Pages에서는 API가 없으므로 정적 공개 데이터를 사용합니다.
  }

  if (!Array.isArray(parsed) || parsed.length !== EXPECTED_QUESTION_COUNT) {
    const publicUrl = `${import.meta.env.BASE_URL}content/questions.json`
    const staticResponse = await fetch(publicUrl, { cache: 'no-store' })
    if (!staticResponse.ok) throw new Error('공개용 문제 파일을 읽지 못했습니다.')
    parsed = await staticResponse.json()
  }

  if (!Array.isArray(parsed) || parsed.length !== EXPECTED_QUESTION_COUNT) {
    throw new Error(`questions.json은 정확히 ${EXPECTED_QUESTION_COUNT}문제여야 합니다.`)
  }

  const normalized = (parsed as QuizQuestion[]).map(normalizeQuestion)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export function saveQuestions(questions: QuizQuestion[]): void {
  const normalized = questions.map(normalizeQuestion)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  if (isStaticHostedMode()) window.localStorage.setItem(USER_DATA_KEY, '1')

  void fetch('/BibleBell/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalized),
  }).then(async (response) => {
    if (response.ok) return
    if (isStaticHostedMode()) return
    let message = '저장 실패'
    try {
      const result = await response.json()
      message = result.message ?? message
    } catch { /* ignore */ }
    throw new Error(message)
  }).catch((error) => {
    if (isStaticHostedMode()) return
    console.error(error)
    window.alert(`프로젝트 파일 저장 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
  })
}

export async function uploadProjectAsset(questionId: string, kind: 'questionImage'|'answerImage'|'video'|'audio', file: Blob, filename: string): Promise<string> {
  let savedUrl = canonicalMediaUrl(questionId, kind, filename, file.type)

  try {
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

    if (response.ok) {
      const result = await response.json()
      if (result.url) savedUrl = result.url
    } else if (!isStaticHostedMode()) {
      let message = '미디어 저장 실패'
      try {
        const result = await response.json()
        message = result.message ?? message
      } catch { /* ignore */ }
      throw new Error(message)
    }
  } catch (error) {
    if (!isStaticHostedMode()) throw error
  }

  // 웹 배포에서는 실제 파일을 브라우저 저장소에 보관하고,
  // Excel에는 로컬 컴퓨터 경로가 아닌 동일한 규칙의 상대 URL만 기록합니다.
  await storePortableAsset(savedUrl, file)
  await writePortableAssetToLinkedFolder(savedUrl, file)
  return savedUrl
}
