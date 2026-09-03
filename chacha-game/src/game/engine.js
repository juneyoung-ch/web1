// Core game logic for "다함께 차차차" (all-together-cha-cha-cha).
// Kept framework-free so it can be driven from a plain requestAnimationFrame loop.

export const ARENA_W = 900
export const ARENA_H = 560
export const PLAYER_RADIUS = 15
export const MERGE_DIST = PLAYER_RADIUS * 2 + 10
export const PLAYER_SPEED = 250
export const WIN_THRESHOLD = 3 // game ends in a win once this many (or fewer) remain, including the player

const BOT_COLORS = [
  '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
  '#8b5cf6', '#ec4899', '#ef4444', '#14b8a6', '#a855f7',
  '#f43f5e', '#84cc16', '#0ea5e9', '#d946ef',
]

let idCounter = 0
function nextId() {
  idCounter += 1
  return idCounter
}

export function randRange(min, max) {
  return min + Math.random() * (max - min)
}

export function randInt(min, max) {
  return Math.floor(randRange(min, max + 1))
}

export function createEntities(botCount) {
  const entities = []
  entities.push({
    id: nextId(),
    isPlayer: true,
    x: ARENA_W / 2,
    y: ARENA_H / 2,
    vx: 0,
    vy: 0,
    radius: PLAYER_RADIUS,
    color: '#facc15',
    alive: true,
    label: '나',
    wanderTarget: null,
    groupAnchor: null,
    speed: PLAYER_SPEED,
  })
  for (let i = 0; i < botCount; i += 1) {
    entities.push({
      id: nextId(),
      isPlayer: false,
      x: randRange(PLAYER_RADIUS, ARENA_W - PLAYER_RADIUS),
      y: randRange(PLAYER_RADIUS, ARENA_H - PLAYER_RADIUS),
      vx: 0,
      vy: 0,
      radius: PLAYER_RADIUS,
      color: BOT_COLORS[i % BOT_COLORS.length],
      alive: true,
      label: `${i + 1}`,
      wanderTarget: null,
      groupAnchor: null,
      speed: randRange(170, 235),
    })
  }
  return entities
}

export function aliveEntities(entities) {
  return entities.filter((e) => e.alive)
}

export function pickCalledNumber(aliveCount) {
  // aliveCount includes the player. The number is always solvable (1..aliveCount-1).
  const max = Math.max(1, aliveCount - 1)
  if (max === 1) return 1
  // Bias away from the extremes a little so rounds feel varied.
  const roll = Math.random()
  if (roll < 0.15) return 1
  if (roll < 0.3) return max
  return randInt(2, max)
}

function randomArenaPoint(margin = 60) {
  return {
    x: randRange(margin, ARENA_W - margin),
    y: randRange(margin, ARENA_H - margin),
  }
}

// Plans where bots should huddle for the upcoming scramble phase.
// One group is deliberately left one member short of `calledNumber` -- the
// player's job is to find and complete it before time runs out.
export function assignScrambleTargets(entities, calledNumber) {
  const bots = aliveEntities(entities).filter((e) => !e.isPlayer)
  const player = entities.find((e) => e.isPlayer && e.alive)

  bots.forEach((b) => {
    b.groupAnchor = null
  })
  if (player) player.groupAnchor = null

  if (calledNumber === 1) {
    // Everyone should try to isolate themselves.
    const all = player ? [player, ...bots] : [...bots]
    all.forEach((e) => {
      e.groupAnchor = randomArenaPoint(70)
    })
    return
  }

  const pool = [...bots]
  // shuffle
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  const reservedCount = Math.min(calledNumber - 1, pool.length)
  const reserved = pool.splice(0, reservedCount)
  const openAnchor = randomArenaPoint()
  reserved.forEach((b) => {
    b.groupAnchor = openAnchor
  })
  if (player) player.groupAnchor = openAnchor // used only as a hint source, not autopilot

  let rest = pool
  while (rest.length >= calledNumber) {
    const group = rest.splice(0, calledNumber)
    const anchor = randomArenaPoint()
    group.forEach((b) => {
      b.groupAnchor = anchor
    })
  }
  // leftover bots (fewer than calledNumber) wander alone -- they're doomed this round.
  rest.forEach((b) => {
    b.groupAnchor = null
  })
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

function steerToward(entity, tx, ty, speed, dt, arrive = 8) {
  const dx = tx - entity.x
  const dy = ty - entity.y
  const dist = Math.hypot(dx, dy)
  if (dist < arrive) return
  const nx = dx / dist
  const ny = dy / dist
  entity.x += nx * speed * dt
  entity.y += ny * speed * dt
}

function movePlayerByInput(e, dt, playerInput) {
  let dx = 0
  let dy = 0
  if (playerInput.left) dx -= 1
  if (playerInput.right) dx += 1
  if (playerInput.up) dy -= 1
  if (playerInput.down) dy += 1
  if (playerInput.pointer) {
    const pdx = playerInput.pointer.x - e.x
    const pdy = playerInput.pointer.y - e.y
    const pd = Math.hypot(pdx, pdy)
    if (pd > 6) {
      dx = pdx / pd
      dy = pdy / pd
    }
  }
  const mag = Math.hypot(dx, dy)
  if (mag > 0) {
    e.x += (dx / mag) * e.speed * dt
    e.y += (dy / mag) * e.speed * dt
  }
}

export function stepFreeWalk(entities, dt, playerInput) {
  aliveEntities(entities).forEach((e) => {
    if (e.isPlayer) {
      movePlayerByInput(e, dt, playerInput)
      clampToArena(e)
      return
    }
    if (!e.wanderTarget || Math.hypot(e.wanderTarget.x - e.x, e.wanderTarget.y - e.y) < 10) {
      e.wanderTarget = randomArenaPoint(40)
    }
    steerToward(e, e.wanderTarget.x, e.wanderTarget.y, e.speed * 0.5, dt)
    clampToArena(e)
  })
}

export function stepScramble(entities, dt, playerInput) {
  aliveEntities(entities).forEach((e) => {
    if (e.isPlayer) {
      movePlayerByInput(e, dt, playerInput)
    } else if (e.groupAnchor) {
      const jitterX = (Math.random() - 0.5) * 14
      const jitterY = (Math.random() - 0.5) * 14
      steerToward(
        e,
        e.groupAnchor.x + jitterX * 0.15,
        e.groupAnchor.y + jitterY * 0.15,
        e.speed,
        dt,
        4,
      )
    } else {
      // leftover / loner bot: skitters around nervously
      if (!e.wanderTarget || Math.hypot(e.wanderTarget.x - e.x, e.wanderTarget.y - e.y) < 8) {
        e.wanderTarget = randomArenaPoint(40)
      }
      steerToward(e, e.wanderTarget.x, e.wanderTarget.y, e.speed * 0.7, dt)
    }
    clampToArena(e)
  })
}

function clampToArena(e) {
  e.x = clamp(e.x, e.radius, ARENA_W - e.radius)
  e.y = clamp(e.y, e.radius, ARENA_H - e.radius)
}

// Union-find clustering by proximity.
export function computeClusters(entities, mergeDist = MERGE_DIST) {
  const alive = aliveEntities(entities)
  const parent = new Map(alive.map((e) => [e.id, e.id]))
  function find(id) {
    while (parent.get(id) !== id) {
      parent.set(id, parent.get(parent.get(id)))
      id = parent.get(id)
    }
    return id
  }
  function union(a, b) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (let i = 0; i < alive.length; i += 1) {
    for (let j = i + 1; j < alive.length; j += 1) {
      const a = alive[i]
      const b = alive[j]
      if (Math.hypot(a.x - b.x, a.y - b.y) <= mergeDist) {
        union(a.id, b.id)
      }
    }
  }
  const groups = new Map()
  alive.forEach((e) => {
    const root = find(e.id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(e)
  })
  return [...groups.values()]
}

export function applyJudgement(entities, calledNumber) {
  const clusters = computeClusters(entities)
  const survivedIds = new Set()
  const eliminatedIds = new Set()
  clusters.forEach((group) => {
    if (group.length === calledNumber) {
      group.forEach((e) => survivedIds.add(e.id))
    } else {
      group.forEach((e) => eliminatedIds.add(e.id))
    }
  })
  eliminatedIds.forEach((id) => {
    const e = entities.find((en) => en.id === id)
    if (e) e.alive = false
  })
  return { survivedIds, eliminatedIds, clusters }
}

export function roundTimeLimit(round) {
  return Math.max(1.8, 6 - round * 0.3)
}
