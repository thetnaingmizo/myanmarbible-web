// Study guides (A12) are timed for a real meeting: the section minutes must
// add up to the length the leader picked, whatever the model returned.

/** Scales [minutes] to sum exactly to [total], each at least [min]. */
export function fitMinutes(minutes: number[], total: number, min = 2): number[] {
  if (minutes.length === 0) return [];
  const safe = minutes.map((m) => (Number.isFinite(m) && m > 0 ? m : min));
  const sum = safe.reduce((a, b) => a + b, 0);
  const scaled = safe.map((m) => Math.max(min, Math.round((m / sum) * total)));
  // Put the rounding difference on the longest section.
  let diff = total - scaled.reduce((a, b) => a + b, 0);
  const order = scaled.map((m, i) => [m, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  for (let k = 0; diff !== 0 && k < 100; k++) {
    const i = order[k % order.length];
    const step = diff > 0 ? 1 : -1;
    if (scaled[i] + step < min) continue;
    scaled[i] += step;
    diff -= step;
  }
  return scaled;
}
