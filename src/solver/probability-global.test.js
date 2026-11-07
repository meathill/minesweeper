import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeProbabilities } from './probability.js';

// 2026-11-07 用户报告:专家局(Hard 16x30/99雷)尾盘,学习模式把最右一列中间
// 3 个未开格标为 0%(必安全),点开其中一个(r7c29)直接爆炸。
// 本棋盘按失败后截图逐格转录,并经过程序化校验:
//   - 全部 373 个已开数字 == 邻接雷数(逐格验证通过)
//   - 91 面旗 + 7 颗未标旗雷(💣) + 1 颗被点爆的雷 = 99 雷,与 Hard 难度吻合
// 字符含义: 数字=已开格; F=旗(雷); B=失败后揭示的未标旗雷; X=被点击爆炸的雷; .=未开安全格
const ENDGAME_BOARD = [
  '0012210000000012FF211111100011',
  '112FF1000000001F5F21F11F10012F',
  '1F22221100000012F21111234322F2',
  '221001B1000111011211001FFFF211',
  'F10001110001F21012F21012444210',
  '2311000001233F101F3F22111F3F31',
  'F4F3100001FF33422123F3F1113FB.',
  'B.FF221101222FFF2213F4210024.X',
  '.BF6F2F1000013F4F2F23F20001FB.',
  '24FF32122321022312112F310024..',
  'B23F4334FFF211F2211123F1001FFF',
  '.444FFFFFF5F322F2F11F211113342',
  'FFFF3345544FF211222211012F2F21',
  '3F42101FF3F4F20112F10002F433F1',
  '11100014F5231102F3111112F3F222',
  '00000002F3F10002F2001F1112111B',
];

const ROW = 16;
const COLUMN = 30;
const BOMB_NUMBER = 99;

// 把转录棋盘转成求解器输入:只含 isOpen/count/isFlag(玩家视角,不用 isBomb);
// 同时返回真实雷位集合(F/B/X)用于断言。
function buildEndgameGame() {
  const grid = [];
  const mines = new Set();
  for (let r = 0; r < ROW; r++) {
    for (let c = 0; c < COLUMN; c++) {
      const ch = ENDGAME_BOARD[r][c];
      const isOpen = ch >= '0' && ch <= '8';
      grid.push({
        isOpen,
        isFlag: ch === 'F',
        count: isOpen ? +ch : 0,
        isBomb: false,
      });
      if (ch === 'F' || ch === 'B' || ch === 'X') mines.add(r * COLUMN + c);
    }
  }
  return { grid, mines };
}

describe('computeProbabilities - 全局雷数约束(尾盘 0% 误报复盘)', () => {
  it('真实雷格的概率必须大于 0(不得把雷判成"必安全")', () => {
    const { grid, mines } = buildEndgameGame();
    const { map } = computeProbabilities(grid, ROW, COLUMN, BOMB_NUMBER);
    const zeros = [];
    for (const index of mines) {
      const p = map.get(index);
      assert.ok(p != null, `雷格 index=${index} 没有概率值`);
      if (p === 0) zeros.push(index);
    }
    assert.deepEqual(
      zeros,
      [],
      `以下真实雷格概率为 0,学习模式会标成"必安全": ${zeros
        .map((i) => `r${Math.floor(i / COLUMN)}c${i % COLUMN}`)
        .join(', ')}`,
    );
  });

  it('被点击爆炸的 r7c29 当时显示 0%(bug 本体),修复后应为正概率', () => {
    const { grid } = buildEndgameGame();
    const { map } = computeProbabilities(grid, ROW, COLUMN, BOMB_NUMBER);
    const exploded = 7 * COLUMN + 29;
    const p = map.get(exploded);
    assert.ok(p != null && p > 0, `r7c29 概率=${p},玩家会看到"必安全"而踩雷`);
  });

  it('约束信息要被利用:孤立雷区概率应接近真实密度(1/3 左右),而不是 0 或 100%', () => {
    const { grid } = buildEndgameGame();
    const { map } = computeProbabilities(grid, ROW, COLUMN, BOMB_NUMBER);
    // r7c29/r8c29/r9c29 是仅有的三个孤立格(无任何已开邻居),其中恰有一颗雷
    for (const [r, c] of [
      [7, 29],
      [8, 29],
      [9, 29],
    ]) {
      const p = map.get(r * COLUMN + c);
      assert.ok(
        p != null && p > 0.01 && p < 0.99,
        `r${r}c${c} 概率=${p},应体现"三选一"的真实不确定性`,
      );
    }
  });
});

// 2026-11-07 用户报告中残局截图:学习模式里环绕已开区的一整片前沿格没有任何
// 概率显示(灰格),而远处孤立格显示 20%、两格显示 0%。逐格转录并校验后复现:
// 前沿 34 变量(含 2 旗)连成一个 >28 的大分量走近似路径,概率只写入 fallbackProbs,
// 而全局可行(zSum>0)的贝叶斯分支只落盘孤立格与精确分量,大分量的格子整体缺失。
// 字符含义: 数字=已开格; F=旗(不参与约束,只是变量); .=未开格
const MIDGAME_BOARD = [
  '......10000001................',
  '......21011101................',
  '.....3F101F2123...............',
  '......21012..3................',
  '......21112...................',
  '.....1........................',
  '.....3........................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
];

// 截图转录校验记录:已开 0 格邻居全开(PASS);孤立格求解值 0.2028 → 显示 20%,
// 与截图一致,交叉验证了转录与 Hard=99 的雷数假设。
function buildMidgameGame() {
  const grid = [];
  for (let r = 0; r < ROW; r++) {
    for (let c = 0; c < COLUMN; c++) {
      const ch = MIDGAME_BOARD[r][c];
      const isOpen = ch >= '0' && ch <= '8';
      grid.push({
        isOpen,
        isFlag: ch === 'F',
        count: isOpen ? +ch : 0,
        isBomb: false,
      });
    }
  }
  return grid;
}

describe('computeProbabilities - 中残局大分量格子缺失(截图复盘)', () => {
  it('任何未开格都必须有概率值(大分量近似路径不得漏格)', () => {
    const grid = buildMidgameGame();
    const { map, hasContradiction } = computeProbabilities(
      grid,
      ROW,
      COLUMN,
      BOMB_NUMBER,
    );
    assert.equal(hasContradiction, false, '真实对局截图不应有矛盾');
    const missing = [];
    for (let i = 0; i < grid.length; i++) {
      if (grid[i].isOpen || grid[i].isFlag) continue;
      if (!map.has(i)) missing.push(i);
    }
    assert.deepEqual(
      missing,
      [],
      `以下未开格没有概率值,学习模式会显示成无数字的灰格: ${missing
        .map((i) => `r${Math.floor(i / COLUMN)}c${i % COLUMN}`)
        .join(', ')}`,
    );
  });

  it('缺失带上恢复的值应落在 [0,1] 且反映约束(不再是空白)', () => {
    const grid = buildMidgameGame();
    const { map } = computeProbabilities(grid, ROW, COLUMN, BOMB_NUMBER);
    // r0c5/r1c5 受 {r0c5,r1c5}=1 与 {r0c5,r1c5,旗r2c6}=2 夹逼,对半 50%
    for (const [r, c] of [
      [0, 5],
      [1, 5],
    ]) {
      const p = map.get(r * COLUMN + c);
      assert.ok(p != null && p > 0.1 && p < 0.9, `r${r}c${c} 概率=${p}`);
    }
    // r4c13 紧贴两个已开 3,概率应显著高于孤立格
    const tight = map.get(4 * COLUMN + 13);
    const iso = map.get(0);
    assert.ok(
      tight != null && tight > iso + 0.1,
      `r4c13=${tight} 应明显高于孤立格 ${iso}`,
    );
  });

  it('截图语义保持:孤立格 ≈ 20%,传播定真的安全格保持 0%', () => {
    const grid = buildMidgameGame();
    const { map } = computeProbabilities(grid, ROW, COLUMN, BOMB_NUMBER);
    const iso = map.get(0);
    assert.ok(
      Math.abs(iso * 100 - 20) <= 0.5,
      `孤立格 ${(iso * 100).toFixed(2)}% 应显示为 20%(与截图一致)`,
    );
    // r5c8/r5c11 截图显示 0%(青色安全格),由约束传播定真
    for (const [r, c] of [
      [5, 8],
      [5, 11],
    ]) {
      const p = map.get(r * COLUMN + c);
      assert.equal(p, 0, `r${r}c${c} 应为真 0% 安全格`);
    }
  });
});

// —— oracle 暴力枚举属性测试：随机小盘上求解器必须与精确条件概率一致 ——
// 模型：未开格上所有满足已开数字约束、且雷数恰为 bombNumber 的摆法等可能。
// 求解器（分量枚举 + 孤立格容量卷积 + 全局条件化）是该模型的精确计算，
// 因此逐格概率必须与暴力枚举完全一致（1e-9）。

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function neighborIndices(index, row, column) {
  const x = index % column;
  const y = (index / column) >> 0;
  const out = [];
  for (let i = Math.max(0, y - 1); i < Math.min(y + 2, row); i++)
    for (let j = Math.max(0, x - 1); j < Math.min(x + 2, column); j++)
      if (i !== y || j !== x) out.push(i * column + j);
  return out;
}

function buildRandomGame(seed) {
  const rand = mulberry32(seed);
  const row = 5;
  const column = 6;
  const bombNumber = 6;
  const total = row * column;
  const order = Array.from({ length: total }, (_, i) => i);
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const mineSet = new Set(order.slice(0, bombNumber));
  const grid = Array.from({ length: total }, (_, i) => {
    let count = 0;
    for (const n of neighborIndices(i, row, column))
      if (mineSet.has(n)) count++;
    return { isOpen: false, isFlag: false, count, isBomb: mineSet.has(i) };
  });
  // 随机开 3 个安全格（含级联），构造中残局局面
  const safe = order.slice(bombNumber);
  for (let k = 0; k < 3; k++) {
    const start = safe[Math.floor(rand() * safe.length)];
    if (grid[start].isOpen) continue;
    const queue = [start];
    while (queue.length) {
      const cur = queue.pop();
      if (grid[cur].isOpen) continue;
      grid[cur].isOpen = true;
      if (grid[cur].count === 0)
        for (const n of neighborIndices(cur, row, column))
          if (!grid[n].isOpen && !grid[n].isBomb) queue.push(n);
    }
  }
  return { grid, row, column, bombNumber };
}

function bruteForceExact(grid, row, column, bombNumber) {
  const unknowns = [];
  for (let i = 0; i < grid.length; i++) if (!grid[i].isOpen) unknowns.push(i);
  const digits = [];
  for (let i = 0; i < grid.length; i++)
    if (grid[i].isOpen && grid[i].count > 0)
      digits.push({
        need: grid[i].count,
        nbs: neighborIndices(i, row, column).filter((n) => !grid[n].isOpen),
      });
  const counts = new Map();
  let total = 0;
  const chosen = [];
  const mark = new Array(grid.length).fill(false);
  function rec(start) {
    if (chosen.length === bombNumber) {
      for (const { need, nbs } of digits) {
        let s = 0;
        for (const n of nbs) if (mark[n]) s++;
        if (s !== need) return;
      }
      total++;
      for (const i of chosen) counts.set(i, (counts.get(i) || 0) + 1);
      return;
    }
    for (let i = start; i < unknowns.length; i++) {
      const cellIndex = unknowns[i];
      chosen.push(cellIndex);
      mark[cellIndex] = true;
      rec(i + 1);
      mark[cellIndex] = false;
      chosen.pop();
    }
  }
  rec(0);
  return { counts, total, unknowns };
}

function combinationCount(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

describe('computeProbabilities - oracle 暴力枚举属性测试', () => {
  const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
  for (const seed of SEEDS) {
    it(`种子 ${seed}：逐格概率与精确枚举一致`, () => {
      const { grid, row, column, bombNumber } = buildRandomGame(seed);
      const unknowns = [];
      for (let i = 0; i < grid.length; i++)
        if (!grid[i].isOpen) unknowns.push(i);
      const spaceSize = combinationCount(unknowns.length, bombNumber);
      if (spaceSize === 0 || spaceSize > 150000) return; // 搜索空间过大，换种子覆盖
      const { counts, total } = bruteForceExact(grid, row, column, bombNumber);
      assert.ok(total > 0, '暴力枚举应至少有一个可行摆法（真实盘面必可行）');
      const { map } = computeProbabilities(grid, row, column, bombNumber);
      for (const i of unknowns) {
        const expected = (counts.get(i) || 0) / total;
        const got = map.get(i);
        assert.ok(got != null, `种子 ${seed} 格 ${i} 缺少概率值`);
        assert.ok(
          Math.abs(expected - got) < 1e-9,
          `种子 ${seed} 格 ${i}：求解器=${got} 精确=${expected}`,
        );
      }
    });
  }
});

describe('computeProbabilities - 最小合成回归(旧 clamp 缺陷)', () => {
  it('两分量期望雷数超过总雷数时,孤立格不再被 clamp 成 0%', () => {
    // 3x13:两段相同的 1-1-1 链(各 5 个未开格、各允许 1~2 颗雷,期望 5/3×2=10/3 > 3),
    // 3 个孤立格。真实摆法:两链中格各 1 颗雷 + 孤立格 1 颗 = 3 = bombNumber。
    // 旧实现:remainingForIsolated = 3 − 10/3 < 0 → clamp 成 0%,真雷格显示"必安全"。
    // 行 0/2 的 0 计数格在游戏模式不产生约束(0 格周围本无未开格),此处作无信息填充,
    // 使两链之间、链与孤立格之间互不耦合。
    const row = 3;
    const column = 13;
    const bombNumber = 3;
    const grid = Array.from({ length: row * column }, () => ({
      isOpen: false,
      isFlag: false,
      count: 0,
      isBomb: false,
    }));
    const open = (r, c, count = 0) => {
      grid[r * column + c].isOpen = true;
      grid[r * column + c].count = count;
    };
    for (let c = 0; c < column; c++) open(0, c);
    open(2, 0);
    open(2, 4);
    open(2, 5);
    open(2, 9);
    open(2, 10);
    open(2, 11);
    open(2, 12);
    open(2, 1, 1);
    open(2, 2, 1);
    open(2, 3, 1); // 链 1
    open(2, 6, 1);
    open(2, 7, 1);
    open(2, 8, 1); // 链 2
    const idx = (r, c) => r * column + c;
    const truth = new Set([idx(1, 2), idx(1, 7), idx(1, 10)]);

    const { map, hasContradiction } = computeProbabilities(
      grid,
      row,
      column,
      bombNumber,
    );
    assert.equal(hasContradiction, false);
    // 三个孤立格:"恰有 1 颗雷"的真实不确定性 → 各 1/7
    for (const c of [10, 11, 12]) {
      const p = map.get(idx(1, c));
      assert.ok(
        Math.abs(p - 1 / 7) < 1e-9,
        `孤立格 (1,${c}) 概率=${p},应为 1/7(旧实现为 0)`,
      );
    }
    // 两链中格在 k=1 解里必为雷,后验 5/7
    assert.ok(Math.abs(map.get(idx(1, 2)) - 5 / 7) < 1e-9);
    assert.ok(Math.abs(map.get(idx(1, 7)) - 5 / 7) < 1e-9);
    // 真实雷格概率全部为正
    for (const i of truth) assert.ok(map.get(i) > 0, `真实雷格 ${i} 概率为 0`);
  });
});
