import { Crown, Maximize2, RotateCcw, Settings } from 'lucide-react'

interface HeaderProps {
  onHome: () => void
  onAdmin: () => void
  onReset: () => void
}

export function Header({ onHome, onAdmin, onReset }: HeaderProps) {
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }

  return (
    <header className="topbar">
      <button className="brand" onClick={onHome}>
        <span className="brand-mark">
          <Crown size={20} />
        </span>
        <span>
          도전 <strong>바이블</strong> 골든벨
        </span>
      </button>

      <div className="topbar-actions">
        <button className="icon-button" onClick={onAdmin} title="관리자 페이지">
          <Settings size={19} />
        </button>

        <button className="icon-button" onClick={onReset} title="점수 초기화">
          <RotateCcw size={19} />
        </button>

        <button className="icon-button" onClick={toggleFullscreen} title="전체화면">
          <Maximize2 size={19} />
        </button>
      </div>
    </header>
  )
}
