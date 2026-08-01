import { Minus, Plus } from 'lucide-react'
import type { TeamScore } from '../types'

interface ScoreboardProps {
  teams: TeamScore[]
  onScore: (teamId: number, delta: number) => void
  compact?: boolean
}

export function Scoreboard({
  teams,
  onScore,
  compact = false,
}: ScoreboardProps) {
  const leader = Math.max(
    ...teams.map((team) => team.score),
  )

  return (
    <section
      className={`scoreboard ${
        compact ? 'scoreboard-master' : ''
      }`}
    >
      <div className="scoreboard-heading">
        <span className="scoreboard-live-dot" />
        LIVE SCORE
      </div>

      <div className="scoreboard-list">
        {teams.map((team) => (
          <div
            className={`score-row ${
              team.score === leader &&
              leader > 0
                ? 'is-leading'
                : ''
            }`}
            key={team.id}
          >
            <strong className="score-team-name">
              {team.name}
            </strong>

            <div className="score-number">
              <span className="score-number__value">
                {team.score}
              </span>

              <span className="score-number__unit">
                점
              </span>
            </div>

            <div className="score-actions">
              <button
                onClick={() =>
                  onScore(team.id, -10)
                }
                aria-label={`${team.name} 10점 빼기`}
              >
                <Minus size={15} />
              </button>

              <button
                onClick={() =>
                  onScore(team.id, 10)
                }
                aria-label={`${team.name} 10점 더하기`}
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
