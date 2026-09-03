import { useEffect, useRef } from 'react'
import {
  ARENA_W,
  ARENA_H,
  MERGE_DIST,
  WIN_THRESHOLD,
  createEntities,
  aliveEntities,
  pickCalledNumber,
  assignScrambleTargets,
  stepFreeWalk,
  stepScramble,
  applyJudgement,
  computeClusters,
  roundTimeLimit,
} from './engine.js'

const PHASE_BANNER = {
  round_start: (s) => `라운드 ${s.round}`,
  free_walk: () => '다함께 차차차~ 🎵',
  call: (s) => `${s.calledNumber}명!`,
  scramble: () => null,
  judge: (s) => s.judgeText,
}

export default function Game({ botCount, onGameOver }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const inputRef = useRef({ left: false, right: false, up: false, down: false, pointer: null })
  const stateRef = useRef(null)

  useEffect(() => {
    const entities = createEntities(botCount)
    stateRef.current = {
      entities,
      round: 1,
      phase: 'round_start',
      phaseTime: 0,
      calledNumber: null,
      timeLeft: 0,
      judgeText: '',
      finished: false,
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    function toCanvasCoords(clientX, clientY) {
      const rect = canvas.getBoundingClientRect()
      return {
        x: ((clientX - rect.left) / rect.width) * ARENA_W,
        y: ((clientY - rect.top) / rect.height) * ARENA_H,
      }
    }

    function onKeyDown(e) {
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
        a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' }
      const key = map[e.key]
      if (key) {
        inputRef.current[key] = true
        e.preventDefault()
      }
    }
    function onKeyUp(e) {
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
        a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' }
      const key = map[e.key]
      if (key) {
        inputRef.current[key] = false
        e.preventDefault()
      }
    }
    function onPointerDown(e) {
      inputRef.current.pointer = toCanvasCoords(e.clientX, e.clientY)
    }
    function onPointerMove(e) {
      if (inputRef.current.pointer) {
        inputRef.current.pointer = toCanvasCoords(e.clientX, e.clientY)
      }
    }
    function onPointerUp() {
      inputRef.current.pointer = null
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    function startFreeWalk(s) {
      s.phase = 'free_walk'
      s.phaseTime = 0
    }
    function startCall(s) {
      s.phase = 'call'
      s.phaseTime = 0
      const alive = aliveEntities(s.entities).length
      s.calledNumber = pickCalledNumber(alive)
      assignScrambleTargets(s.entities, s.calledNumber)
    }
    function startScramble(s) {
      s.phase = 'scramble'
      s.phaseTime = 0
      s.timeLeft = roundTimeLimit(s.round)
    }
    function startJudge(s) {
      s.phase = 'judge'
      s.phaseTime = 0
      const result = applyJudgement(s.entities, s.calledNumber)
      const now = performance.now()
      result.eliminatedIds.forEach((id) => {
        const e = s.entities.find((en) => en.id === id)
        if (e) e.deathAnim = now
      })
      const player = s.entities.find((e) => e.isPlayer)
      if (result.eliminatedIds.has(player.id)) {
        s.judgeText = '탈락…'
      } else if (result.survivedIds.has(player.id)) {
        s.judgeText = '생존!'
      } else {
        s.judgeText = ''
      }
    }
    function finishRoundOrContinue(s) {
      const player = s.entities.find((e) => e.isPlayer)
      const aliveCount = aliveEntities(s.entities).length
      if (!player.alive) {
        s.phase = 'gameover'
        s.finished = true
        onGameOver({ win: false, round: s.round, alive: aliveCount })
        return
      }
      if (aliveCount <= WIN_THRESHOLD) {
        s.phase = 'gameover'
        s.finished = true
        onGameOver({ win: true, round: s.round, alive: aliveCount })
        return
      }
      s.round += 1
      s.phase = 'round_start'
      s.phaseTime = 0
    }

    let last = performance.now()
    function loop(ts) {
      const dt = Math.min((ts - last) / 1000, 0.05)
      last = ts
      const s = stateRef.current
      s.phaseTime += dt

      switch (s.phase) {
        case 'round_start':
          if (s.phaseTime > 0.9) startFreeWalk(s)
          break
        case 'free_walk':
          stepFreeWalk(s.entities, dt, inputRef.current)
          if (s.phaseTime > 1.4) startCall(s)
          break
        case 'call':
          if (s.phaseTime > 0.9) startScramble(s)
          break
        case 'scramble':
          stepScramble(s.entities, dt, inputRef.current)
          s.timeLeft -= dt
          if (s.timeLeft <= 0) startJudge(s)
          break
        case 'judge':
          if (s.phaseTime > 1.5) finishRoundOrContinue(s)
          break
        default:
          break
      }

      draw(ctx, s)
      if (import.meta.env.DEV) window.__chacha = s
      if (!s.finished) {
        rafRef.current = requestAnimationFrame(loop)
      }
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botCount])

  return (
    <canvas
      ref={canvasRef}
      width={ARENA_W}
      height={ARENA_H}
      className="game-canvas"
    />
  )
}

function draw(ctx, s) {
  ctx.clearRect(0, 0, ARENA_W, ARENA_H)

  // floor
  const grad = ctx.createRadialGradient(
    ARENA_W / 2, ARENA_H / 2, 40,
    ARENA_W / 2, ARENA_H / 2, ARENA_W / 1.2,
  )
  grad.addColorStop(0, '#2a1e4d')
  grad.addColorStop(1, '#140d29')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, ARENA_W, ARENA_H)

  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 2
  ctx.strokeRect(6, 6, ARENA_W - 12, ARENA_H - 12)

  // live cluster hints during scramble
  if (s.phase === 'scramble') {
    const clusters = computeClusters(s.entities, MERGE_DIST)
    clusters.forEach((group) => {
      if (group.length < 2) return
      const cx = group.reduce((a, e) => a + e.x, 0) / group.length
      const cy = group.reduce((a, e) => a + e.y, 0) / group.length
      let maxR = 0
      group.forEach((e) => {
        maxR = Math.max(maxR, Math.hypot(e.x - cx, e.y - cy))
      })
      const ok = group.length === s.calledNumber
      ctx.beginPath()
      ctx.arc(cx, cy, maxR + 26, 0, Math.PI * 2)
      ctx.strokeStyle = ok ? 'rgba(74,222,128,0.9)' : 'rgba(148,163,184,0.5)'
      ctx.setLineDash([6, 6])
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = ok ? '#4ade80' : '#cbd5e1'
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${group.length}`, cx, cy - maxR - 34)
    })
  }

  const now = performance.now()
  s.entities.forEach((e) => {
    let alpha = 1
    let r = e.radius
    if (!e.alive) {
      if (!e.deathAnim) return
      const t = (now - e.deathAnim) / 700
      if (t >= 1) return
      alpha = 1 - t
      r = e.radius * (1 - t * 0.6)
    }
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2)
    ctx.fillStyle = e.color
    ctx.fill()
    if (e.isPlayer) {
      ctx.lineWidth = 3
      ctx.strokeStyle = '#fff'
      ctx.stroke()
    }
    ctx.fillStyle = '#111827'
    ctx.font = e.isPlayer ? 'bold 13px sans-serif' : '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(e.label, e.x, e.y + 1)
    ctx.globalAlpha = 1
  })

  // HUD
  const aliveCount = aliveEntities(s.entities).length
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#e5e7eb'
  ctx.font = 'bold 16px sans-serif'
  ctx.fillText(`라운드 ${s.round}`, 16, 28)
  ctx.fillText(`생존 ${aliveCount}명`, 16, 50)

  if (s.phase === 'scramble') {
    const barW = 260
    const pct = Math.max(0, s.timeLeft / roundTimeLimit(s.round))
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(ARENA_W - barW - 16, 16, barW, 14)
    ctx.fillStyle = pct < 0.3 ? '#ef4444' : '#22c55e'
    ctx.fillRect(ARENA_W - barW - 16, 16, barW * pct, 14)
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.strokeRect(ARENA_W - barW - 16, 16, barW, 14)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#e5e7eb'
    ctx.font = 'bold 14px sans-serif'
    ctx.fillText(`${s.calledNumber}명 모여라!`, ARENA_W - barW - 16, 48)
  }

  const bannerFn = PHASE_BANNER[s.phase]
  const banner = bannerFn ? bannerFn(s) : null
  if (banner) {
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = s.phase === 'call' ? 'bold 72px sans-serif' : 'bold 40px sans-serif'
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.strokeText(banner, ARENA_W / 2, ARENA_H / 2 - 40)
    ctx.fillStyle = s.phase === 'judge'
      ? (s.judgeText === '탈락…' ? '#f87171' : '#4ade80')
      : '#fde047'
    ctx.fillText(banner, ARENA_W / 2, ARENA_H / 2 - 40)
    ctx.restore()
  }
}
