import * as XLSX from 'xlsx'
import type { QuizQuestion } from '../types'

export function exportQuestionsToExcel(
  questions: QuizQuestion[],
) {
  const rows = questions.map((q) => ({
    번호: q.number,
    카테고리: q.categoryId,
    문제유형: q.type ?? '',
    답변유형: q.answerType ?? '',
    문제: q.question,
    정답: q.answer,
    보기1: q.choices?.[0] ?? '',
    보기2: q.choices?.[1] ?? '',
    보기3: q.choices?.[2] ?? '',
    보기4: q.choices?.[3] ?? '',
    점수: q.score,
    힌트: q.hint ?? '',
    설명: q.explanation ?? '',
    문제이미지: q.questionImageUrl ?? '',
    정답이미지: q.answerImageUrl ?? '',
    미디어: q.mediaUrl ?? '',
  }))

  const worksheet =
    XLSX.utils.json_to_sheet(rows)

  const workbook =
    XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    '문제목록',
  )

  XLSX.writeFile(
    workbook,
    '도전바이블골든벨_문제목록.xlsx',
  )
}
