import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeProbabilities, getBestProbs, scoreForAction, createForcedRefiner, solveLargeComponentExport } from './probability.js'

// helper: row*col grid, callback to setup
function makeGrid(row, col, setup) {
  const grid = Array.from({ length: row * col }, () => ({ isOpen: false, isFlag: false, count: 0, isBomb: false }))
  if (setup) setup(grid, row, col)
  return grid
}
const idx = (r, c, col) => r * col + c
function approxEqual(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps
}

// 固定种子复现线上卡死盘面：16x30/99 雷，中盘 + 40 旗（含错旗）
function buildHardMidBoard() {
  function mulberry32(seed) {
    let a = seed >>> 0
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  const row = 16, col = 30, bombs = 99, seed = 42
  const rand = mulberry32(seed)
  const total = row * col
  const neigh = (i) => {
    const x = i % col, y = (i / col) >> 0, out = []
    for (let r = Math.max(0, y - 1); r < Math.min(y + 2, row); r++)
      for (let c = Math.max(0, x - 1); c < Math.min(x + 2, col); c++) {
        if (r === y && c === x) continue
        out.push(r * col + c)
      }
    return out
  }
  const clicked = Math.floor(rand() * total)
  const cx = clicked % col, cy = (clicked / col) >> 0
  const forbidden = new Set()
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = cx + dx, ny = cy + dy
    if (nx < 0 || nx >= col || ny < 0 || ny >= row) continue
    forbidden.add(ny * col + nx)
  }
  const candidates = []
  for (let i = 0; i < total; i++) if (!forbidden.has(i)) candidates.push(i)
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) >> 0;[arr[i], arr[j]] = [arr[j], arr[i]] } }
  shuffle(candidates)
  const isBomb = new Array(total).fill(false)
  for (let i = 0; i < bombs; i++) isBomb[candidates[i]] = true
  const grid = []
  for (let i = 0; i < total; i++) {
    let c = 0
    if (!isBomb[i]) for (const n of neigh(i)) if (isBomb[n]) c++
    grid.push({ isOpen: false, isFlag: false, isQuestion: false, count: c })
  }
  const queue = [clicked], seen = new Set([clicked])
  while (queue.length) {
    const cur = queue.pop()
    if (isBomb[cur]) continue
    grid[cur].isOpen = true
    if (grid[cur].count === 0) for (const n of neigh(cur)) if (!seen.has(n)) { seen.add(n); queue.push(n) }
  }
  const safes = []
  for (let i = 0; i < total; i++) if (!isBomb[i] && !grid[i].isOpen) safes.push(i)
  shuffle(safes)
  for (let i = 0; i < Math.min(100, safes.length); i++) grid[safes[i]].isOpen = true
  const unopened = []
  for (let i = 0; i < total; i++) if (!grid[i].isOpen) unopened.push(i)
  shuffle(unopened)
  let placed = 0
  for (const i of unopened) {
    if (placed >= 40) break
    const wantWrong = rand() < 0.3
    if (wantWrong && isBomb[i]) continue
    if (!wantWrong && !isBomb[i]) continue
    grid[i].isFlag = true
    placed++
  }
  return { grid, row, col, bombs }
}

// ------------------------------------------------------------------
describe('computeProbabilities - deterministic', () => {
  it('单约束 1 个未知且 need=1 => 100%', () => {
    const g = makeGrid(3, 3, (grid) => {
      for (let i = 0; i < 9; i++) grid[i].isOpen = true
      grid[0].isOpen = false // 唯一未知
      grid[4].count = 1
      for (let i = 0; i < 9; i++) if (i !== 4) grid[i].count = 0
    })
    const { map } = computeProbabilities(g, 3, 3, 1)
    assert.equal(map.get(0), 1)
  })

  it('单约束 need=0 => 0%', () => {
    const g = makeGrid(3, 3, (grid) => {
      for (let i = 0; i < 9; i++) grid[i].isOpen = true
      grid[0].isOpen = false
      grid[1].isOpen = false
      grid[4].count = 0 // 中心 0，周围已开两个未知需为 0
      // 其余也为 0
    })
    // 中心 0 不产生约束，frontier 为空 -> isolated 均摊（雷数 0）
    const g0 = makeGrid(3, 3, (grid) => {
      for (let i = 0; i < 9; i++) grid[i].isOpen = true
      grid[0].isOpen = false
    })
    const { map } = computeProbabilities(g, 3, 3, 0)
    assert.equal(map.get(0), 0)
    const { map: map0 } = computeProbabilities(g0, 3, 3, 0)
    assert.equal(map0.get(0), 0)
  })

  it('旗不被信任：数字 1 旁的旗格与未开格各 50%（错旗场景回归）', () => {
    // 旧算法把旗当确定的雷：need=1-1=0 => 未开格被判 0% 安全，
    // 玩家若据此点开真雷格就炸。旗可能插错，概率必须完全无视旗。
    const g = makeGrid(3, 3, (grid) => {
      for (let i = 0; i < 9; i++) grid[i].isOpen = true
      grid[0].isOpen = false
      grid[1].isFlag = true; grid[1].isOpen = false
      grid[4].isOpen = true; grid[4].count = 1
    })
    const { map } = computeProbabilities(g, 3, 3, 1)
    assert.ok(approxEqual(map.get(0), 0.5))
    assert.ok(approxEqual(map.get(1), 0.5))
  })

  it('旗格本身也参与推理：唯一未开格（带旗）由数字判定 100%', () => {
    const g = makeGrid(3, 3, (grid) => {
      for (let i = 0; i < 9; i++) grid[i].isOpen = true
      grid[0].isOpen = false; grid[0].isFlag = true
      grid[4].isOpen = true; grid[4].count = 1
      for (let i = 0; i < 9; i++) if (i !== 4) grid[i].count = 0
    })
    const { map } = computeProbabilities(g, 3, 3, 1)
    assert.equal(map.get(0), 1)
  })
})

describe('computeProbabilities - 50/50 & overlapping', () => {
  it('1 有 2 个未知 => 各 50%', () => {
    const g = makeGrid(3, 3, (grid, row, col) => {
      // 仅中心 1，周边 2 个未知，其余已开
      for (let i = 0; i < 9; i++) grid[i].isOpen = true
      grid[0].isOpen = false
      grid[1].isOpen = false
      grid[4].count = 1
      // 其他设 0
      for (let i = 0; i < 9; i++) if (i !== 4) grid[i].count = 0
      grid[4].isOpen = true
    })
    // 这样中心 1 的 unknown 只有 [0,1] 两个，但实际还包括其他 6 个未开？我们把其余 6 个设为已开
    // 已在上面把 0,1 留未开，其余已开，符合
    const { map } = computeProbabilities(g, 3, 3, 1)
    assert.ok(approxEqual(map.get(0), 0.5))
    assert.ok(approxEqual(map.get(1), 0.5))
  })

  it('经典 1-2-1 横向：两端必雷中间必安全 (简化版)', () => {
    // 布局 row=2 col=3:
    // 数字行: [1,2,1] 已开
    // 未知行: [* ,*,*] 三个未知在下方
    // 约束: 1->{0,1}, 2->{0,1,2}, 1->{1,2} => 解只有 101 两端雷
    const g = makeGrid(2, 3, (grid, row, col) => {
      grid[idx(0, 0, col)].isOpen = true; grid[idx(0, 0, col)].count = 1
      grid[idx(0, 1, col)].isOpen = true; grid[idx(0, 1, col)].count = 2
      grid[idx(0, 2, col)].isOpen = true; grid[idx(0, 2, col)].count = 1
      grid[idx(1, 0, col)].isOpen = false
      grid[idx(1, 1, col)].isOpen = false
      grid[idx(1, 2, col)].isOpen = false
    })
    const { map } = computeProbabilities(g, 2, 3, 2)
    assert.equal(map.get(idx(1, 0, 3)), 1)
    assert.equal(map.get(idx(1, 1, 3)), 0)
    assert.equal(map.get(idx(1, 2, 3)), 1)
  })

  it('你提到的 2-2-1 纵向（含对角）=> 枚举验证', () => {
    // 复用之前手工验证的板 3x4，期望 Top/Mid 100% Bottom 0%
    const g = makeGrid(3, 4, (grid, row, col) => {
      for (let r = 0; r < 3; r++) for (let c = 1; c < 4; c++) grid[idx(r, c, col)].isOpen = true
      grid[idx(0, 1, col)].count = 2
      grid[idx(1, 1, col)].count = 2
      grid[idx(2, 1, col)].count = 1
      for (let r = 0; r < 3; r++) for (let c = 2; c < 4; c++) grid[idx(r, c, col)].count = 0
    })
    const { map } = computeProbabilities(g, 3, 4, 2)
    assert.equal(map.get(idx(0, 0, 4)), 1)
    assert.equal(map.get(idx(1, 0, 4)), 1)
    assert.equal(map.get(idx(2, 0, 4)), 0)
  })
})

describe('computeProbabilities - 多分量与孤立格', () => {
  it('两个独立约束互不影响', () => {
    // 5x5 两个相距远的 1，各自 2 未知
    const g = makeGrid(5, 5, (grid, row, col) => {
      for (let i = 0; i < 25; i++) grid[i].isOpen = true
      // 左上区域
      grid[idx(0, 0, col)].isOpen = false
      grid[idx(0, 1, col)].isOpen = false
      grid[idx(1, 1, col)].isOpen = true; grid[idx(1, 1, col)].count = 1
      // 右下区域
      grid[idx(3, 3, col)].isOpen = false
      grid[idx(4, 4, col)].isOpen = false
      grid[idx(3, 4, col)].isOpen = true; grid[idx(3, 4, col)].count = 1
      // 其他 count 0
      for (let i = 0; i < 25; i++) if (![idx(1,1,col), idx(3,4,col)].includes(i)) grid[i].count = grid[i].isOpen ? 0 : 0
      grid[idx(1, 1, col)].count = 1
      grid[idx(3, 4, col)].count = 1
    })
    const { map } = computeProbabilities(g, 5, 5, 2)
    assert.ok(approxEqual(map.get(idx(0, 0, 5)), 0.5))
    assert.ok(approxEqual(map.get(idx(0, 1, 5)), 0.5))
    assert.ok(approxEqual(map.get(idx(3, 3, 5)), 0.5))
  })

  it('孤立格均摊剩余雷数', () => {
    // 9x9 中心 1，周边仅 8 个 frontier，其余 72 isolated，bomb=10 => frontier 期望1, isolated 9/72=0.125
    const g = makeGrid(9, 9, (grid) => {
      for (let i = 0; i < 81; i++) grid[i].isOpen = false
      grid[40].isOpen = true; grid[40].count = 1
    })
    const { map } = computeProbabilities(g, 9, 9, 10)
    // frontier 8 个
    const frontier = [30, 31, 32, 39, 41, 48, 49, 50]
    for (const f of frontier) assert.ok(approxEqual(map.get(f), 0.125))
    // 任意 isolated
    assert.ok(approxEqual(map.get(0), 0.125))
    assert.ok(approxEqual(map.get(80), 0.125))
  })

  it('无 frontier 时全部均摊', () => {
    const g = makeGrid(3, 3, (grid) => {
      for (let i = 0; i < 9; i++) grid[i].isOpen = false
    })
    const { map } = computeProbabilities(g, 3, 3, 2)
    for (let i = 0; i < 9; i++) assert.ok(approxEqual(map.get(i), 2 / 9))
  })

  it('全部格子插旗仍参与推理（旗不影响均摊）', () => {
    const g = makeGrid(2, 2, (grid) => {
      for (let i = 0; i < 4; i++) { grid[i].isFlag = true; grid[i].isOpen = false }
    })
    const { map } = computeProbabilities(g, 2, 2, 4)
    // 无任何数字约束：4 个未开格（即使全插了旗）均摊 4 雷
    assert.equal(map.size, 4)
    for (let i = 0; i < 4; i++) assert.ok(approxEqual(map.get(i), 1))
  })
})

describe('computeProbabilities - 边界与近似', () => {
  it('旗数超过雷数不影响概率（旗不参与计算）', () => {
    const g = makeGrid(3, 3, (grid) => {
      for (let i = 0; i < 9; i++) grid[i].isFlag = true
      grid[0].isFlag = true; grid[1].isFlag = true
    })
    const { map } = computeProbabilities(g, 3, 3, 1)
    // 无数字约束：9 个未开格均摊 1 雷，插再多旗也不改变结果
    assert.equal(map.size, 9)
    for (let i = 0; i < 9; i++) assert.ok(approxEqual(map.get(i), 1 / 9))
  })

  it('超大分量 >25 触发近似', () => {
    // 构造 1 行 27 列，单一约束 need=13 覆盖 26 未知
    const row = 2, col = 27
    const g = makeGrid(row, col, (grid) => {
      for (let c = 0; c < col; c++) grid[idx(0, c, col)].isOpen = true
      // 中心横向数字覆盖所有下方格
      grid[idx(0, 13, col)].count = 13
      // 使其他数字不产生约束
      for (let c = 0; c < col; c++) if (c !== 13) grid[idx(0, c, col)].count = 0
      for (let c = 0; c < col; c++) grid[idx(1, c, col)].isOpen = false
    })
    // 需要让该数字的 8 邻域包含 26 个未知：实际 3x3 邻域最多 3，需要扩大
    // 简化：直接构造 26 个变量单约束：让中心格周围 26 个未知需要枚举 >25
    // 改成 col=27 时中心格邻域只有 3 个，所以无法触发；改为用多约束连通
    // 改用 3x10 板，全部数字行相连形成一个大分量
    const g2 = makeGrid(3, 10, (grid, r, c) => {
      for (let cc = 0; cc < c; cc++) { grid[idx(0, cc, c)].isOpen = true; grid[idx(0, cc, c)].count = 2 }
      for (let cc = 0; cc < c; cc++) { grid[idx(1, cc, c)].isOpen = false }
      for (let cc = 0; cc < c; cc++) { grid[idx(2, cc, c)].isOpen = true; grid[idx(2, cc, c)].count = 0 }
    })
    const { isApproximate } = computeProbabilities(g2, 3, 10, 15)
    assert.equal(isApproximate, true)
  })

  it('矛盾盘面（无解）回退近似不崩', () => {    // 1 周围 1 个未知但 count=2 矛盾 => buildConstraints 会跳过该约束（need>vars），则 frontier 空
    const g = makeGrid(2, 2, (grid, col) => {
      grid[idx(0, 0, 2)].isOpen = true; grid[idx(0, 0, 2)].count = 2
      grid[idx(0, 1, 2)].isOpen = false // 仅 1 未知但 need 2
      grid[idx(1, 0, 2)].isOpen = true; grid[idx(1, 0, 2)].count = 0
      grid[idx(1, 1, 2)].isOpen = true; grid[idx(1, 1, 2)].count = 0
    })
    const { map } = computeProbabilities(g, 2, 2, 1)
    // 矛盾约束被跳过，后备为 isolated 均摊，不应抛异常
    assert.ok(map instanceof Map)
  })
})

describe('getBestProbs / scoreForAction（固定差距扣分）', () => {
  it('空 map 返回 null', () => {
    assert.deepEqual(getBestProbs(new Map()), { pMin: null, pMax: null })
    assert.deepEqual(getBestProbs(null), { pMin: null, pMax: null })
  })

  it('极值正确', () => {
    const m = new Map([[0, 0.2], [1, 0.8], [2, 0.5]])
    assert.deepEqual(getBestProbs(m), { pMin: 0.2, pMax: 0.8 })
  })

  it('顺利局（全盘概率都低）不再被系统性打低分', () => {
    // pMin=0, pMax=0.15：插一面 prob=0.05 的旗，旧公式 0.33，新公式 0.8
    assert.ok(approxEqual(scoreForAction({ prob: 0.05, pMin: 0, pMax: 0.15, action: 'flag' }), 0.8))
    // 插在 prob=0 的格子上（几乎不可能有雷），扣分封顶也只到 0.7
    assert.ok(approxEqual(scoreForAction({ prob: 0, pMin: 0, pMax: 0.15, action: 'flag' }), 0.7))
    // 点 prob=0.1 的格子
    assert.ok(approxEqual(scoreForAction({ prob: 0.1, pMin: 0, pMax: 0.15, action: 'open' }), 0.8))
  })

  it('危险局点明显更差的格子仍然得低分', () => {
    // pMin=0.3, pMax=0.9：放着 0.3 的格子不点，去点 0.6 => 0.4
    assert.ok(approxEqual(scoreForAction({ prob: 0.6, pMin: 0.3, pMax: 0.9, action: 'open' }), 0.4))
    // 有必雷格（0.9）不插，插在最安全的 0.3 上 => 0 分
    assert.equal(scoreForAction({ prob: 0.3, pMin: 0.3, pMax: 0.9, action: 'flag' }), 0)
    // 拔掉几乎必雷的旗 => 0 分；拔掉最安全的旗 => 满分
    assert.equal(scoreForAction({ prob: 0.9, pMin: 0.3, pMax: 0.9, action: 'unflag' }), 0)
    assert.equal(scoreForAction({ prob: 0.3, pMin: 0.3, pMax: 0.9, action: 'unflag' }), 1)
  })

  it('等价局（所有选项概率相同）不扣分', () => {
    assert.equal(scoreForAction({ prob: 0.5, pMin: 0.5, pMax: 0.5, action: 'open' }), 1)
    assert.equal(scoreForAction({ prob: 0.5, pMin: 0.5, pMax: 0.5, action: 'flag' }), 1)
  })

  it('与最优差距满 0.5 扣满，超出 clamp 到 0', () => {
    // open：prob - pMin = 0.5 => 0 分
    assert.equal(scoreForAction({ prob: 0.6, pMin: 0.1, pMax: 1, action: 'open' }), 0)
    // flag：pMax - prob = 0.8 => clamp 0
    assert.equal(scoreForAction({ prob: 0.2, pMin: 0, pMax: 1, action: 'flag' }), 0)
  })

  it('最优本身得满分', () => {
    assert.equal(scoreForAction({ prob: 1, pMin: 0, pMax: 1, action: 'flag' }), 1)
    assert.equal(scoreForAction({ prob: 0, pMin: 0, pMax: 1, action: 'open' }), 1)
  })

  it('非法输入返回 null', () => {
    assert.equal(scoreForAction({ prob: null, pMin: 0, pMax: 1, action: 'open' }), null)
    assert.equal(scoreForAction({ prob: 0.5, pMin: null, pMax: 1, action: 'flag' }), null)
    assert.equal(scoreForAction({ prob: 0.5, pMin: 0, pMax: null, action: 'flag' }), null)
  })
})

describe('computeProbabilities - 大分量性能与 forced 回归', () => {
  it('子集规则直接解掉大分量链条：无需搜索，无平均，无近似标记', () => {
    // 2x33：顶行全开，0-2 列为 1-2-1，后面全是 1（松散链），底行 33 个未知连成一个大分量
    // 1-2-1 本体强制 b0=1,b1=0,b2=1；链条被 b2=1 钉住后每隔 3 格又钉一个必雷（b5,b8,…b32）
    // 注意列数必须 ≡0 mod 3，否则链条在右边界无解（整盘矛盾，只能回退近似）
    // 子集规则下整条链被传播直接解掉：分量归零，isApproximate 为 false（以前靠 forced 检查）
    const col = 33
    const g = makeGrid(2, col, (grid) => {
      for (let c = 0; c < col; c++) { grid[idx(0, c, col)].isOpen = true }
      grid[idx(0, 0, col)].count = 1
      grid[idx(0, 1, col)].count = 2
      grid[idx(0, 2, col)].count = 1
      for (let c = 3; c < col; c++) grid[idx(0, c, col)].count = 1
      for (let c = 0; c < col; c++) grid[idx(1, c, col)].isOpen = false
    })
    const { map, isApproximate, decidedSet, frontierSet } = computeProbabilities(g, 2, col, 20)
    assert.equal(isApproximate, false)
    assert.equal(map.get(idx(1, 0, col)), 1)
    assert.equal(map.get(idx(1, 1, col)), 0)
    assert.equal(map.get(idx(1, 2, col)), 1)
    assert.equal(map.get(idx(1, 5, col)), 1)
    assert.equal(decidedSet.size, frontierSet.size) // 整条链全定死
  })

  it('Hard 中残局（含错旗）限时完成：无界搜索曾卡死十几秒', () => {
    // 用固定种子复现线上卡死盘面：16x30/99 雷，中盘 + 40 旗（含错旗）
    const { grid, row, col, bombs } = buildHardMidBoard()
    const t0 = Date.now()
    const { map } = computeProbabilities(grid, row, col, bombs)
    const elapsed = Date.now() - t0
    // 修复前该盘面耗时约 13.5s；限 5s，实测约 0.1s，留足 CI 余量
    assert.ok(elapsed < 5000, `超时：${elapsed}ms`)
    assert.ok(map.size > 0)
  })

  it('decidedSet：精确格与 proven forced 在列，近似格不在列', () => {
    const col = 33
    const g = makeGrid(2, col, (grid) => {
      for (let c = 0; c < col; c++) { grid[idx(0, c, col)].isOpen = true }
      grid[idx(0, 0, col)].count = 1
      grid[idx(0, 1, col)].count = 2
      grid[idx(0, 2, col)].count = 1
      for (let c = 3; c < col; c++) grid[idx(0, c, col)].count = 1
      for (let c = 0; c < col; c++) grid[idx(1, c, col)].isOpen = false
    })
    const { decidedSet, frontierSet } = computeProbabilities(g, 2, col, 20)
    // 1-2-1 的三格是 proven forced
    assert.ok(decidedSet.has(idx(1, 0, col)))
    assert.ok(decidedSet.has(idx(1, 1, col)))
    assert.ok(decidedSet.has(idx(1, 2, col)))
    // decided ⊆ frontier（该盘整条链都被钉死，decided 可能等于 frontier， Libra 才断言子集）
    for (const v of decidedSet) assert.ok(frontierSet.has(v))
  })

  it('decidedSet 在真实 Hard 盘上是真子集（近似格不在列）', () => {
    const { grid, row, col, bombs } = buildHardMidBoard()
    const { decidedSet, frontierSet } = computeProbabilities(grid, row, col, bombs)
    assert.ok(decidedSet.size > 0)
    assert.ok(decidedSet.size < frontierSet.size)
    for (const v of decidedSet) assert.ok(frontierSet.has(v))
  })
})

describe('createForcedRefiner - 后台精算', () => {
  function largeBoard() {
    const col = 33
    return makeGrid(2, col, (grid) => {
      for (let c = 0; c < col; c++) { grid[idx(0, c, col)].isOpen = true }
      grid[idx(0, 0, col)].count = 1
      grid[idx(0, 1, col)].count = 2
      grid[idx(0, 2, col)].count = 1
      for (let c = 3; c < col; c++) grid[idx(0, c, col)].count = 1
      for (let c = 0; c < col; c++) grid[idx(1, c, col)].isOpen = false
    })
  }

  it('传播能解的盘无需搜索：total 为 0，首步即交付全部 forced', () => {
    const col = 33
    const g = largeBoard()
    const r = createForcedRefiner(g, 2, col, new Set())
    assert.equal(r.total, 0) // 整条链被传播吃掉，无搜索作业
    const { newly, done } = r.step({ fuelNodes: 80000, wallMs: 1000 })
    assert.equal(done, true)
    assert.equal(newly.get(idx(1, 0, col)), 1)
    assert.equal(newly.get(idx(1, 1, col)), 0)
    assert.equal(newly.get(idx(1, 2, col)), 1)
    assert.equal(newly.get(idx(1, 5, col)), 1)
  })

  it('分片推进与一次跑完结果一致（cursor 纪律）', () => {
    // 3x36：中行 1/2 交替。col ≤ 32 会被传播一路吃光；36 时剩 34 格真模糊核
    // （同步 approx），正好测分片搜索，且耗时毫秒级。
    const col = 36
    const loose = makeGrid(3, col, (grid) => {
      for (let c = 0; c < col; c++) { grid[idx(1, c, col)].isOpen = true; grid[idx(1, c, col)].count = (c % 2 === 0) ? 1 : 2 }
      for (let c = 0; c < col; c++) { grid[idx(0, c, col)].isOpen = false; grid[idx(2, c, col)].isOpen = false }
    })
    const drain = (fuel) => {
      const r = createForcedRefiner(loose, 3, col, new Set())
      assert.ok(r.total > 0)
      const merged = new Map()
      let guard = 0
      let lastDone = false
      while (guard++ < 500) {
        const { newly, done } = r.step({ fuelNodes: fuel, wallMs: 60_000 })
        for (const [k, v] of newly) merged.set(k, v)
        lastDone = done
        if (done) break
      }
      assert.ok(lastDone)
      return merged
    }
    const tiny = drain(5000) // 小 fuel，多次切片
    const huge = drain(10_000_000) // 一次跑完
    assert.deepEqual([...tiny.entries()].sort((a, b) => a[0] - b[0]), [...huge.entries()].sort((a, b) => a[0] - b[0]))
  })

  it('小分量无需精算（total 为 0），skipSet 能跳过已定格', () => {
    const col = 33
    const g = largeBoard()
    const { decidedSet } = computeProbabilities(g, 2, col, 20)
    const r = createForcedRefiner(g, 2, col, decidedSet)
    assert.ok(r.total < 33) // 同步已定的不再排队
    // 2x3 小盘：分量 ≤28，直接 total 0
    const small = makeGrid(2, 3, (grid) => {
      grid[idx(0, 0, 3)].isOpen = true; grid[idx(0, 0, 3)].count = 1
      grid[idx(0, 1, 3)].isOpen = true; grid[idx(0, 1, 3)].count = 2
      grid[idx(0, 2, 3)].isOpen = true; grid[idx(0, 2, 3)].count = 1
    })
    assert.equal(createForcedRefiner(small, 2, 3, new Set()).total, 0)
  })
})

describe('computeProbabilities - 大分量无 forced 不丢格（前沿灰带回归）', () => {
  it('单约束大分量无 forced：solveLarge 返回空但 hasForced 为 false', () => {
    // 31 变量单约束 need=15，每个变量 0/1 皆可满足，无任何 forced
    const vars = Array.from({ length: 31 }, (_, i) => i)
    const large = solveLargeComponentExport(vars, [{ vars: [...vars], need: 15 }], 100000)
    assert.equal(large.hasForced, false)
  })

  it('大分量无 forced 时前沿格全员仍有近似概率（截图灰带回归）', () => {
    // 3x36：中行 1/2 交替，上下两行 72 未知连成大分量，其中 34 格无 forced；
    // 旧逻辑 `if (large.forced)` 把空 Map 当真，整块近似被跳过，前沿变纯灰 null。
    const col = 36
    const g = makeGrid(3, col, (grid) => {
      for (let c = 0; c < col; c++) { grid[idx(1, c, col)].isOpen = true; grid[idx(1, c, col)].count = (c % 2 === 0) ? 1 : 2 }
      for (let c = 0; c < col; c++) { grid[idx(0, c, col)].isOpen = false; grid[idx(2, c, col)].isOpen = false }
    })
    const { map, isApproximate, frontierSet } = computeProbabilities(g, 3, col, 15)
    assert.equal(isApproximate, true)
    assert.equal(frontierSet.size, 72)
    for (const v of frontierSet) {
      assert.ok(map.has(v), `前沿格 ${v} 丢失概率`)
      const p = map.get(v)
      assert.ok(p >= 0 && p <= 1, `前沿格 ${v} 概率越界：${p}`)
    }
  })
})
