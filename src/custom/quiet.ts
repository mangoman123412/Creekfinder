import type { Notifs } from './schema';

const mins = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** Is `now` inside the user's quiet hours? Windows may cross midnight; `days[d]` (0=Sunday) means "the night that STARTS on day d". */
export function isQuietNow(q: Notifs['quiet'], now: Date): boolean {
  if (!q.enabled) return false;
  const from = mins(q.from), to = mins(q.to), cur = now.getHours() * 60 + now.getMinutes();
  if (from === to) return false;
  const day = now.getDay();
  if (from < to) return q.days[day] && cur >= from && cur < to;           // same-day window
  if (cur >= from) return q.days[day];                                     // evening part: the night starts today
  if (cur < to) return q.days[(day + 6) % 7];                              // morning part: the night started yesterday
  return false;
}

/** Decide how to deliver: 'system' (pop-up + sound), 'silent' (inbox only) or 'inbox'. Flood alerts may override quiet hours. */
export function deliveryMode(n: Notifs, cat: string, safety: boolean, now: Date): 'system' | 'inbox' {
  if (n.deliver === 'inbox') return 'inbox';
  if (isQuietNow(n.quiet, now)) return safety && cat === 'flood' && n.quiet.allowFloodDuringQuiet ? 'system' : 'inbox';
  return 'system';
}
