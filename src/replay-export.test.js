import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReplayJson } from './replay-export.js';

describe('replay-export', () => {
  it('buildReplayJson 结构完整', () => {
    const grid = [
      { isBomb: true },
      { isBomb: false, isOpen: true },
      { isBomb: false },
    ];
    const data = buildReplayJson({
      version: '0.7.0',
      level: 'Hard',
      grid,
      row: 1,
      column: 3,
      bombNumber: 1,
      result: 'win',
      startTimeStamp: Date.UTC(2026, 8, 6, 12, 0, 0),
      endTimeStamp: Date.UTC(2026, 8, 6, 12, 2, 30),
      operationEvents: [{ clickTimestamp: 1, type: 'open' }],
      efficiencyEvents: [{ clickTimestamp: 1, prob: 0.5, pMin: 0, pMax: 1, score: 1, action: 'open' }],
      snapshots: [{ clickTimestamp: 1, action: 'start', openedBits: '010', flagBits: '000', questionBits: '000' }],
    });
    assert.equal(data.app, 'minesweeper');
    assert.equal(data.version, '0.7.0');
    assert.equal(data.meta.level, 'Hard');
    assert.equal(data.meta.result, 'win');
    assert.equal(data.meta.durationSec, 150);
    assert.deepEqual(data.bombs, [true, false, false]);
    assert.equal(data.operationEvents.length, 1);
    assert.equal(data.efficiencyEvents.length, 1);
    assert.equal(data.snapshots.length, 1);
    assert.ok(data.exportedAt);
    assert.ok(data.meta.startedAt.includes('2026-09-06T12:00'));
  });
});
