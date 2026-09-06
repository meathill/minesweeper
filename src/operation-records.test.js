import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { useOperationRecordsStore } from './store/operationRecords.js';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('operationRecords - 事件记录', () => {
  it('首个事件同时初始化 startTimeStamp', () => {
    const s = useOperationRecordsStore();
    assert.equal(s.operationRecords.startTimeStamp, 0);
    s.onUpdateOperateRecords('open', { index: 5, row: 0, col: 5 });
    assert.ok(s.operationRecords.startTimeStamp > 0);
    assert.equal(s.operationRecords.operationEvents.length, 1);
    assert.equal(s.operationRecords.operationEvents[0].type, 'open');
    assert.equal(s.operationRecords.operationEvents[0].index, 5);
  });

  it('空 eventType 不记录（首步占位符除外逻辑：startTimeStamp 照常初始化）', () => {
    const s = useOperationRecordsStore();
    s.onUpdateOperateRecords('');
    assert.equal(s.operationRecords.operationEvents.length, 0);
  });

  it('flagState 与无 index 的行列元信息', () => {
    const s = useOperationRecordsStore();
    s.onUpdateOperateRecords('flag', {
      index: 1,
      row: 0,
      col: 1,
      flagState: 'flag',
    });
    assert.equal(s.operationRecords.operationEvents[0].flagState, 'flag');
    s.onUpdateOperateRecords('chord', { row: 2, col: 3 });
    const last = s.operationRecords.operationEvents.at(-1);
    assert.equal(last.row, 2);
    assert.equal(last.col, 3);
    assert.ok(!('index' in last));
  });
});

describe('operationRecords - 效率与快照', () => {
  it('onRecordEfficiency 换算 score10 并保留时间', () => {
    const s = useOperationRecordsStore();
    s.onRecordEfficiency({
      prob: 0.1,
      pMin: 0,
      pMax: 0.5,
      score: 0.86,
      action: 'open',
      index: 3,
      row: 0,
      col: 3,
    });
    assert.equal(s.efficiencyEvents.length, 1);
    assert.equal(s.efficiencyEvents[0].score10, 8.6);
  });

  it('findSnapshotAt 取 ≤ timestamp 的最近快照，无快照返回 null', () => {
    const s = useOperationRecordsStore();
    assert.equal(s.findSnapshotAt(100), null);
    s.appendSnapshot({ action: 'a' });
    s.appendSnapshot({ action: 'b' });
    // 同毫秒内连续快照：早于一切的时间戳回退到首个快照，未来时间戳取到终局快照
    assert.equal(s.findSnapshotAt(0).action, 'a');
    assert.equal(s.findSnapshotAt(Date.now() + 1000).action, 'b');
    assert.equal(s.findFinalSnapshot().action, 'b');
  });

  it('select/clear 与 stop/fresh 状态机', () => {
    const s = useOperationRecordsStore();
    s.selectOperation(7, 123);
    assert.equal(s.selectedIndex, 7);
    assert.equal(s.selectedTimestamp, 123);
    s.onStopOperateRecords();
    assert.equal(s.isShowChart, true);
    s.onFreshOperateRecords();
    assert.equal(s.isShowChart, false);
    assert.equal(s.selectedIndex, null);
    assert.equal(s.operationRecords.operationEvents.length, 0);
    assert.equal(s.operationRecords.startTimeStamp, 0);
  });
});
