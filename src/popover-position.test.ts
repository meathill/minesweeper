import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computePopoverPosition } from './utils/popover-position.ts';

describe('computePopoverPosition 视口感知定位兜底', () => {
  it('默认将面板右边缘对齐触发器右边缘，并放在触发器下方', () => {
    const pos = computePopoverPosition(
      { top: 12, bottom: 44, left: 900, right: 980 },
      { width: 220, height: 180 },
      { width: 1280, height: 800 },
    );
    assert.deepEqual(pos, { left: 760, top: 50 });
  });

  it('窄屏左侧空间不足时，自动钳制到视口左安全边距', () => {
    const pos = computePopoverPosition(
      { top: 10, bottom: 42, left: 16, right: 96 },
      { width: 240, height: 160 },
      { width: 375, height: 667 },
    );
    assert.equal(pos.left, 8);
    assert.equal(pos.top, 48);
  });

  it('底部空间不足且上方放得下时，自动翻转到触发器上方', () => {
    const pos = computePopoverPosition(
      { top: 580, bottom: 612, left: 200, right: 300 },
      { width: 180, height: 200 },
      { width: 1024, height: 640 },
    );
    assert.equal(pos.left, 120);
    assert.equal(pos.top, 374);
  });
});
