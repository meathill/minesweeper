import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  applyCellState,
  clampConfig,
  createEmptyGrid,
  cycleCellState,
  evaluateCalculatorBoard,
  getCellState,
  matchPresetKey,
} from '../site/src/scripts/probability-calculator-core.ts';

describe('扫雷概率计算器核心逻辑', () => {
  test('格子状态正反向循环包含空白 0 格：hidden ↔ flag ↔ 0 ↔ 1..8', () => {
    const cell = { isOpen: false, isFlag: false, count: 0 };
    assert.equal(getCellState(cell), 'hidden');

    cycleCellState(cell, true);
    assert.equal(getCellState(cell), 'flag');

    cycleCellState(cell, true);
    assert.equal(getCellState(cell), '0');
    assert.equal(cell.isOpen, true);
    assert.equal(cell.count, 0);

    cycleCellState(cell, true);
    assert.equal(getCellState(cell), '1');

    cycleCellState(cell, false);
    assert.equal(getCellState(cell), '0');

    cycleCellState(cell, false);
    assert.equal(getCellState(cell), 'flag');

    cycleCellState(cell, false);
    assert.equal(getCellState(cell), 'hidden');
  });

  test('预设配置匹配：三档标准难度返回对应 preset，其余返回 custom', () => {
    assert.equal(matchPresetKey({ row: 9, column: 9, mines: 10 }), '9x9x10');
    assert.equal(
      matchPresetKey({ row: 16, column: 16, mines: 40 }),
      '16x16x40',
    );
    assert.equal(
      matchPresetKey({ row: 16, column: 30, mines: 99 }),
      '16x30x99',
    );
    assert.equal(matchPresetKey({ row: 10, column: 12, mines: 20 }), 'custom');
    assert.deepEqual(clampConfig(2, 100, 9999), {
      row: 5,
      column: 40,
      mines: 199,
    });
  });

  test('复现用户反馈：9x9·10 点出 10 面旗后，其余 71 格立即变为 0%', () => {
    const config = { row: 9, column: 9, mines: 10 };
    const grid = createEmptyGrid(9, 9);
    for (let i = 0; i < 10; i++) {
      applyCellState(grid[i], 'flag');
    }

    const trusted = evaluateCalculatorBoard(grid, config, true);
    assert.equal(trusted.flagged, 10);
    assert.equal(trusted.remaining, 0);
    assert.equal(trusted.warningKind, 'none');
    for (let i = 0; i < 10; i++) {
      assert.equal(trusted.cells[i].text, '🚩');
      assert.equal(trusted.cells[i].probClass, null);
    }
    for (let i = 10; i < 81; i++) {
      assert.equal(trusted.cells[i].text, '0');
      assert.equal(trusted.cells[i].probClass, 'prob-low');
    }

    // 切换为验错模式（不信任旗）时，旗格显示 🚩12，其余显示 12
    const verifyOnly = evaluateCalculatorBoard(grid, config, false);
    assert.equal(verifyOnly.cells[0].text, '🚩12');
    assert.equal(verifyOnly.cells[10].text, '12');
  });

  test('已翻开空白 0 格与矛盾盘面告警均生效', () => {
    const config = { row: 5, column: 5, mines: 3 };
    const grid = createEmptyGrid(5, 5);
    applyCellState(grid[12], '0');

    const okEval = evaluateCalculatorBoard(grid, config, true);
    assert.equal(okEval.warningKind, 'none');
    assert.equal(okEval.cells[12].text, '');
    assert.equal(okEval.cells[6].text, '0');

    // 在空白 0 格旁插旗触发矛盾告警
    applyCellState(grid[6], 'flag');
    const badEval = evaluateCalculatorBoard(grid, config, true);
    assert.equal(badEval.warningKind, 'contradiction');
  });
});
