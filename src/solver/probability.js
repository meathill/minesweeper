// 扫雷概率求解器：基于约束枚举 + 分量拆分 + 孤立格均摊
// 输入的 grid 为 App.vue 的 grid.value 数组，元素含 {isOpen,isFlag,count}
// 不依赖 isBomb（玩家视角），remainingMines 由 bombNumber - flagged 推导

function getNeighbors(index, row, column) {
  const x = index % column
  const y = (index / column) >> 0
  const out = []
  for (let i = Math.max(0, y - 1); i < Math.min(y + 2, row); i++) {
    for (let j = Math.max(0, x - 1); j < Math.min(x + 2, column); j++) {
      if (i === y && j === x) continue
      out.push(i * column + j)
    }
  }
  return out
}

function buildConstraints(grid, row, column) {
  const constraints = []
  for (let idx = 0; idx < grid.length; idx++) {
    const cell = grid[idx]
    if (!cell.isOpen || cell.count === 0) continue
    const neighbors = getNeighbors(idx, row, column)
    const unknown = []
    let flagged = 0
    for (const n of neighbors) {
      const c = grid[n]
      if (c.isFlag) flagged++
      else if (!c.isOpen) unknown.push(n)
    }
    if (unknown.length === 0) continue
    const need = cell.count - flagged
    if (need < 0 || need > unknown.length) continue // 脏数据，跳过
    constraints.push({ vars: unknown, need })
  }
  return constraints
}

function splitComponents(constraints) {
  // vars -> constraint indices
  const varToCs = new Map()
  constraints.forEach((c, ci) => {
    for (const v of c.vars) {
      if (!varToCs.has(v)) varToCs.set(v, [])
      varToCs.get(v).push(ci)
    }
  })
  const visited = new Set()
  const components = []
  for (let ci = 0; ci < constraints.length; ci++) {
    if (visited.has(ci)) continue
    const queue = [ci]
    visited.add(ci)
    const compVars = new Set()
    const compCs = []
    let qh = 0
    while (qh < queue.length) {
      const cur = queue[qh++]
      const c = constraints[cur]
      compCs.push(c)
      for (const v of c.vars) {
        compVars.add(v)
        const peers = varToCs.get(v) || []
        for (const p of peers) {
          if (!visited.has(p)) {
            visited.add(p)
            queue.push(p)
          }
        }
      }
    }
    components.push({ vars: [...compVars], constraints: compCs })
  }
  return components
}

// 回溯枚举，带剪枝
function enumerateComponent(vars, constraints) {
  const n = vars.length
  const varPos = new Map()
  vars.forEach((v, i) => varPos.set(v, i))
  // 转为 pos 列表
  const cPos = constraints.map(c => ({
    need: c.need,
    pos: c.vars.map(v => varPos.get(v)),
  }))

  const mineCounts = new Array(n).fill(0)
  let total = 0
  const assign = new Array(n).fill(0)

  // 为剪枝预计算每个约束的 pos Set 快速判断是否已分配
  // 简单遍历即可，n 小

  function isPartialValid(upTo) {
    for (const c of cPos) {
      let assigned = 0
      let unassigned = 0
      for (const p of c.pos) {
        if (p <= upTo) assigned += assign[p]
        else if (p > upTo) unassigned++
      }
      if (assigned > c.need) return false
      if (assigned + unassigned < c.need) return false
    }
    return true
  }

  function dfs(pos) {
    if (pos === n) {
      // 最终校验
      for (const c of cPos) {
        let s = 0
        for (const p of c.pos) s += assign[p]
        if (s !== c.need) return
      }
      total++
      for (let i = 0; i < n; i++) if (assign[i]) mineCounts[i]++
      return
    }
    // 试 0
    assign[pos] = 0
    if (isPartialValid(pos)) dfs(pos + 1)
    // 试 1
    assign[pos] = 1
    if (isPartialValid(pos)) dfs(pos + 1)
  }

  dfs(0)
  return { total, mineCounts }
}

function approximateComponent(vars, constraints) {
  // 简单近似：对每个变量取其参与约束的 need/vars.length 平均
  const prob = new Map()
  const varToNeeds = new Map()
  for (const c of constraints) {
    const p = c.vars.length ? c.need / c.vars.length : 0
    for (const v of c.vars) {
      if (!varToNeeds.has(v)) varToNeeds.set(v, [])
      varToNeeds.get(v).push(p)
    }
  }
  for (const v of vars) {
    const arr = varToNeeds.get(v) || [0]
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length
    prob.set(v, Math.max(0, Math.min(1, avg)))
  }
  return prob
}

/**
 * 计算所有未翻开格的雷概率
 * @param {Array} grid
 * @param {number} row
 * @param {number} column
 * @param {number} bombNumber
 * @returns {{map: Map<number, number>, isApproximate: boolean}}
 */
export function computeProbabilities(grid, row, column, bombNumber) {
  const flaggedTotal = grid.filter(c => c.isFlag).length
  const remainingMines = Math.max(0, bombNumber - flaggedTotal)
  const constraints = buildConstraints(grid, row, column)

  const frontierSet = new Set()
  for (const c of constraints) for (const v of c.vars) frontierSet.add(v)

  const isolated = []
  for (let i = 0; i < grid.length; i++) {
    const c = grid[i]
    if (!c.isOpen && !c.isFlag && !frontierSet.has(i)) isolated.push(i)
  }

  const result = new Map()
  let isApproximate = false

  if (frontierSet.size === 0) {
    if (isolated.length > 0) {
      const p = isolated.length ? remainingMines / isolated.length : 0
      const clamped = Math.max(0, Math.min(1, p))
      for (const v of isolated) result.set(v, clamped)
    }
    return { map: result, isApproximate }
  }

  const components = splitComponents(constraints)

  // 统计 frontier 期望雷数
  let expectedFrontierMines = 0
  const frontierProbs = new Map()

  for (const comp of components) {
    const n = comp.vars.length
    // 阈值：>25 用近似，避免指数爆炸
    if (n > 25) {
      isApproximate = true
      const approx = approximateComponent(comp.vars, comp.constraints)
      for (const [v, p] of approx) {
        frontierProbs.set(v, p)
        expectedFrontierMines += p
      }
      continue
    }
    const { total, mineCounts } = enumerateComponent(comp.vars, comp.constraints)
    if (total === 0) {
      // 无解，脏盘面，近似兜底
      isApproximate = true
      const approx = approximateComponent(comp.vars, comp.constraints)
      for (const [v, p] of approx) {
        frontierProbs.set(v, p)
        expectedFrontierMines += p
      }
      continue
    }
    // 采样截断保护：若解数过多（>50000），标记近似但仍用精确统计（已枚举完其实不截断）
    if (total > 50000) isApproximate = true
    for (let i = 0; i < comp.vars.length; i++) {
      const v = comp.vars[i]
      const p = mineCounts[i] / total
      frontierProbs.set(v, p)
      expectedFrontierMines += p
    }
  }

  for (const [v, p] of frontierProbs) result.set(v, p)

  if (isolated.length > 0) {
    const isolatedMines = Math.max(0, remainingMines - expectedFrontierMines)
    const pIso = isolated.length ? isolatedMines / isolated.length : 0
    const clamped = Math.max(0, Math.min(1, pIso))
    for (const v of isolated) result.set(v, clamped)
    if (isolatedMines < -1e-6 || isolatedMines > isolated.length + 1e-6) {
      // 数值异常，标记近似
      isApproximate = true
    }
  }

  return { map: result, isApproximate }
}

export function getBestProbs(map) {
  if (!map || map.size === 0) return { pMin: null, pMax: null }
  let pMin = 1, pMax = 0
  for (const p of map.values()) {
    if (p < pMin) pMin = p
    if (p > pMax) pMax = p
  }
  return { pMin, pMax }
}

// 便捷：计算单次操作的效率分（0-1）
export function scoreForAction(prob, pBest, action) {
  if (pBest == null || prob == null) return null
  if (action === 'flag') {
    if (pBest === 0) return prob === 0 ? 1 : 0
    return Math.max(0, Math.min(1, prob / pBest))
  }
  // open / chord
  const denom = 1 - pBest
  if (denom <= 1e-9) return prob === 1 ? 0 : 1 // pBest=1 意味着没有安全格
  return Math.max(0, Math.min(1, (1 - prob) / denom))
}
