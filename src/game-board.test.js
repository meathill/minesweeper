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

const fakeGridItems = () => ({ value: [] });

beforeEach(() => {
  stubLocalStorage();
  // gameStore 是浏览器代码：beforeunload 挂载在测试里 stub 掉
  globalThis.addEventListener ??= () => {};
  globalThis.removeEventListener ??= () => {};
  setActivePinia(createPinia());
});

describe('gameStore - 开局与布雷', () => {
  it('doStart 初始化空盘（无雷、未开）', () => {
    const g = useGameStore();
    g.doStart(null, fakeGridItems());
    assert.equal(g.grid.length, 9 * 9);
    assert.ok(g.grid.every((c) => !c.isBomb && !c.isOpen));
    assert.equal(g.isStart, true);
    assert.equal(g.isRealStart, false);
  });

  it('首次点击 3x3 禁雷区无雷、雷数正确', () => {
    const g = useGameStore();
    g.doStart(null, fakeGridItems());
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

describe('gameStore - 插旗与结算', () => {
  it('onMarkState 旗三态计数', () => {
    const g = useGameStore();
    g.doStart(null, fakeGridItems());
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

  it('踩雷终局：失败态、踩雷格同步为已开', () => {
    const g = useGameStore();
    g.doStart(null, fakeGridItems());
    g.doRealStart(40);
    const bombIdx = g.grid.findIndex((c) => c.isBomb);
    g.doStop(false, bombIdx, fakeGridItems());
    assert.equal(g.isFailed, true);
    assert.equal(g.isSuccess, false);
    assert.equal(g.grid[bombIdx].isOpen, true);
    assert.equal(g.isStart, false);
  });

  it('onLevelChange 切换维度并重开', () => {
    const g = useGameStore();
    g.doStart(null, fakeGridItems());
    g.onLevelChange('Medium', fakeGridItems());
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
