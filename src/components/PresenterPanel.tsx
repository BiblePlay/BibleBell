import {
  CheckCircle2,
  Clock3,
  Eye,
  Flag,
  Music2,
  VolumeX,
  Sparkles,
  XCircle,
} from 'lucide-react'
import type { TeamScore } from '../types'

interface PresenterPanelProps {
  open: boolean
  teams: TeamScore[]
  selectedTeamId: number
  timerSeconds: number
  soundEnabled: boolean
  effectEnabled: boolean
  onSelectTeam: (teamId: number) => void
  onReveal: () => void
  onCorrect: () => void
  onWrong: () => void
  onStartTimer: () => void
  onTimerSeconds: (seconds: number) => void
  onToggleSound: () => void
  onToggleEffect: () => void
  onFinish: () => void
}

export function PresenterPanel({
  open,
  teams,
  selectedTeamId,
  timerSeconds,
  soundEnabled,
  effectEnabled,
  onSelectTeam,
  onReveal,
  onCorrect,
  onWrong,
  onStartTimer,
  onTimerSeconds,
  onToggleSound,
  onToggleEffect,
  onFinish,
}: PresenterPanelProps) {
  if (!open) return null

  return (
    <aside className="presenter-panel" aria-label="진행자 메뉴">
      <header>
        <div>
          <span>PRESENTER</span>
          <strong>진행자 메뉴</strong>
        </div>
        <small>Esc 닫기</small>
      </header>

      <section>
        <label>점수 반영 팀</label>
        <div className="presenter-team-grid">
          {teams.map((team) => (
            <button
              key={team.id}
              className={selectedTeamId === team.id ? 'is-selected' : ''}
              onClick={() => onSelectTeam(team.id)}
            >
              {team.name}
            </button>
          ))}
        </div>
      </section>

      <section className="presenter-action-grid">
        <button onClick={onReveal}>
          <Eye size={18} />
          정답 공개
        </button>
        <button className="is-correct" onClick={onCorrect}>
          <CheckCircle2 size={18} />
          정답·점수
        </button>
        <button className="is-wrong" onClick={onWrong}>
          <XCircle size={18} />
          오답
        </button>
      </section>

      <section>
        <label>타이머</label>
        <div className="presenter-timer-row">
          {[10, 15, 20, 30].map((seconds) => (
            <button
              key={seconds}
              className={timerSeconds === seconds ? 'is-selected' : ''}
              onClick={() => onTimerSeconds(seconds)}
            >
              {seconds}초
            </button>
          ))}
          <button className="timer-start" onClick={onStartTimer}>
            <Clock3 size={17} />
            시작
          </button>
        </div>
      </section>

      <section className="presenter-toggle-row">
        <button onClick={onToggleSound}>
          {soundEnabled ? <Music2 size={18} /> : <VolumeX size={18} />}
          효과음 {soundEnabled ? 'ON' : 'OFF'}
        </button>
        <button onClick={onToggleEffect}>
          <Sparkles size={18} />
          효과 {effectEnabled ? 'ON' : 'OFF'}
        </button>
      </section>

      <button className="presenter-finish" onClick={onFinish}>
        <Flag size={18} />
        게임 종료 화면
      </button>

      <footer>
        <span>Space 정답</span>
        <span>Enter 점수</span>
        <span>T 타이머</span>
        <span>← → 문제 이동</span>
      </footer>
    </aside>
  )
}