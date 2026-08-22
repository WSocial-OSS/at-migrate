const UNITS = ['KB', 'MB', 'GB', 'TB'] as const

/** Human-readable size for receipts. `n` is a non-negative finite byte count. */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) {
    throw new RangeError(`formatBytes: expected a non-negative finite number, got ${n}`)
  }
  if (n < 1024) return `${n} B`
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${UNITS[i]}`
}
