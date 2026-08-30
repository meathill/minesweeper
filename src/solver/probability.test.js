import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeProbabilities, getBestProbs, scoreForAction } from './probability.js'

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
    // 此时中心 0 不产生约束，frontier 为空 -> isolated 均摊
    // 构造更直接：中心 1 但已有一个 flag 满足
    const g2 = makeGrid(3, 3, (grid) => {
      for (let i = 0; i < 9; i++) grid[i].isOpen = true
      grid[0].isOpen = false
      grid[1].isFlag = true; grid[1].isOpen = false
      grid[4].isOpen = true; grid[4].count = 1
      grid[4].count = 1
    })
    const { map } = computeProbabilities(g2, 3, 3, 1)
    // 未知 0 需要为 0
    assert.equal(map.get(0), 0)
  })

  it('已标记满足约束 => 剩余未知 0%', () => {
    const g = makeGrid(2, 2, (grid, row, col) => {
      grid[idx(0, 0, col)].isOpen = true; grid[idx(0, 0, col)].count = 1
      grid[idx(0, 1, col)].isFlag = true
      grid[idx(1, 0, col)].isOpen = false // 未知
      grid[idx(1, 1, col)].isOpen = true; grid[idx(1, 1, col)].count = 0
    })
    const { map } = computeProbabilities(g, 2, 2, 1)
    assert.equal(map.get(idx(1, 0, 2)), 0)
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

  it('已全部标满 => 空 map', () => {
    const g = makeGrid(2, 2, (grid) => {
      for (let i = 0; i < 4; i++) { grid[i].isFlag = true; grid[i].isOpen = false }
    })
    const { map } = computeProbabilities(g, 2, 2, 4)
    assert.equal(map.size, 0)
  })
})

describe('computeProbabilities - 边界与近似', () => {
  it('flag 超过 bombNumber 时 remainingMines 钳到 0', () => {
    const g = makeGrid(3, 3, (grid) => {
      for (let i = 0; i < 9; i++) grid[i].isFlag = true
      grid[0].isFlag = true; grid[1].isFlag = true
    })
    const { map } = computeProbabilities(g, 3, 3, 1)
    // flagged 9 > bomb 1 => remaining 0, isolated 空，所以 map 空或 0
    assert.equal(map.size, 0)
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

  it('矛盾盘面（无解）回退近似不崩', () => {
    // 1 周围 1 个未知但 count=2 矛盾 => buildConstraints 会跳过该约束（need>vars），则 frontier 空
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

describe('getBestProbs / scoreForAction', () => {
  it('空 map 返回 null', () => {
    assert.deepEqual(getBestProbs(new Map()), { pMin: null, pMax: null })
    assert.deepEqual(getBestProbs(null), { pMin: null, pMax: null })
  })

  it('极值正确', () => {
    const m = new Map([[0, 0.2], [1, 0.8], [2, 0.5]])
    assert.deepEqual(getBestProbs(m), { pMin: 0.2, pMax: 0.8 })
  })

  it('你的示例：场上有 100% 雷，点 50% => 得分 5/10', () => {
    // score 返回 0-1，*10 后为 5
    const s = scoreForAction(0.5, 1, 'flag')
    assert.ok(approxEqual(s, 0.5))
    assert.equal(Math.round(s * 10), 5)
    // open 场景同样
    assert.ok(approxEqual(scoreForAction(0.5, 0, 'open'), 0.5))
  })

  it('最优本身得满分', () => {
    assert.equal(scoreForAction(1, 1, 'flag'), 1)
    assert.equal(scoreForAction(0, 0, 'open'), 1)
  })

  it('无安全格时 pMin=1 的边界', () => {
    assert.equal(scoreForAction(1, 1, 'open'), 0)
    assert.equal(scoreForAction(0.5, 1, 'open'), 1) // 1-0.5 / 0 => 按实现返回 1
  })

  it('非法输入返回 null', () => {
    assert.equal(scoreForAction(null, 0, 'open'), null)
    assert.equal(scoreForAction(0.5, null, 'flag'), null)
  })
})
