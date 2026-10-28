/**
 * 当前选中地块的轻量共享状态。
 *
 * 首页先于右侧助农手挂载，只靠 CustomEvent 会漏掉首次选中；
 * 这里额外保存一份模块级值，助农手挂载时可以直接读取。
 */
let current = null;

export function publishFieldContext(field) {
  current = field;
  window.dispatchEvent(new CustomEvent('wentin:field', { detail: field }));
}

export function getFieldContext() {
  return current;
}

export function clearFieldContext() {
  current = null;
  window.dispatchEvent(new CustomEvent('wentin:field', { detail: null }));
}