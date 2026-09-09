import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { useGameStore } from './store/gameStore.js';
import { formatTime } from './utils/format.js';

// node --test 无 localStorage：gameStore setup 读 level，给最小 stub
function stubLocalStorage() {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  };
  return m;
}

beforeEach(() => {
  stubLocalStorage();
  // gameStore 是浏览器代码：beforeunload 挂载在测试里 stub 掉
  globalThis.addEventListener ??= () => {};
  globalThis.removeEventListener ??= () => {};
  setActivePinia(createPinia());
});

// 忠实模拟 grid-item.vue + 模板循环的语义：子组件只负责自身守卫并回 emit delayMs，
// item 参数永远取自当时的 game.grid（doRealStart 会整体换新数组，模板循环读到的是新对象）。
function mountFakeItems(g) {
  g.grid.forEach((_cell, idx) => {
    const fake = {
      isFlag: false,
      opened: false,
      resetted: 0,
      open(_isUserAction = false, delayMs = 0) {
        if (this.opened || this.isFlag) return;
        this.opened = true;
        g.onOpen(g.grid[idx], idx, delayMs);
      },
      reset() {
        this.opened = false;
        this.resetted++;
      },
      uncover() {},
      markAsFlag() {},
    };
    g.setGridItemRef(fake, idx);
  });
}

describe('gameStore - 开局与布雷', () => {
  it('doStart 初始化空盘（无雷、未开）', () => {
    const g = useGameStore();
    g.doStart(null);
    assert.equal(g.grid.length, 9 * 9);
    assert.ok(g.grid.every((c) => !c.isBomb && !c.isOpen));
    assert.equal(g.isStart, true);
    assert.equal(g.isRealStart, false);
  });

  it('首次点击 3x3 禁雷区无雷、雷数正确', () => {
    const g = useGameStore();
    g.doStart(null);
    const clicked = 40; // Easy 9x9 中央附近
    g.doRealStart(clicked);
    const cx = clicked % g.column;
    const cy = (clicked / g.column) >> 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const idx = (cy + dy) * g.column + (cx + dx);
        assert.equal(g.grid[idx].isBomb, false, `禁雷区 ${idx} 不应有雷`);
      }
    }
    assert.equal(g.grid.filter((c) => c.isBomb).length, g.bombNumber);
    assert.equal(g.grid[clicked].count, 0);
  });
});

describe('gameStore - 空白洪水展开（回归）', () => {
  it('首击空白格：级联开满整个 3x3 并蔓延到数字边界', async () => {
    const g = useGameStore();
    g.doStart(null);
    mountFakeItems(g);
    const clicked = 40;
    // 走与真实组件一致的路径：子组件 open(true) → emit → store.onOpen
    g.gridItemRefs[clicked].open(true, 0);
    // 首击走 doRealStart → nextTick → 递归 onOpen，等一个宏任务让链条走完
    await new Promise((r) => setTimeout(r, 10));
    // 首击 3x3 全无雷且中心 count 为 0，级联至少开满这 9 格并向外蔓延
    assert.ok(g.opened >= 9, `级联应开满 3x3，实际只开了 ${g.opened} 格`);
    assert.ok(!g.grid.some((c) => c.isBomb && c.isOpen), '级联不应开出雷');
    // 数字边界：所有已开空白格的邻域要么已开、要么是数字/雷
    for (const cell of g.grid) {
      if (cell.isOpen && cell.count === 0) {
        const cx = cell.index % g.column;
        const cy = (cell.index / g.column) >> 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || nx >= g.column || ny < 0 || ny >= g.row) continue;
            const n = g.grid[ny * g.column + nx];
            assert.ok(
              n.isOpen || n.isBomb,
              `空白 ${cell.index} 的邻格 ${n.index} 应被级联打开`,
            );
          }
        }
      }
    }
  });

  it('重开（restart）复位所有子组件', async () => {
    const g = useGameStore();
    g.doStart(null);
    mountFakeItems(g);
    g.gridItemRefs[40].open(true, 0);
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(g.opened > 0);
    g.doStart(true);
    assert.equal(g.opened, 0);
    assert.ok(
      g.gridItemRefs.every((f) => f.resetted === 1),
      '重开应对每个子组件调一次 reset',
    );
  });
});

describe('gameStore - 插旗与结算', () => {
  it('onMarkState 旗三态计数', () => {
    const g = useGameStore();
    g.doStart(null);
    g.doRealStart(40);
    g.onMarkState(0, 'flag');
    assert.equal(g.grid[0].isFlag, true);
    assert.equal(g.flagged, 1);
    g.onMarkState(0, 'question');
    assert.equal(g.grid[0].isQuestion, true);
    assert.equal(g.flagged, 0);
    g.onMarkState(0, 'none');
    assert.equal(g.grid[0].isQuestion, false);
  });

  it('胜利结算：自动补旗并清零剩余（回归：顶栏不再残留 5）', () => {
    const g = useGameStore();
    g.doStart(null);
    mountFakeItems(g);
    g.doRealStart(40);
    // 只插部分旗，模拟用户没插满就点开全部安全格获胜
    g.onMarkState(
      g.grid.findIndex((c) => c.isBomb),
      'flag',
    );
    assert.ok(g.flagged < g.bombNumber);
    g.doStop(true, null);
    assert.equal(g.isSuccess, true);
    assert.equal(g.flagged, g.bombNumber);
    assert.equal(g.bombNumber - g.flagged, 0);
    assert.ok(
      g.grid.every((c) => c.isOpen || c.isFlag),
      '胜利后所有未开格都应标为旗',
    );
  });

  it('踩雷终局：失败态、踩雷格同步为已开', () => {
    const g = useGameStore();
    g.doStart(null);
    mountFakeItems(g);
    g.doRealStart(40);
    const bombIdx = g.grid.findIndex((c) => c.isBomb);
    g.doStop(false, bombIdx);
    assert.equal(g.isFailed, true);
    assert.equal(g.isSuccess, false);
    assert.equal(g.grid[bombIdx].isOpen, true);
    assert.equal(g.isStart, false);
  });

  it('onLevelChange 切换维度并重开', () => {
    const g = useGameStore();
    g.doStart(null);
    g.onLevelChange('Medium');
    assert.equal(g.row, 16);
    assert.equal(g.column, 16);
    assert.equal(g.grid.length, 256);
    assert.equal(globalThis.localStorage.getItem('level'), 'Medium');
  });
});

describe('formatTime - 游戏计时显示', () => {
  it('m:ss，分钟封顶 99', () => {
    assert.equal(formatTime(0), '0:00');
    assert.equal(formatTime(65), '1:05');
    assert.equal(formatTime(5999), '99:59');
    assert.equal(formatTime(6000), '99:00'); // 原语义：封顶分支取 min(s,59)，保持不变
  });
});
