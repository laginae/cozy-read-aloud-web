// Follow source-ordered lines, never a union spanning two PDF columns.
export function followTarget(rects, fraction = 0) {
  if (!rects?.length) return null;
  const weights = rects.map(r => Math.max(1, r.right - r.left));
  let remaining = Math.max(0, Math.min(.999999, Number(fraction) || 0)) * weights.reduce((a, b) => a + b, 0);
  let index = 0;
  while (index < weights.length - 1 && remaining >= weights[index]) remaining -= weights[index++];
  return { ...rects[index], index };
}

export function followDelta(target, viewport, margin = 28) {
  if (!target || viewport.bottom - viewport.top <= margin * 2) return { x: 0, y: 0 };
  const y = target.top < viewport.top + margin || target.bottom > viewport.bottom - margin
    ? target.top - viewport.top - margin : 0;
  const x = target.left < viewport.left + margin || target.right > viewport.right - margin
    ? target.left - viewport.left - margin : 0;
  return { x, y };
}
