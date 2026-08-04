import * as XLSX from 'xlsx'
import type { QuizQuestion } from '../types'

const answerMarks = ['①', '②', '③', '④']

function getText(
  row: Record<string, unknown>,
  key: string,
) {
  return String(row[key] ?? '').trim()
}

function formatAnswer(
  answer: string,
  choices: string[],
) {
  if (!answer) return ''

  const index = choices.findIndex(
    (choice) => choice === answer,
  )

  if (index >= 0) {
    return `${answerMarks[index]} ${answer}`
  } 
 return answer
}

export function importQuestionsFromExcel(
  file: File,
): Promise<QuizQuestion[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      try {
        const workbook = XLSX.read(
          reader.result,
          {
            type: 'array',
          },
        )

        const sheet =
          workbook.Sheets[
            workbook.SheetNames[0]
          ]

        const rows =
          XLSX.utils.sheet_to_json<
            Record<string, unknown>
          >(sheet, {
            defval: '',
          })

console.log('엑셀 행 개수:', rows.length)
const categoryCount: Record<string, number> = {}

 const questions = rows.map(
          (row, index): QuizQuestion => {          const choices = [
            getText(row, '보기1'),
            getText(row, '보기2'),
            getText(row, '보기3'),
            getText(row, '보기4'),
          ].filter(Boolean)

          return {
            id:
              getText(row, 'ID') ||
              `excel-${index + 1}`,

            categoryId:
              getText(row, '카테고리') as QuizQuestion['categoryId'],

number:
  (categoryCount[getText(row, '카테고리')] =
    (categoryCount[getText(row, '카테고리')] || 0) + 1),
            type:
              getText(row, '문제 유형') as QuizQuestion['type'],

            question:
              getText(row, '문제'),

            answer:
              formatAnswer(
                getText(row, '정답'),
                choices,
              ),

            choices:
              choices.length
                ? choices
                : undefined,

            score:
              Number(row['점수']) || 10,
            hint:
              getText(row, '힌트'),

            explanation:
              getText(row, '해설'),

            mediaUrl:
              getText(row, '영상'),

            questionImageUrl:
              getText(row, '문제이미지'),

            answerImageUrl:
              getText(row, '정답이미지'),
          }
        },
      )

      resolve(questions)
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = reject

      reader.readAsArrayBuffer(file)
    },
  )
}

