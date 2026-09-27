// 全局快捷键映射（Windows 版扫雷对齐：F2 新开一局是经典键位）。
// H（提示）、L（教学模式开关）是本站学习功能的扩展键。
// 纯函数：只读 event，返回 'new' | 'hint' | 'learn' | null，不做 preventDefault（调用方按需做）。
export function matchShortcut(event) {
  if (!event || typeof event.key !== 'string') return null;
  // 组合键留给浏览器/系统；长按连发不重复触发
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
    return null;
  }
  const target = event.target;
  if (target) {
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return null;
    if (target.isContentEditable) return null;
    // 弹窗（评论等）打开时不抢键
    if (
      typeof target.closest === 'function' &&
      target.closest('dialog[open]')
    ) {
      return null;
    }
  }
  switch (event.key.toLowerCase()) {
    case 'f2':
    case 'n':
      return 'new';
    case 'h':
      return 'hint';
    case 'l':
      return 'learn';
    default:
      return null;
  }
}
