export function arrayMove<T>(arr: readonly T[], from: number, to: number): T[] {
  const a = arr.slice(); if (from < 0 || from >= a.length) return a;
  const [x] = a.splice(from, 1); a.splice(Math.max(0, Math.min(a.length, to)), 0, x); return a;
}
