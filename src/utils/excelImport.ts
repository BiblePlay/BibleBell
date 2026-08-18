import * as XLSX from 'xlsx'
import type { AnswerType, CategoryId, QuestionType, QuizQuestion } from '../types'

const answerMarks = ['①', '②', '③', '④']
const CATEGORY_ORDER: CategoryId[] = [
  'hidden', 'memory', 'ox', 'sermon', 'surprise',
  'joseph', 'character', 'initial', 'bible', 'teacher',
]
const CATEGORY_LABELS: Record<string, CategoryId> = {
  hidden: 'hidden', 숨은그림: 'hidden',
  memory: 'memory', 말씀암송: 'memory',
  ox: 'ox', OX: 'ox',
  sermon: 'sermon', '지난 설교': 'sermon', 지난설교: 'sermon',
  surprise: 'surprise', 돌발퀴즈: 'surprise',
  joseph: 'joseph', 요셉스토리: 'joseph',
  character: 'character', 인물퀴즈: 'character',
  initial: 'initial', 초성퀴즈: 'initial',
  bible: 'bible', 성경상식: 'bible',
  teacher: 'teacher', 선생님퀴즈: 'teacher',
}
const QUESTION_TYPES = new Set<QuestionType>(['general', 'ox', 'image', 'person', 'video', 'hidden'])
const ANSWER_TYPES = new Set<AnswerType>(['short', 'multiple'])

function getText(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim()
    }
  }
  return ''
}

function getOptionalText(row: Record<string, unknown>, ...keys: string[]) {
  const value = getText(row, ...keys)
  return value || undefined
}

function parseBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || String(value).trim() === '') return undefined
  const normalized = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'y', '예', '사용', '표시', 'o'].includes(normalized)) return true
  if (['false', '0', 'no', 'n', '아니오', '미사용', '숨김', 'x'].includes(normalized)) return false
  return undefined
}

function formatAnswer(answer: string, choices: string[]) {
  if (!answer) return ''
  if (/^[①②③④]\s*/.test(answer)) return answer

  const index = choices.findIndex((choice) => choice === answer)
  return index >= 0 ? `${answerMarks[index]} ${answer}` : answer
}

function parseCategory(value: string): CategoryId {
  const category = CATEGORY_LABELS[value] ?? CATEGORY_LABELS[value.toLowerCase()]
  if (!category) throw new Error(`알 수 없는 카테고리: ${value || '(빈칸)'}`)
  return category
}

function parseQuestionType(value: string): QuestionType {
  const normalized = (value || 'general').toLowerCase() as QuestionType
  if (!QUESTION_TYPES.has(normalized)) {
    throw new Error(`알 수 없는 문제유형: ${value}`)
  }
  return normalized
}

function parseAnswerType(value: string): AnswerType {
  const normalized = (value || 'short').toLowerCase() as AnswerType
  if (!ANSWER_TYPES.has(normalized)) {
    throw new Error(`알 수 없는 답변유형: ${value}`)
  }
  return normalized
}

function makeQuestionId(categoryId: CategoryId, number: number) {
  const categoryIndex = CATEGORY_ORDER.indexOf(categoryId)
  return `Q${String(categoryIndex * 10 + number).padStart(3, '0')}`
}

export function importQuestionsFromExcel(file: File): Promise<QuizQuestion[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
          .filter((row) => Object.values(row).some((value) => String(value ?? '').trim() !== ''))

        if (rows.length !== 100) {
          throw new Error(`엑셀에는 정확히 100문제가 있어야 합니다. 현재 ${rows.length}개입니다.`)
        }

        const seen = new Set<string>()
        const questions = rows.map((row): QuizQuestion => {
          const categoryId = parseCategory(getText(row, '카테고리'))
          const number = Number(getText(row, '번호'))

          if (!Number.isInteger(number) || number < 1 || number > 10) {
            throw new Error(`${categoryId} 카테고리의 문제번호는 1~10이어야 합니다: ${getText(row, '번호') || '(빈칸)'}`)
          }

          const key = `${categoryId}:${number}`
          if (seen.has(key)) throw new Error(`중복된 문제 위치가 있습니다: ${categoryId} ${number}번`)
          seen.add(key)

          const choices = [
            getText(row, '보기1'),
            getText(row, '보기2'),
            getText(row, '보기3'),
            getText(row, '보기4'),
          ].filter(Boolean)

          const type = parseQuestionType(getText(row, '문제유형', '문제 유형'))
          const answerType = parseAnswerType(getText(row, '답변유형', '답변 유형'))

          return {
            id: makeQuestionId(categoryId, number),
            categoryId,
            number,
            type,
            answerType,
            question: getText(row, '문제'),
            answer: formatAnswer(getText(row, '정답'), choices),
            choices: answerType === 'multiple' && choices.length ? choices.slice(0, 4) : undefined,
            score: Number(getText(row, '점수')) || 10,
            hint: getOptionalText(row, '힌트'),
            explanation: getOptionalText(row, '설명', '해설'),
            mediaUrl: getOptionalText(row, '미디어', '영상'),
            questionImageUrl: getOptionalText(row, '문제이미지'),
            answerImageUrl: getOptionalText(row, '정답이미지'),
            hiddenShowText: parseBoolean(row['숨은그림텍스트표시'] ?? row['텍스트표시']),
          }
        })

        for (const categoryId of CATEGORY_ORDER) {
          for (let number = 1; number <= 10; number += 1) {
            if (!seen.has(`${categoryId}:${number}`)) {
              throw new Error(`빠진 문제 위치가 있습니다: ${categoryId} ${number}번`)
            }
          }
        }

        // Excel에서 필터/정렬한 채 저장해도 프로그램에서는 항상 원래 10×10 위치로 복원합니다.
        questions.sort((a, b) => {
          const categoryDiff = CATEGORY_ORDER.indexOf(a.categoryId) - CATEGORY_ORDER.indexOf(b.categoryId)
          return categoryDiff || a.number - b.number
        })

        resolve(questions)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
