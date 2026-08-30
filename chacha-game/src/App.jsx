import { useState } from 'react'
import Game from './game/Game.jsx'
import { WIN_THRESHOLD } from './game/engine.js'

const BOT_OPTIONS = [7, 9, 11, 13]

export default function App() {
  const [screen, setScreen] = useState('menu') // 'menu' | 'playing' | 'gameover'
  const [botCount, setBotCount] = useState(9)
  const [result, setResult] = useState(null)
  const [runId, setRunId] = useState(0)

  function startGame() {
    setResult(null)
    setRunId((id) => id + 1)
    setScreen('playing')
  }

  function handleGameOver(res) {
    setResult(res)
    setScreen('gameover')
  }

  return (
    <div className="app">
      <h1 className="title">다함께 차차차</h1>

      {screen === 'menu' && (
        <div className="panel">
          <p className="rules">
            음악에 맞춰 돌아다니다가 숫자가 불리면, 그 숫자만큼 <b>정확히</b> 무리를 지어야
            살아남습니다. 숫자보다 많거나 적은 무리는 전원 탈락!
            <br />
            생존자가 {WIN_THRESHOLD}명 이하로 줄어들면 승리합니다.
          </p>
          <div className="controls-hint">
            <div><b>이동</b>: 방향키 / WASD, 또는 화면을 터치·드래그</div>
          </div>
          <div className="bot-select">
            <span>참가 인원 (나 포함)</span>
            <div className="bot-options">
              {BOT_OPTIONS.map((n) => (
                <button
                  key={n}
                  className={n === botCount ? 'chip active' : 'chip'}
                  onClick={() => setBotCount(n)}
                >
                  {n + 1}명
                </button>
              ))}
            </div>
          </div>
          <button className="primary" onClick={startGame}>게임 시작</button>
        </div>
      )}

      {screen === 'playing' && (
        <div className="game-wrap">
          <Game key={runId} botCount={botCount} onGameOver={handleGameOver} />
        </div>
      )}

      {screen === 'gameover' && result && (
        <div className="panel result-panel">
          <h2 className={result.win ? 'win' : 'lose'}>
            {result.win ? '최종 생존 성공! 🎉' : '탈락했습니다 💀'}
          </h2>
          <p>
            {result.round}라운드까지 진행, 최종 {result.alive}명이 남았습니다.
          </p>
          <button className="primary" onClick={startGame}>다시 하기</button>
          <button className="secondary" onClick={() => setScreen('menu')}>메인으로</button>
        </div>
      )}
    </div>
  )
}
