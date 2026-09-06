// 扫雷概率求解器：基于约束枚举 + 分量拆分 + 孤立格均摊
// 输入的 grid 为 App.vue 的 grid.value 数组，元素含 {isOpen,isFlag,count}
// 不依赖 isBomb（玩家视角）。旗只是玩家的猜测、可能插错，因此不参与概率计算：
// 约束只看已打开的数字，剩余雷数恒为 bombNumber，所有未开格（含插旗/问号）都参与推理。

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
    for (const n of neighbors) {
      // 旗可能是错的：未开格（无论有无旗/问号）都是未知变量
      if (!grid[n].isOpen) unknown.push(n)
    }
    if (unknown.length === 0) continue
    const need = cell.count
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

// 搜索预算：单次 computeProbabilities 调用的总搜索节点上限。
// 背景：旗不再被信任后（见文件头注释），旗格保留为变量、约束 need 不再扣减，
// 中残局前沿极易连成上百变量的巨大分量；无上限的 DFS 会让主线程卡死十几秒。
// 预算耗尽时回退到 forced 检查 + 平均近似，保证最坏情况也有界（目标 <500ms）。
const CALL_NODE_BUDGET = 100000
// forced 快筛：两侧各走一遍极小预算，都能找到解 => 必不是 forced，直接近似，
// 跳过昂贵的完整证明。sat 结论是可靠的（真找到了解），只有 unknown 才走完整检查。
const QUICK_CHECK_NODES = 200

// O(n) 约束传播 + 子集规则，迭代至不动点：
//  1. 代入已定格：need==0 → 全安全；need==len → 全雷；
//  2. 子集规则：vars(A)⊂vars(B) → 派生 (B\A, needB-needA)，1-2-1 这类模式无需搜索直接解。
// 定死的格子直接从约束中排除，剩下的约束变小、分量分裂，后续搜索只处理真正模糊的核。
// 脏约束（need 越界，真实对局不可能出现）按既有语义丢弃并标记 contradiction。
// 规模保护：约束太多时跳过子集派生（O(c²)，留给搜索处理）；轮次封顶防 pathological。
const PROPAGATE_MAX_ROUNDS = 20
const SUBSET_MAX_CONSTRAINTS = 500
function constraintKey(vars, need) {
  return [...vars].sort((a, b) => a - b).join(',') + ':' + need
}
function propagateConstraints(constraints) {
  const decided = new Map() // var -> 0/1（逻辑蕴含，与精确搜索结论一致）
  let contradiction = false // 出现过矛盾约束（真实对局不可能；脏盘面时调用方应标近似）
  let active = constraints.map(c => ({ vars: [...c.vars], need: c.need }))
  const seen = new Set(active.map(c => constraintKey(c.vars, c.need)))
  const needByVars = new Map() // 变量集key -> need，用于 O(1) 发现同集异 need（矛盾）
  for (const c of active) needByVars.set([...c.vars].sort((a, b) => a - b).join(','), c.need)
  let changed = true
  let rounds = 0
  while (changed && rounds++ < PROPAGATE_MAX_ROUNDS) {
    changed = false
    // --- 代入已定格并化简 ---
    const next = []
    for (const c of active) {
      const vars = []
      let need = c.need
      for (const v of c.vars) {
        if (decided.has(v)) { if (decided.get(v) === 1) need-- }
        else vars.push(v)
      }
      if (need < 0 || need > vars.length) { contradiction = true; continue } // 脏约束，丢弃
      if (vars.length === 0) continue // 恒真，丢弃
      if (need === 0) {
        for (const v of vars) if (!decided.has(v)) { decided.set(v, 0); changed = true }
      } else if (need === vars.length) {
        for (const v of vars) if (!decided.has(v)) { decided.set(v, 1); changed = true }
      } else {
        next.push({ vars, need })
      }
    }
    active = next
    // --- 子集规则派生新约束 ---
    if (active.length > 1 && active.length <= SUBSET_MAX_CONSTRAINTS) {
      const sets = active.map(c => new Set(c.vars))
      const m = active.length // 本轮只看快照；新派生的下轮参与，保证 sets 下标有效
      let derived = 0
      for (let i = 0; i < m; i++) {
        const A = active[i]
        for (let j = 0; j < m; j++) {
          if (i === j) continue
          const B = active[j]
          if (A.vars.length >= B.vars.length) continue
          const setB = sets[j]
          let isSubset = true
          for (const v of A.vars) if (!setB.has(v)) { isSubset = false; break }
          if (!isSubset) continue
          const setA = sets[i]
          const rest = B.vars.filter(v => !setA.has(v))
          const need = B.need - A.need
          if (rest.length === 0) { if (need !== 0) contradiction = true; continue }
          if (need < 0 || need > rest.length) { contradiction = true; continue }
          const sortedKey = rest.slice().sort((a, b) => a - b).join(',')
          const prev = needByVars.get(sortedKey)
          if (prev !== undefined && prev !== need) { contradiction = true; continue }
          const key = sortedKey + ':' + need
          if (seen.has(key)) continue
          seen.add(key)
          needByVars.set(sortedKey, need)
          active.push({ vars: rest, need })
          derived++
        }
      }
      if (derived) changed = true
    }
  }
  return { decided, constraints: active, contradiction }
}

// 按参与约束数降序排列变量：高度数变量先赋值，剪枝更早生效
function orderByDegree(vars, constraints) {
  const varPos = new Map()
  vars.forEach((v, i) => varPos.set(v, i))
  const deg = new Array(vars.length).fill(0)
  for (const c of constraints) for (const v of c.vars) deg[varPos.get(v)]++
  return vars.map((_, i) => i).sort((a, b) => deg[b] - deg[a])
}

// 回溯枚举，带剪枝；budget 为 { remaining } 共享对象，耗尽时中止并标记 aborted。
// 中止后返回的计数不可用（有偏），调用方必须改走 forced+近似。
function enumerateComponent(vars, constraints, budget) {
  const n = vars.length
  const order = orderByDegree(vars, constraints) // order[newPos] = oldPos
  const rank = new Array(n)
  order.forEach((oldPos, newPos) => { rank[oldPos] = newPos })
  const varPos = new Map()
  vars.forEach((v, i) => varPos.set(v, i))
  // 转为排序后的 pos 列表
  const cPos = constraints.map(c => ({
    need: c.need,
    pos: c.vars.map(v => rank[varPos.get(v)]),
  }))

  const mineCounts = new Array(n).fill(0)
  let total = 0
  let aborted = false
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
    if (aborted) return
    if (budget && --budget.remaining < 0) { aborted = true; return }
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
    if (!aborted && isPartialValid(pos)) dfs(pos + 1)
  }

  dfs(0)
  if (aborted) return { total: 0, mineCounts: null, aborted: true }
  // 把计数映射回调用方视角的变量顺序
  const ordered = new Array(n)
  for (let newPos = 0; newPos < n; newPos++) ordered[order[newPos]] = mineCounts[newPos]
  return { total, mineCounts: ordered, aborted: false }
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

// 大分量下用 SAT 检查找“必雷/必安全”（forced），避免平均化把 100% 抹成 40%
// 返回三态：'sat'（找到解）/ 'unsat'（搜完无解）/ 'unknown'（budget 耗尽，未定）。
// budget 耗尽按 'unknown' 处理：调用方不得把 unknown 当成 sat 去认定 forced 的反面，
// 但另一侧 proven unsat 时仍可认定 forced（var=0 不可能 => var=1 必然，假定整盘有解）。
// 注意 fixedPos 是调用方变量顺序下的下标，内部按 degree 重排后需换算。
function hasSolutionWithFixed(vars, constraints, fixedPos, fixedVal, budget) {
  const n = vars.length
  const order = orderByDegree(vars, constraints) // order[newPos] = oldPos
  const rank = new Array(n)
  order.forEach((oldPos, newPos) => { rank[oldPos] = newPos })
  const varPos = new Map()
  vars.forEach((v, i) => varPos.set(v, i))
  const cPos = constraints.map(c => ({
    need: c.need,
    pos: c.vars.map(v => rank[varPos.get(v)]),
  }))
  const assign = new Array(n).fill(-1)
  assign[rank[fixedPos]] = fixedVal
  let exhausted = false
  function isPartialValid() {
    for (const c of cPos) {
      let assigned = 0
      let unassigned = 0
      for (const p of c.pos) {
        const v = assign[p]
        if (v === -1) unassigned++
        else if (v === 1) assigned++
      }
      if (assigned > c.need) return false
      if (assigned + unassigned < c.need) return false
    }
    return true
  }
  function dfs(nextIdx) {
    if (budget && --budget.remaining < 0) { exhausted = true; return true }
    // 找下一个未赋值的 pos
    let pos = -1
    for (let i = nextIdx; i < n; i++) if (assign[i] === -1) { pos = i; break }
    if (pos === -1) {
      // 全赋值，校验
      for (const c of cPos) {
        let s = 0
        for (const p of c.pos) if (assign[p] === 1) s++
        if (s !== c.need) return false
      }
      return true
    }
    // 试 0/1
    for (const val of [0, 1]) {
      assign[pos] = val
      if (isPartialValid()) {
        if (dfs(pos + 1)) return true
      }
      assign[pos] = -1
    }
    return false
  }
  if (!isPartialValid()) return 'unsat'
  const found = dfs(0)
  // !found 蕴含预算未耗尽（耗尽会沿调用链返回 true），即搜完无解
  if (!found) return 'unsat'
  return exhausted ? 'unknown' : 'sat'
}

export function hasSolutionWithFixedExport(vars, constraints, pos, val, nodeBudget = CALL_NODE_BUDGET) {
  return hasSolutionWithFixed(vars, constraints, pos, val, { remaining: nodeBudget })
}
export function solveLargeComponentExport(vars, constraints, nodeBudget = CALL_NODE_BUDGET) {
  return solveLargeComponent(vars, constraints, { remaining: nodeBudget })
}

function solveLargeComponent(vars, constraints, budget) {
  const n = vars.length
  // 高度数变量优先检查：预算耗尽时，至少已判定了约束最多的变量
  const order = orderByDegree(vars, constraints)
  const sortedVars = order.map(i => vars[i])
  const forced = new Map() // var -> 0/1（仅 proven 的 forced）
  let hasForced = false
  for (let si = 0; si < n; si++) {
    if (budget && budget.remaining <= 0) break // 预算用完：剩余变量走平均近似
    // 快筛：两侧都能在极小步数内找到解 => 必不是 forced，跳过昂贵的完整证明
    const quickBudget = { remaining: QUICK_CHECK_NODES }
    const q0 = hasSolutionWithFixed(sortedVars, constraints, si, 0, quickBudget)
    const q1 = q0 === 'sat' ? hasSolutionWithFixed(sortedVars, constraints, si, 1, quickBudget) : 'unknown'
    if (q0 === 'sat' && q1 === 'sat') continue
    const canBe0 = q0 === 'sat' ? 'sat' : hasSolutionWithFixed(sortedVars, constraints, si, 0, budget)
    const canBe1 = q1 === 'sat' ? 'sat' : hasSolutionWithFixed(sortedVars, constraints, si, 1, budget)
    if (canBe0 === 'unsat' && canBe1 !== 'unsat') { forced.set(sortedVars[si], 1); hasForced = true }
    else if (canBe0 !== 'unsat' && canBe1 === 'unsat') { forced.set(sortedVars[si], 0); hasForced = true }
    else if (canBe0 === 'unsat' && canBe1 === 'unsat') {
      // 无解，脏数据，回退
      return { forced: null, hasForced: false, decided: new Map() }
    }
  }
  if (!hasForced) return { forced, hasForced: false, decided: new Map() }
  // 对非 forced 的剩余变量用平均近似，但 forced 的保持 0/1
  // 注意返回的 forced 是全量近似 map；decided 只含 proven 的 forced，供后台精算跳过已定格
  const approx = approximateComponent(vars, constraints)
  for (const [v, val] of forced) approx.set(v, val)
  return { forced: approx, hasForced: true, decided: forced }
}

// 后台精算单次检查预算：idle 时不赶时间，可以比同步宽裕得多，
// 但仍有界——单个变量再难也不超过它，避免某次 idle 切片拖太久。
const REFINE_PER_CHECK_NODES = 30000
// 精算快筛预算：与同步快筛同量级，总是跑完（约 1ms），不计入 fuel。
const REFINE_QUICK_NODES = 1000

/**
 * 为同步算出近似值的大分量创建后台精算器。
 * 按变量分片推进，可随时中断丢弃（调用方用版本号判定过期）。
 * 注意指数级全枚举摊不开——精算只补做 forced 检查（UNSAT 证明），不做全枚举；
 * 同步已确定（decidedSet）的格子直接跳过。
 * @returns {{ total: number, step: (opts?: {fuelNodes?: number, wallMs?: number}) => { newly: Map<number, 0|1>, done: boolean } }}
 */
export function createForcedRefiner(grid, row, column, skipSet = new Set()) {
  const rawConstraints = buildConstraints(grid, row, column)
  // 传播先行：O(n) 定死的格子第一步就交付，不占用搜索预算
  const { decided: propDecided, constraints: simplified } = propagateConstraints(rawConstraints)
  const fresh = new Map()
  for (const [v, val] of propDecided) if (!skipSet.has(v)) fresh.set(v, val)
  const skipAll = new Set(skipSet)
  for (const v of propDecided.keys()) skipAll.add(v)
  const jobs = []
  for (const comp of splitComponents(simplified)) {
    if (comp.vars.length <= 28) continue // 小分量同步已精确枚举，无需精算
    const order = orderByDegree(comp.vars, comp.constraints)
    const pending = order.filter(i => !skipAll.has(comp.vars[i]))
    if (pending.length) jobs.push({ vars: comp.vars, constraints: comp.constraints, pending, cursor: 0 })
  }
  jobs.sort((a, b) => b.pending.length - a.pending.length) // 大分量先算
  let jobIdx = 0
  let deliveredProp = false
  // total 只计需搜索的格子：传播是 O(n) 免费午餐，首步即交付，不占 idle 预算；
  // 且同步 map 里本来就有这些值，这里的 fresh 只是补给 skipSet 不全的调用方。
  const total = jobs.reduce((a, j) => a + j.pending.length, 0)
  function pendingCount() {
    let n = 0
    for (let j = jobIdx; j < jobs.length; j++) n += jobs[j].pending.length - jobs[j].cursor
    return n
  }
  return {
    total,
    get pending() { return pendingCount() },
    step({ fuelNodes = 80000, wallMs = 24 } = {}) {
      // 传播定死的格子第一步就交付（O(n) 已算完，不耗预算）
      if (!deliveredProp) {
        deliveredProp = true
        const doneNow = jobIdx >= jobs.length
        return { newly: new Map(fresh), done: doneNow }
      }      const t0 = performance.now()
      const fuel = { remaining: fuelNodes }
      const newly = new Map()
      let progressed = false
      while (jobIdx < jobs.length) {
        const job = jobs[jobIdx]
        while (job.cursor < job.pending.length) {
          // fuel/耗时只决定“是否继续下一个”，当前格总是做完——保证每次 step 至少推进一格，
          // fuel 再小最终也能 done，不会空转饿死。
          if (progressed && (fuel.remaining <= 0 || performance.now() - t0 > wallMs)) {
            return { newly, done: false }
          }
          const pi = job.pending[job.cursor]
          // 快筛不计 fuel（上限千级节点总是跑完）：两侧易 sat 则必非 forced，直接跳过
          const q0 = hasSolutionWithFixed(job.vars, job.constraints, pi, 0, { remaining: REFINE_QUICK_NODES })
          const q1 = q0 === 'sat'
            ? hasSolutionWithFixed(job.vars, job.constraints, pi, 1, { remaining: REFINE_QUICK_NODES })
            : 'unknown'
          if (q0 === 'sat' && q1 === 'sat') { job.cursor++; progressed = true; continue }
          const b0 = { remaining: REFINE_PER_CHECK_NODES }
          const canBe0 = q0 === 'sat' ? 'sat' : hasSolutionWithFixed(job.vars, job.constraints, pi, 0, b0)
          fuel.remaining -= REFINE_PER_CHECK_NODES - b0.remaining
          const b1 = { remaining: REFINE_PER_CHECK_NODES }
          const canBe1 = q1 === 'sat' ? 'sat' : hasSolutionWithFixed(job.vars, job.constraints, pi, 1, b1)
          fuel.remaining -= REFINE_PER_CHECK_NODES - b1.remaining
          job.cursor++
          progressed = true
          if (canBe0 === 'unsat' && canBe1 !== 'unsat') newly.set(job.vars[pi], 1)
          else if (canBe0 !== 'unsat' && canBe1 === 'unsat') newly.set(job.vars[pi], 0)
          // 两侧 unsat = 脏数据（真实对局不可能），忽略
        }
        jobIdx++
      }
      return { newly, done: true }
    },
  }
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
  // 旗不参与计算：剩余雷数恒为总雷数，未开格（含插旗/问号）全部视为未知
  const remainingMines = bombNumber
  const rawConstraints = buildConstraints(grid, row, column)

  const frontierSet = new Set()
  for (const c of rawConstraints) for (const v of c.vars) frontierSet.add(v)

  const isolated = []
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i].isOpen && !frontierSet.has(i)) isolated.push(i)
  }

  const result = new Map()
  let isApproximate = false
  // 已确定格（精确枚举的分量全体 + 传播/SAT 定死的 forced）
  const decidedSet = new Set()
  // 整局共享一份搜索预算：多个大分量叠加也不会卡死主线程
  const budget = { remaining: CALL_NODE_BUDGET }

  // O(n) 传播先行：定死的格子直接落子（与精确搜索结论一致），剩下的约束变小、分量分裂
  const { decided: propDecided, constraints, contradiction } = propagateConstraints(rawConstraints)
  if (contradiction) isApproximate = true // 脏盘面（真实对局不可能）：精确性无从谈起
  for (const [v, val] of propDecided) {
    result.set(v, val)
    decidedSet.add(v)
  }

  if (frontierSet.size === 0) {
    if (isolated.length > 0) {
      const p = isolated.length ? remainingMines / isolated.length : 0
      const clamped = Math.max(0, Math.min(1, p))
      for (const v of isolated) result.set(v, clamped)
    }
    return { map: result, isApproximate, frontierSet, decidedSet }
  }

  const components = splitComponents(constraints)

  // 统计 frontier 期望雷数（含传播已定死的雷，孤立格均摊才准）
  let expectedFrontierMines = 0
  for (const [, val] of propDecided) if (val === 1) expectedFrontierMines += 1
  const frontierProbs = new Map()

  for (const comp of components) {
    const n = comp.vars.length
    // 阈值：>28 用近似，但先尝试找出必雷/必安全，避免把 100% 平均成 40%
    if (n > 28) {
      isApproximate = true
      const large = solveLargeComponent(comp.vars, comp.constraints, budget)
      if (large.forced) {
        for (const [v, p] of large.forced) {
          frontierProbs.set(v, p)
          expectedFrontierMines += p
        }
        for (const v of large.decided.keys()) decidedSet.add(v)
      } else {
        const approx = approximateComponent(comp.vars, comp.constraints)
        for (const [v, p] of approx) {
          frontierProbs.set(v, p)
          expectedFrontierMines += p
        }
      }
      continue
    }
    const { total, mineCounts, aborted } = enumerateComponent(comp.vars, comp.constraints, budget)
    if (aborted) {
      // 枚举超预算：改走 forced 检查（共享剩余预算），剩不下的用平均近似
      isApproximate = true
      const large = solveLargeComponent(comp.vars, comp.constraints, budget)
      const probs = large.forced ?? approximateComponent(comp.vars, comp.constraints)
      for (const [v, p] of probs) {
        frontierProbs.set(v, p)
        expectedFrontierMines += p
      }
      if (large.forced) for (const v of large.decided.keys()) decidedSet.add(v)
      continue
    }
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
      decidedSet.add(v) // 精确枚举的分量全体确定
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

  return { map: result, isApproximate, frontierSet, decidedSet }
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
// 固定差距扣分：只看所选格与当时最优选项的绝对概率差，差满 SCORE_GAP_FULL 扣到 0。
// 与全盘分布解耦——顺利局（全盘概率都低）不再被系统性打低分。
export const SCORE_GAP_FULL = 0.5

export function scoreForAction({ prob, pMin, pMax, action }) {
  if (prob == null || pMin == null || pMax == null) return null
  let gap
  if (action === 'flag') {
    // 插旗：越接近全盘最高概率雷越好
    gap = pMax - prob
  } else if (action === 'unflag') {
    // 拔旗：拔掉的格子越安全越好
    gap = prob - pMin
  } else {
    // open：点得越安全越好（chord/首步在调用侧固定满分，不经此函数）
    gap = prob - pMin
  }
  return Math.max(0, Math.min(1, 1 - gap / SCORE_GAP_FULL))
}
