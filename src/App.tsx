import { useEffect, useMemo, useState } from 'react'
import { Grid3X3 } from 'lucide-react'
import { Header } from './components/Header'
import { Scoreboard } from './components/Scoreboard'
import { AdminPage } from './pages/AdminPage'
import { HomePage } from './pages/HomePage'
import { QuestionPage } from './pages/QuestionPage'
import type { QuizQuestion, Screen, TeamScore } from './types'
import { loadQuestions, saveQuestions } from './utils/questionStorage'

const PLAYED_STORAGE_KEY = 'biblebell-played-question-ids'

const initialTeams: TeamScore[] = [
  { id: 1, name: '1조', score: 0 },
  { id: 2, name: '2조', score: 0 },
  { id: 3, name: '3조', score: 0 },
  { id: 4, name: '4조', score: 0 },
]

function getInitialScreen(): Screen {
  return window.location.pathname === '/admin'
    ? { name: 'admin' }
    : { name: 'home' }
}

function loadPlayedQuestionIds(): string[] {
  try {
    const saved = window.localStorage.getItem(PLAYED_STORAGE_KEY)

    if (!saved) {
      return []
    }

    const parsed = JSON.parse(saved)

    return Array.isArray(parsed)
      ? parsed
      : []
  } catch {
    return []
  }
}

export default function App() {
  const [screen, setScreen] =
    useState<Screen>(getInitialScreen)

  const [showAnswer, setShowAnswer] =
    useState(false)

  const [teams, setTeams] =
    useState<TeamScore[]>(initialTeams)

  const [
    quizQuestions,
    setQuizQuestions,
  ] = useState<QuizQuestion[]>(
    loadQuestions,
  )

  const [
    playedQuestionIds,
    setPlayedQuestionIds,
  ] = useState<string[]>(
    loadPlayedQuestionIds,
  )

  const selectedQuestion = useMemo(() => {
    if (screen.name !== 'question') {
      return null
    }

    return (
      quizQuestions.find(
        (question) =>
          question.id === screen.questionId,
      ) ?? null
    )
  }, [quizQuestions, screen])

  useEffect(() => {
    const handlePopState = () => {
      setScreen(getInitialScreen())
      setShowAnswer(false)
    }

    window.addEventListener(
      'popstate',
      handlePopState,
    )

    return () =>
      window.removeEventListener(
        'popstate',
        handlePopState,
      )
  }, [])

  useEffect(() => {
    window.localStorage.setItem(
      PLAYED_STORAGE_KEY,
      JSON.stringify(
        playedQuestionIds,
      ),
    )
  }, [playedQuestionIds])

  const goHome = () => {
    window.history.pushState(
      {},
      '',
      '/',
    )

    setScreen({ name: 'home' })
    setShowAnswer(false)
  }

  const goAdmin = () => {
    window.history.pushState(
      {},
      '',
      '/admin',
    )

    setScreen({ name: 'admin' })
    setShowAnswer(false)
  }

  const selectQuestion = (
    questionId: string,
  ) => {
    setPlayedQuestionIds(
      (current) =>
        current.includes(questionId)
          ? current
          : [...current, questionId],
    )

    setScreen({
      name: 'question',
      questionId,
    })

    setShowAnswer(false)
  }

  const changeScore = (
    teamId: number,
    delta: number,
  ) => {
    setTeams((current) =>
      current.map((team) =>
        team.id === teamId
          ? {
              ...team,
              score: Math.max(
                0,
                team.score + delta,
              ),
            }
          : team,
      ),
    )
  }

  const resetGame = () => {
    if (
      window.confirm(
        '모든 조의 점수와 출제 상태를 초기화할까요?',
      )
    ) {
      setTeams(initialTeams)
      setPlayedQuestionIds([])

      window.localStorage.removeItem(
        PLAYED_STORAGE_KEY,
      )

      goHome()
    }
  }

  const handleSaveQuestions = (
    nextQuestions: QuizQuestion[],
  ) => {
    setQuizQuestions(nextQuestions)
    saveQuestions(nextQuestions)
  }

  if (screen.name === 'home') {
    return (
      <HomePage
        questions={quizQuestions}
        playedQuestionIds={
          playedQuestionIds
        }
        teams={teams}
        onSelect={selectQuestion}
        onScore={changeScore}
        onAdmin={goAdmin}
        onReset={resetGame}
      />
    )
  }

  if (screen.name === 'admin') {
    return (
      <div className="app-shell admin-shell">
        <Header
          onHome={goHome}
          onAdmin={goAdmin}
          onReset={resetGame}
        />

        <div className="admin-scroll-area">
          <AdminPage
            questions={quizQuestions}
            onSave={handleSaveQuestions}
            onBack={goHome}
          />
        </div>
      </div>
    )
  }

  const currentScore =
    selectedQuestion?.score ?? 0

  return (
    <div className="app-shell event-shell">
      <Header
        onHome={goHome}
        onAdmin={goAdmin}
        onReset={resetGame}
      />

      <div className="event-layout">
        <section className="event-content">
          {selectedQuestion && (
            <QuestionPage
              key={selectedQuestion.id}
              question={selectedQuestion}
              showAnswer={showAnswer}
              onToggleAnswer={() =>
                setShowAnswer(
                  (value) => !value,
                )
              }
              onBack={goHome}
              onHome={goHome}
            />
          )}
        </section>

        <aside className="event-sidebar">
          <Scoreboard
            teams={teams}
            onScore={changeScore}
            compact
          />

          <section className="current-score">
            <span>현재 문제 점수</span>

            <div>
              <strong>
                {currentScore || '—'}
              </strong>

              <em>
                {currentScore ? '점' : ''}
              </em>
            </div>
          </section>

          <button
            className="board-button"
            onClick={goHome}
          >
            <Grid3X3 size={22} />
            문제판
          </button>
        </aside>
      </div>
    </div>
  )
}
