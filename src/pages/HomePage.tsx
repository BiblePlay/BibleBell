import {
  Download,
  FolderOpen,
  Maximize2,
  RotateCcw,
  Settings,
} from 'lucide-react'
import { useEffect, useState } from 'react'
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
  onInstallApp: () => void
  installHelpText: string
  onCloseInstallHelp: () => void
  onChooseDataFolder: () => Promise<boolean>
  dataFolderLinked: boolean | null
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
  onInstallApp,
  installHelpText,
  onCloseInstallHelp,
  onChooseDataFolder,
  dataFolderLinked,
}: HomePageProps) {
  const [showSetupGuide, setShowSetupGuide] = useState(false)

  useEffect(() => {
    if (dataFolderLinked === false && window.sessionStorage.getItem('biblebell-setup-guide-dismissed') !== '1') {
      setShowSetupGuide(true)
    }
    if (dataFolderLinked === true) setShowSetupGuide(false)
  }, [dataFolderLinked])
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      return
    }

    await document.exitFullscreen()
  }

  return (
    <main className="master-screen">
      {installHelpText && (
        <div className="master-setup-overlay" role="dialog" aria-modal="true" aria-label="BibleBell 앱 설치 안내">
          <section className="master-setup-card">
            <div className="master-setup-icon"><Download size={30} /></div>
            <div>
              <span className="master-setup-kicker">앱 설치</span>
              <h2>BibleBell을 앱처럼 실행하세요.</h2>
              <p>{installHelpText}</p>
              <p className="master-setup-note">설치 가능한 브라우저에서는 앱 설치 버튼을 누르면 공식 설치창이 바로 열립니다. 브라우저가 자동 설치창을 제공하지 않을 때만 이 안내가 표시됩니다.</p>
            </div>
            <div className="master-setup-actions">
              <button className="master-setup-primary" onClick={onCloseInstallHelp}>확인</button>
            </div>
          </section>
        </div>
      )}

      {showSetupGuide && (
        <div className="master-setup-overlay" role="dialog" aria-modal="true" aria-label="BibleBell 처음 사용 안내">
          <section className="master-setup-card">
            <div className="master-setup-icon"><FolderOpen size={30} /></div>
            <div>
              <span className="master-setup-kicker">처음 사용 안내</span>
              <h2>내 BibleBell 저장 위치를 정해 주세요.</h2>
              <p>
                문제 수정 내용은 브라우저에도 저장됩니다. 하지만 그림·동영상까지 다른 컴퓨터로 옮기려면
                <b> BibleBell_Data</b> 폴더가 필요합니다. 원하는 위치만 선택하면 BibleBell이 그 안에 폴더를 자동으로 만듭니다.
              </p>
              <p className="master-setup-note">
                나중에 관리자 모드에서 저장 위치를 바꿀 수 있고, 작업 후 <b>데이터 보내기</b>를 누르면 Excel과 미디어가 함께 정리됩니다.
              </p>
            </div>
            <div className="master-setup-actions">
              <button
                className="master-setup-primary"
                onClick={async () => {
                  const ok = await onChooseDataFolder()
                  if (ok) setShowSetupGuide(false)
                }}
              >
                저장 폴더 지정
              </button>
              <button
                className="master-setup-secondary"
                onClick={() => {
                  window.sessionStorage.setItem('biblebell-setup-guide-dismissed', '1')
                  setShowSetupGuide(false)
                }}
              >
                나중에
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="master-board-panel">
        <header className="master-board-titlebar">
          <div className="master-board-title">
            <span>도전 바이블</span>
            <strong>골든벨</strong>
          </div>

          <div className="master-title-actions">
            <button
              className="master-admin-button master-install-button"
              onClick={onInstallApp}
              title="BibleBell을 컴퓨터에 앱처럼 설치"
            >
              <Download size={18} />
              앱 설치
            </button>

            <button
              className="master-admin-button"
              onClick={onAdmin}
            >
              <Settings size={18} />
              관리자 모드
            </button>
          </div>
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
