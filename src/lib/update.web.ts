/** Web/PWA: detect a newer deploy, clear the offline app cache and reload into it. */
export const canUpdate = true;
export const buildId = (): string => (window as any).__BUILD__ ?? 'dev';
const base = () => ((window as any).__BASE__ ?? '') as string;

export async function checkForUpdate(force = false): Promise<'current' | 'updating' | 'unknown'> {
  try {
    const r = await fetch(`${base()}/build.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return 'unknown';
    const { id } = await r.json();
    if (!force && (id === buildId() || buildId() === 'dev')) return 'current';
    if (force && id === buildId()) { /* still refresh caches */ }
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((g) => g.unregister()));
    const keys = (await caches?.keys()) ?? [];
    await Promise.all(keys.filter((k) => k.startsWith('cf-app')).map((k) => caches.delete(k)));
    location.reload();
    return 'updating';
  } catch { return 'unknown'; }
}
