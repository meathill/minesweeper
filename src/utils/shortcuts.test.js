import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchShortcut } from './shortcuts.js';

// 最小事件 stub：只提供 matchShortcut 读取的字段
function keyEvent(key, extra = {}) {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    target: { tagName: 'DIV', isContentEditable: false, closest: () => null },
    ...extra,
  };
}

describe('matchShortcut - Windows 对齐映射', () => {
  it('F2 / N 新开一局', () => {
    assert.equal(matchShortcut(keyEvent('F2')), 'new');
    assert.equal(matchShortcut(keyEvent('n')), 'new');
    assert.equal(matchShortcut(keyEvent('N')), 'new');
  });

  it('H 提示，L 教学模式开关', () => {
    assert.equal(matchShortcut(keyEvent('h')), 'hint');
    assert.equal(matchShortcut(keyEvent('H')), 'hint');
    assert.equal(matchShortcut(keyEvent('l')), 'learn');
    assert.equal(matchShortcut(keyEvent('L')), 'learn');
  });

  it('无关按键返回 null', () => {
    assert.equal(matchShortcut(keyEvent('x')), null);
    assert.equal(matchShortcut(keyEvent('Enter')), null);
    assert.equal(matchShortcut(keyEvent('F1')), null);
    assert.equal(matchShortcut(null), null);
  });

  it('组合键与长按连发不触发', () => {
    assert.equal(matchShortcut(keyEvent('n', { ctrlKey: true })), null);
    assert.equal(matchShortcut(keyEvent('n', { metaKey: true })), null);
    assert.equal(matchShortcut(keyEvent('h', { altKey: true })), null);
    assert.equal(matchShortcut(keyEvent('h', { repeat: true })), null);
  });

  it('输入框 / 可编辑区聚焦时不触发', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      assert.equal(
        matchShortcut(
          keyEvent('n', { target: { tagName, closest: () => null } }),
        ),
        null,
        tagName,
      );
    }
    assert.equal(
      matchShortcut(
        keyEvent('h', {
          target: {
            tagName: 'DIV',
            isContentEditable: true,
            closest: () => null,
          },
        }),
      ),
      null,
    );
  });

  it('弹窗打开时不触发（评论框打字不被吃掉）', () => {
    assert.equal(
      matchShortcut(
        keyEvent('l', { target: { tagName: 'DIV', closest: () => ({}) } }),
      ),
      null,
    );
  });
});
