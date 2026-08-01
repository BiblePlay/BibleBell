import type { CSSProperties } from 'react'
import type { Category, QuizQuestion } from '../types'

interface CategoryCardProps {
  category: Category
  questions: QuizQuestion[]
  playedQuestionIds: string[]
  onSelect: (questionId: string) => void
}

const SLOT_NUMBERS = Array.from({ length: 10 }, (_, index) => index + 1)

export function CategoryCard({
  category,
  questions,
  playedQuestionIds,
  onSelect,
}: CategoryCardProps) {
  return (
    <article
      className="category-card"
      style={{ '--accent': category.accent } as CSSProperties}
    >
      <div className="category-glow" />

      <div className="category-head">
        <div className="category-icon">{category.icon}</div>
        <div>
          <h2>{category.title}</h2>
          <p>{category.subtitle}</p>
        </div>
      </div>

      <div className="number-row number-row-ten">
        {SLOT_NUMBERS.map((number) => {
          const question = questions.find((item) => item.number === number)
          const isPlayed = question
            ? playedQuestionIds.includes(question.id)
            : false

          return (
            <button
              key={number}
              className={[
                'number-button',
                isPlayed ? 'is-played' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={!question}
              onClick={() => question && onSelect(question.id)}
              title={
                question
                  ? `${number}번 · ${question.score}점`
                  : `${number}번 문제 미등록`
              }
            >
              <strong>{number}</strong>
              {question && <span>{question.score}점</span>}
            </button>
          )
        })}
      </div>
    </article>
  )
}
