import { AppState } from 'react-native';
import { getSettings } from './store';
import { deliveryMode } from './quiet';
import { NOTIF_META, type NotifCat } from './schema';
import { addNotification, kvGet, kvSet, listTrips } from '../db/local';
import { lastKnown } from '../lib/location';
import { getWeather } from '../lib/safety';
import { searchCommunity, searchOsmWater } from '../lib/explore';
import { supabase } from '../lib/supabase';
import { deliverSystem } from './deliver';
import { isOnline } from '../lib/net';

/**
 * Notification engine. Runs while the app is open (launch, foreground, every 10 minutes) and fills the in-app inbox,
 * then delivers a system notification + sound according to the user's categories, quiet hours and sound choices.
 * NOTE: closed-app push notifications need a push server (not included) — these checks cannot run when the app is fully closed.
 */
async function emit(cat: NotifCat, title: string, body: string, dedupe: string, ref?: string) {
  const n = getSettings().notifications;
  if (!n.enabled[cat]) return;
  const safety = NOTIF_META[cat].safety;
  const fresh = await addNotification({ cat, safety, title, body, ref, dedupe });
  if (!fresh) return;
  if (deliveryMode(n, cat, safety, new Date()) === 'system') await deliverSystem(title, body, safety, safety ? n.sounds.safety : n.sounds.social);
}

async function seenSet(key: string): Promise<Set<string> | null> { const raw = await kvGet(key); return raw ? new Set(JSON.parse(raw)) : null; }

let running = false;
export async function runAlertChecks(userId?: string | null) {
  if (running) return; running = true;
  try {
    const n = getSettings().notifications;
    const on = (c: NotifCat) => n.enabled[c];
    // ---- trips (no network needed)
    if (on('trips')) {
      const lead = n.tripLeadHours * 3600e3;
      for (const t of await listTrips()) { const at = new Date(t.date + 'T08:00').getTime(); const dt = at - Date.now(); if (dt > -12 * 3600e3 && dt < lead) await emit('trips', `Trip: ${t.name}`, `${new Date(t.date + 'T12:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} · ${t.stops.length} stop${t.stops.length === 1 ? '' : 's'}. Check conditions before you go.`, `trip:${t.id}:${t.date}`); }
    }
    if (!(await isOnline())) return;
    const me = await lastKnown();
    // ---- safety: NWS alerts for where you are
    if (me && (on('flood') || on('weather'))) {
      try { const w = await getWeather(me.lat, me.lng); for (const a of w.alerts) await emit(a.isFlood ? 'flood' : 'weather', a.event, `${a.headline}${a.isFlood ? ' Stay out of the water and away from the creek.' : ''}`, `nws:${a.id}`); } catch {}
    }
    // ---- discoveries near you (first run only records what exists, so you aren't spammed)
    if (me && (on('nearby') || on('waterfalls'))) {
      try {
        const items = (await searchOsmWater(me, 20000)).filter((i) => i.name !== 'Water' && i.name !== 'Waterfall (unnamed)');
        const seen = await seenSet('seen_osm');
        if (seen) {
          const fresh = items.filter((i) => !seen.has(i.key));
          const falls = fresh.filter((i) => i.kind === 'waterfall'), creeks = fresh.filter((i) => i.kind !== 'waterfall');
          if (falls.length) await emit('waterfalls', `${falls.length} new waterfall${falls.length > 1 ? 's' : ''} near you`, falls.slice(0, 3).map((f) => f.name).join(', '), `osm-falls:${falls.map((f) => f.key).sort().join(',').slice(0, 120)}`);
          if (creeks.length) await emit('nearby', `${creeks.length} new water spot${creeks.length > 1 ? 's' : ''} near you`, creeks.slice(0, 3).map((f) => f.name).join(', '), `osm-near:${creeks.map((f) => f.key).sort().join(',').slice(0, 120)}`);
        }
        await kvSet('seen_osm', JSON.stringify(items.map((i) => i.key).slice(0, 400)));
      } catch {}
    }
    if (me && on('community') && supabase && userId) {
      try {
        const items = await searchCommunity(me, 100000); const seen = await seenSet('seen_comm');
        if (seen) { const fresh = items.filter((i) => !seen.has(i.key)); if (fresh.length) await emit('community', `${fresh.length} new creek${fresh.length > 1 ? 's' : ''} shared near you`, fresh.slice(0, 3).map((f) => f.name).join(', '), `comm:${fresh.map((f) => f.key).sort().join(',').slice(0, 120)}`); }
        await kvSet('seen_comm', JSON.stringify(items.map((i) => i.key).slice(0, 400)));
      } catch {}
    }
    // ---- activity on places YOU shared
    if (supabase && userId && (on('comments') || on('saved'))) {
      try {
        const since = (await kvGet('last_social_check')) ?? new Date(Date.now() - 86400e3).toISOString();
        const { data: mine } = await supabase.from('places').select('id,name').eq('user_id', userId).eq('visibility', 'public').is('deleted_at', null).limit(100);
        const ids = (mine ?? []).map((p) => p.id); const names = new Map((mine ?? []).map((p) => [p.id, p.name]));
        if (ids.length) {
          if (on('comments')) { const { data } = await supabase.from('comments').select('id,place_id,user_id,created_at').in('place_id', ids).gt('created_at', since).neq('user_id', userId).limit(50); for (const c of data ?? []) await emit('comments', 'New comment', `Someone commented on “${names.get(c.place_id)}”.`, `comment:${c.id}`, c.place_id); }
          if (on('saved')) {
            const { data: r } = await supabase.from('ratings').select('place_id,user_id,updated_at').in('place_id', ids).gt('updated_at', since).neq('user_id', userId).limit(50); for (const x of r ?? []) await emit('saved', 'New rating', `“${names.get(x.place_id)}” got a new rating.`, `rating:${x.place_id}:${x.user_id}:${x.updated_at}`, x.place_id);
            const { data: ph } = await supabase.from('photos').select('id,place_id,user_id').in('place_id', ids).gt('created_at', since).neq('user_id', userId).limit(50); for (const x of ph ?? []) await emit('saved', 'New photo', `An explorer added a photo to “${names.get(x.place_id)}”.`, `photo:${x.id}`, x.place_id);
          }
        }
        await kvSet('last_social_check', new Date().toISOString());
      } catch {}
    }
  } finally { running = false; }
}

/** Start periodic checks; returns a stop function. */
export function startAlertLoop(getUserId: () => string | null) {
  const go = () => { void runAlertChecks(getUserId()); };
  const first = setTimeout(go, 4000); const t = setInterval(go, 10 * 60 * 1000);
  const sub = AppState.addEventListener('change', (s) => { if (s === 'active') go(); });
  return () => { clearTimeout(first); clearInterval(t); sub.remove(); };
}
