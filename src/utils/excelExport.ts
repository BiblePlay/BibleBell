import * as XLSX from 'xlsx'
import type { QuizQuestion } from '../types'

function createRows(questions: QuizQuestion[]) {
  return questions.map((q) => ({
    번호: q.number,
    카테고리: q.categoryId,
    문제유형: q.type ?? 'general',
    답변유형: q.answerType ?? 'short',
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
    숨은그림텍스트표시: q.hiddenShowText ? 'TRUE' : 'FALSE',
  }))
}

export function createQuestionsWorkbook(questions: QuizQuestion[]) {
  const rows = createRows(questions)
  const worksheet = XLSX.utils.json_to_sheet(rows)

  // Excel에서 바로 필터/정렬할 수 있도록 헤더에 AutoFilter를 넣습니다.
  if (worksheet['!ref']) worksheet['!autofilter'] = { ref: worksheet['!ref'] }
  worksheet['!cols'] = [
    { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 46 }, { wch: 30 },
    { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 },
    { wch: 8 }, { wch: 30 }, { wch: 40 },
    { wch: 38 }, { wch: 38 }, { wch: 38 }, { wch: 18 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '문제목록')
  return workbook
}

export function createQuestionsExcelBlob(questions: QuizQuestion[]): Blob {
  const workbook = createQuestionsWorkbook(questions)
  const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function exportQuestionsToExcel(questions: QuizQuestion[]) {
  const workbook = createQuestionsWorkbook(questions)
  XLSX.writeFile(workbook, '도전바이블골든벨_문제목록.xlsx')
}
