import type { SoundId } from './schema';

export async function notifPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission === 'default' ? 'undetermined' : (Notification.permission as any);
}
export async function requestNotifPermission(): Promise<boolean> { if (typeof Notification === 'undefined') return false; return (await Notification.requestPermission()) === 'granted'; }

let ctx: AudioContext | null = null;
/** Web: real, distinct sounds generated with WebAudio (no files needed). */
export function previewSound(s: SoundId) {
  if (s === 'silent') return;
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext; ctx = ctx ?? new AC();
    const c = ctx!; const t0 = c.currentTime;
    const tone = (f: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.18) => { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + start); g.gain.linearRampToValueAtTime(vol, t0 + start + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur); o.connect(g).connect(c.destination); o.start(t0 + start); o.stop(t0 + start + dur + 0.05); };
    if (s === 'siren') { for (let i = 0; i < 3; i++) { tone(880, i * 0.5, 0.24, 'square', 0.12); tone(660, i * 0.5 + 0.25, 0.24, 'square', 0.12); } }
    else if (s === 'chime') { tone(784, 0, 0.5); tone(1047, 0.18, 0.7); tone(1319, 0.36, 0.9); }
    else tone(880, 0, 0.18, 'triangle');
  } catch {}
}
export async function deliverSystem(title: string, body: string, safety: boolean, sound: SoundId) {
  previewSound(sound);
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration();
    const t = safety ? `⚠ SAFETY · ${title}` : title;
    if (reg) await reg.showNotification(t, { body, icon: `${(window as any).__BASE__ ?? ''}/icon-192.png`, tag: `cf-${Date.now()}`, requireInteraction: safety });
    else new Notification(t, { body });
  } catch {}
}
export const canChooseSound = true;
