import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { transferEventsToData, formatTimeLabel } from './chart-data.js';

const START = 1000000;
function ev(type, offsetSec, extra = {}) {
  return { clickTimestamp: START + offsetSec * 1000, type, index: 0, ...extra };
}

describe('chart-data', () => {
  it('formatTimeLabel 各种时长', () => {
    assert.equal(formatTimeLabel(0), '0:00');
    assert.equal(formatTimeLabel(65), '1:05');
    assert.equal(formatTimeLabel(3671), '1:01:11');
  });

  it('RPM 桶聚合：短局按 6s 分桶,空桶补 0', () => {
    const events = [
      ev('open', 1),
      ev('openSave', 2),
      ev('flag', 7, { flagState: 'flag' }),
      ev('doubleClick', 8),
    ];
    const { buckets, isMinuteScale } = transferEventsToData({ events, startTimeStamp: START });
    assert.equal(isMinuteScale, false);
    // 总时长 8s → ceil(8/6)=2 号桶,补全 0..2 共 3 个桶,间隙不会被插值成假操作
    assert.equal(buckets.length, 3);
    assert.equal(buckets[0].flag, 0); // 空桶存在且为 0
    assert.equal(buckets[1].open, 1);
    assert.equal(buckets[1].openSave, 1);
    assert.equal(buckets[2].flag, 1);
    assert.equal(buckets[2].doubleClick, 1);
  });

  it('长局（>100s）切换为分钟刻度', () => {
    const events = [ev('open', 130)];
    const { isMinuteScale, buckets } = transferEventsToData({ events, startTimeStamp: START });
    assert.equal(isMinuteScale, true);
    // 总时长 130s → 22 个桶 + 初始,最后一个桶 interval = 2.2min
    assert.equal(buckets.length, 23);
    assert.equal(buckets[buckets.length - 1].interval, 2.2);
    assert.equal(buckets[22].open, 1);
  });

  it('效率点带 pMin/pMax 且按时间排序', () => {
    const eff = [
      { clickTimestamp: START + 5000, timeSinceStartSec: 5, prob: 0.1, pMin: 0, pMax: 0.3, score10: 8, action: 'open', index: 3, row: 0, col: 3 },
      { clickTimestamp: START + 1000, timeSinceStartSec: 1, prob: 0.9, pMin: 0.1, pMax: 0.9, score10: 10, action: 'flag', index: 1, row: 0, col: 1 },
    ];
    const { effPoints } = transferEventsToData({ events: [], efficiencyEvents: eff, startTimeStamp: START });
    assert.equal(effPoints.length, 2);
    assert.equal(effPoints[0].timeSinceStartSec ?? effPoints[0].x, effPoints[0].x);
    assert.equal(effPoints[0].pMin, 0.1); // 排序后第一个是 1s 的
    assert.equal(effPoints[0].score10, 10);
    assert.equal(effPoints[1].score10, 8);
  });

  it('地雷概率点只含 open/chord', () => {
    const eff = [
      { clickTimestamp: START + 1000, timeSinceStartSec: 1, prob: 0.2, action: 'open' },
      { clickTimestamp: START + 2000, timeSinceStartSec: 2, prob: 0.5, action: 'flag' },
      { clickTimestamp: START + 3000, timeSinceStartSec: 3, prob: 0.3, action: 'chord' },
    ];
    const { probPoints } = transferEventsToData({ events: [], efficiencyEvents: eff, startTimeStamp: START });
    assert.equal(probPoints.length, 2);
    assert.deepEqual(probPoints.map((p) => p.action), ['open', 'chord']);
  });

  it('openSave 连开去重：同一格 50ms 内只留一条', () => {
    const events = [
      ev('openSave', 1, { index: 5 }),
      ev('openSave', 1.02, { index: 5 }),
      ev('openSave', 1.3, { index: 5 }),
    ];
    const { openPoints } = transferEventsToData({ events, startTimeStamp: START });
    assert.equal(openPoints.length, 2);
  });

  it('旗散点保留 flagState 供 tooltip', () => {
    const events = [ev('flag', 3, { flagState: 'question', index: 7 })];
    const { flagPoints } = transferEventsToData({ events, startTimeStamp: START });
    assert.equal(flagPoints.length, 1);
    assert.equal(flagPoints[0].flagState, 'question');
  });
});
