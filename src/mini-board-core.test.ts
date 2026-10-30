import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MINI_BOARD_COLS,
  MINI_BOARD_MINES,
  MINI_BOARD_ROWS,
  chordMiniCell,
  createMiniBoard,
  handlePrimaryCellAction,
  openMiniCell,
  toggleMiniFlag,
} from '../site/src/scripts/mini-board-core.ts';

function createSeededRng(seed = 42): () => number {
  let state = seed >>> 0;
  return function nextRandom(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('mini-board-core', () => {
  it('初始化 9×9 空闲棋盘', () => {
    const state = createMiniBoard();
    assert.equal(state.rows, MINI_BOARD_ROWS);
    assert.equal(state.cols, MINI_BOARD_COLS);
    assert.equal(state.mineCount, MINI_BOARD_MINES);
    assert.equal(state.status, 'idle');
    assert.equal(state.cells.length, 81);
    assert.ok(state.cells.every((cell) => !cell.isOpen && !cell.isFlag));
  });

  it('首击保证 3×3 禁雷并触发空白洪水展开', () => {
    const state = createMiniBoard();
    const center = 40;
    const action = handlePrimaryCellAction(state, center, createSeededRng(11));
    assert.equal(action, 'started');
    assert.equal(state.status, 'playing');
    assert.equal(
      state.cells.filter((cell) => cell.isMine).length,
      MINI_BOARD_MINES,
    );
    assert.ok(state.openedCount >= 9);

    const cx = center % state.cols;
    const cy = Math.floor(center / state.cols);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const idx = (cy + dy) * state.cols + (cx + dx);
        assert.equal(state.cells[idx].isMine, false);
        assert.equal(state.cells[idx].isOpen, true);
      }
    }
  });

  it('插旗模式与手动插旗遵循雷数上限', () => {
    const state = createMiniBoard(6, 6, 2);
    openMiniCell(state, 0, createSeededRng(7));
    assert.equal(state.status, 'playing');
    const closedIndices = state.cells
      .filter((cell) => !cell.isOpen)
      .map((cell) => cell.index);
    state.isFlagMode = true;

    handlePrimaryCellAction(state, closedIndices[0]);
    assert.equal(state.cells[closedIndices[0]].isFlag, true);
    assert.equal(state.flaggedCount, 1);

    toggleMiniFlag(state, closedIndices[1]);
    assert.equal(state.flaggedCount, 2);

    // 达到上限后不能继续插第 3 面旗
    const blocked = toggleMiniFlag(state, closedIndices[2]);
    assert.equal(blocked, false);
    assert.equal(state.flaggedCount, 2);

    // 拔旗恢复计数
    handlePrimaryCellAction(state, closedIndices[0]);
    assert.equal(state.flaggedCount, 1);
  });

  it('双击连开在旗数匹配时翻开其余邻格，全开后自动补旗获胜', () => {
    const state = createMiniBoard();
    openMiniCell(state, 40, createSeededRng(19));

    // 标记所有真实地雷，对前沿数字格执行双击连开
    for (const cell of state.cells) {
      if (cell.isMine && !cell.isFlag) {
        toggleMiniFlag(state, cell.index);
      }
    }
    const numbered = state.cells.find(
      (cell) => cell.isOpen && cell.adjacentMines > 0,
    );
    assert.ok(numbered);
    chordMiniCell(state, numbered.index);

    // 翻开剩余所有非雷格以验证胜利自动补旗
    for (const cell of state.cells) {
      if (!cell.isMine && !cell.isOpen) {
        openMiniCell(state, cell.index);
      }
    }
    assert.equal(state.status, 'won');
    assert.equal(state.flaggedCount, state.mineCount);
    assert.ok(state.cells.every((cell) => cell.isOpen || cell.isFlag));
  });

  it('踩雷进入失败终局且后续点击被忽略', () => {
    const state = createMiniBoard();
    openMiniCell(state, 0, createSeededRng(23));
    const mineCell = state.cells.find((cell) => cell.isMine);
    assert.ok(mineCell);
    const safeClosed = state.cells.find((cell) => !cell.isMine && !cell.isOpen);
    assert.ok(safeClosed);

    openMiniCell(state, mineCell.index);
    assert.equal(state.status, 'lost');
    assert.equal(state.explodedIndex, mineCell.index);

    const openedSnapshot = state.openedCount;
    assert.equal(openMiniCell(state, safeClosed.index), false);
    assert.equal(toggleMiniFlag(state, safeClosed.index), false);
    assert.equal(state.openedCount, openedSnapshot);
  });
});
