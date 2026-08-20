import { useEffect, useMemo, useState } from 'react'
import { Grid3X3 } from 'lucide-react'
import { Header } from './components/Header'
import { Scoreboard } from './components/Scoreboard'
import { AdminPage } from './pages/AdminPage'
import { HomePage } from './pages/HomePage'
import { QuestionPage } from './pages/QuestionPage'
import type { QuizQuestion, Screen, TeamScore } from './types'
import { loadQuestions, loadQuestionsFromProject, saveQuestions } from './utils/questionStorage'
import {
  getPortableDataFolderInfo,
  requestPersistentBrowserStorage,
  selectPortableDataLocation,
  supportsPortableFolder,
} from './utils/portableData'
import { createDesktopShortcut } from './utils/desktopShortcut'

const PLAYED_STORAGE_KEY = 'biblebell-played-question-ids'
const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '')

const initialTeams: TeamScore[] = [
  { id: 1, name: '1조', score: 0 },
  { id: 2, name: '2조', score: 0 },
  { id: 3, name: '3조', score: 0 },
  { id: 4, name: '4조', score: 0 },
]

function getInitialScreen(): Screen {
  const pathname = window.location.pathname
  return pathname === `${BASE_PATH}/admin` || pathname === '/admin'
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

  const [dataFolderLinked, setDataFolderLinked] =
    useState<boolean | null>(null)

  const [shortcutHelpText, setShortcutHelpText] = useState('')

  const refreshDataFolderLink = async () => {
    const info = await getPortableDataFolderInfo()
    setDataFolderLinked(info.linked)
  }

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
    void requestPersistentBrowserStorage()
    if (supportsPortableFolder()) {
      void refreshDataFolderLink()
    } else {
      setDataFolderLinked(null)
    }
  }, [])

  useEffect(() => {
    let active = true
    void loadQuestionsFromProject()
      .then((items) => {
        if (active) setQuizQuestions(items)
      })
      .catch((error) => {
        console.error(error)
      })
    return () => { active = false }
  }, [])

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
      `${BASE_PATH}/`,
    )

    setScreen({ name: 'home' })
    setShowAnswer(false)
    if (supportsPortableFolder()) void refreshDataFolderLink()
  }

  const goAdmin = () => {
    window.history.pushState(
      {},
      '',
      `${BASE_PATH}/admin`,
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

  const makeBibleBellShortcut = () => {
    try {
      const result = createDesktopShortcut()
      setShortcutHelpText(
        result.platform === 'mac'
          ? `${result.fileName} 파일을 만들었습니다. 다운로드된 BibleGoldenBell을 데스크탑으로 옮겨 두면 더블클릭으로 BibleBell을 바로 열 수 있습니다.`
          : `${result.fileName} 파일을 만들었습니다. 다운로드된 BibleGoldenBell을 바탕화면으로 옮겨 두면 더블클릭으로 BibleBell을 바로 열 수 있습니다.`,
      )
    } catch (error) {
      console.error(error)
      setShortcutHelpText('바로가기 파일을 만들지 못했습니다. 브라우저의 다운로드 허용 상태를 확인한 뒤 다시 눌러 주세요.')
    }
  }

  const chooseDataFolder = async (): Promise<boolean> => {
    if (!supportsPortableFolder()) {
      window.alert('이 브라우저는 폴더 저장 기능을 지원하지 않습니다. Chrome, Edge, Whale 같은 Chromium 계열 데스크톱 브라우저에서 사용해 주세요.')
      return false
    }
    try {
      const result = await selectPortableDataLocation(quizQuestions)
      setDataFolderLinked(true)
      window.alert(`${result.folderName} 저장 위치가 준비되었습니다. 선택한 위치 안에 BibleBell_Data가 자동으로 만들어졌습니다. 이후 관리자 모드의 “전체 데이터 저장”으로 Excel과 미디어를 최신 상태로 보관하세요.`)
      return true
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return false
      console.error(error)
      window.alert(error instanceof Error ? error.message : '저장 위치 지정에 실패했습니다.')
      return false
    }
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
        onCreateShortcut={makeBibleBellShortcut}
        shortcutHelpText={shortcutHelpText}
        onCloseShortcutHelp={() => setShortcutHelpText('')}
        onChooseDataFolder={chooseDataFolder}
        dataFolderLinked={dataFolderLinked}
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
