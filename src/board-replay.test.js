import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encodeGridState, decodeBits, applySnapshot } from './board-replay.js';

function makeGrid(states) {
  // states: 数组，'o'=已开 'f'=旗 'q'=问号 其他=未动
  return states.map((s) => ({
    isOpen: s === 'o',
    isFlag: s === 'f',
    isQuestion: s === 'q',
    isUncovered: false,
  }));
}

describe('board-replay', () => {
  it('encodeGridState 生成三个位串', () => {
    const grid = makeGrid(['o', 'f', 'q', 'x']);
    assert.deepEqual(encodeGridState(grid), {
      openedBits: '1000',
      flagBits: '0100',
      questionBits: '0010',
    });
  });

  it('decodeBits roundtrip', () => {
    assert.deepEqual(decodeBits('0101'), [false, true, false, true]);
    assert.deepEqual(decodeBits(''), []);
    const grid = makeGrid(['o', 'f', 'q', 'x', 'o']);
    const { openedBits } = encodeGridState(grid);
    assert.deepEqual(decodeBits(openedBits), [true, false, false, false, true]);
  });

  it('applySnapshot 同时恢复 grid 数据与组件实例', () => {
    const grid = makeGrid(Array(4).fill('x'));
    const restored = [];
    const gridItems = [0, 1, 2, 3].map((i) => ({
      restore(state) {
        restored.push([i, state]);
      },
    }));
    applySnapshot(grid, gridItems, {
      openedBits: '1100',
      flagBits: '0010',
      questionBits: '0001',
    });
    assert.equal(grid[0].isOpen, true);
    assert.equal(grid[2].isFlag, true);
    assert.equal(grid[3].isQuestion, true);
    assert.equal(grid[1].isUncovered, false);
    assert.deepEqual(restored[0], [
      0,
      { isOpen: true, isFlag: false, isQuestion: false },
    ]);
    assert.deepEqual(restored[3], [
      3,
      { isOpen: false, isFlag: false, isQuestion: true },
    ]);
  });

  it('applySnapshot 容忍缺失的组件实例', () => {
    const grid = makeGrid(['o', 'x']);
    applySnapshot(grid, [], {
      openedBits: '10',
      flagBits: '00',
      questionBits: '00',
    });
    assert.equal(grid[0].isOpen, true);
  });
});
