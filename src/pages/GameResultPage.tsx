import { RotateCcw } from 'lucide-react'
import type { TeamScore } from '../types'

interface GameResultPageProps {
  teams: TeamScore[]
  onHome: () => void
}

const medals = ['🥇', '🥈', '🥉', '4']

export function GameResultPage({
  teams,
  onHome,
}: GameResultPageProps) {
  const ranked = [...teams].sort((a, b) => b.score - a.score)

  return (
    <main className="result-page">
      <div className="result-kicker">FINAL RESULT</div>
      <h1>도전 바이블 골든벨</h1>

      <section className="result-ranking">
        {ranked.map((team, index) => (
          <article
            className={`result-rank result-rank-${index + 1}`}
            key={team.id}
            style={{ animationDelay: `${index * 140}ms` }}
          >
            <span className="result-medal">{medals[index]}</span>
            <strong>{team.name}</strong>
            <div>
              <b>{team.score}</b>
              <em>점</em>
            </div>
          </article>
        ))}
      </section>

      <button onClick={onHome}>
        <RotateCcw size={20} />
        문제판으로
      </button>
    </main>
  )
}
