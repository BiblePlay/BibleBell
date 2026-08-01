import {
  Maximize2,
  RotateCcw,
  Settings,
} from 'lucide-react'
import { Scoreboard } from '../components/Scoreboard'
import { categories } from '../data/categories'
import masterLogo from '../assets/master-logo.png'
import { getFixedScore } from '../utils/questionStorage'
import type {
  QuizQuestion,
  TeamScore,
} from '../types'
import '../styles/home-master.css'

interface HomePageProps {
  questions: QuizQuestion[]
  playedQuestionIds: string[]
  teams: TeamScore[]
  onSelect: (questionId: string) => void
  onScore: (teamId: number, delta: number) => void
  onAdmin: () => void
  onReset: () => void
}

const SLOT_NUMBERS = Array.from(
  { length: 10 },
  (_, index) => index + 1,
)

export function HomePage({
  questions,
  playedQuestionIds,
  teams,
  onSelect,
  onScore,
  onAdmin,
  onReset,
}: HomePageProps) {
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      return
    }

    await document.exitFullscreen()
  }

  return (
    <main className="master-screen">
      <section className="master-board-panel">
        <header className="master-board-titlebar">
          <div className="master-board-title">
            <span>도전 바이블</span>
            <strong>골든벨</strong>
          </div>

          <button
            className="master-admin-button"
            onClick={onAdmin}
          >
            <Settings size={18} />
            관리자 모드
          </button>
        </header>

        <div className="master-board-grid">
          <div className="master-column-head master-category-head" />

          {SLOT_NUMBERS.map((number) => (
            <div
              className="master-column-head"
              key={number}
            >
              {number}
            </div>
          ))}

          {categories.slice(0, 10).map((category) => {
            const categoryQuestions = questions.filter(
              (question) =>
                question.categoryId === category.id,
            )

            return (
              <div
                className="master-board-row"
                key={category.id}
              >
                <div className="master-category-cell">
                  <strong>{category.title}</strong>
                  <span>
                    {category.icon} 10 문제
                  </span>
                </div>

                {SLOT_NUMBERS.map((number) => {
                  const question =
                    categoryQuestions.find(
                      (item) =>
                        item.number === number,
                    )

                  const isPlayed = question
                    ? playedQuestionIds.includes(
                        question.id,
                      )
                    : false

                  const score =
                    getFixedScore(number)

                  return (
                    <button
                      key={number}
                      className={[
                        'master-score-cell',
                        isPlayed
                          ? 'is-played'
                          : '',
                        !question
                          ? 'is-empty'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      disabled={!question}
                      onClick={() =>
                        question &&
                        onSelect(question.id)
                      }
                      title={
                        question
                          ? `${category.title} ${number}번 · ${score}점`
                          : `${category.title} ${number}번 미등록`
                      }
                    >
                      {question ? score : '—'}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        <footer className="master-board-footer">
          <div className="master-footer-actions">
            <button onClick={onReset}>
              <RotateCcw size={19} />
              전체 초기화
            </button>

            <button onClick={toggleFullscreen}>
              <Maximize2 size={19} />
              전체화면
            </button>
          </div>
        </footer>
      </section>

      <aside className="master-sidebar master-sidebar-home">
        <section className="master-logo-panel">
          <img
            src={masterLogo}
            alt="도전 바이블 골든벨"
          />
        </section>

        <Scoreboard
          teams={teams}
          onScore={onScore}
          compact
        />
      </aside>
    </main>
  )
}
