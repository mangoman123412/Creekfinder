import { supabase } from './supabase';

export interface Comment { id: string; user_id: string; body: string; created_at: string; author: string }
export interface PublicPlace {
  id: string; user_id: string; name: string; kind: string; lat: number; lng: number; description: string | null; water_notes: string | null;
  depth_notes: string | null; surroundings: string | null; notes: string | null; verified: boolean; created_at: string; author: string;
  avg_rating: number | null; rating_count: number; my_rating: number | null;
}
export interface PublicPhoto { id: string; url: string }

const need = () => { if (!supabase) throw new Error('Community features need an account and an internet connection.'); return supabase; };

export async function getPublicPlace(id: string, myId: string | null): Promise<PublicPlace | null> {
  const sb = need();
  const { data: p, error } = await sb.from('places').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!p) return null;
  const [{ data: prof }, { data: rs }] = await Promise.all([
    sb.from('profiles').select('display_name').eq('id', p.user_id).maybeSingle(),
    sb.from('ratings').select('user_id,stars').eq('place_id', id),
  ]);
  const stars = (rs ?? []).map((r) => r.stars as number);
  return {
    ...p, author: prof?.display_name ?? 'Explorer', avg_rating: stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : null,
    rating_count: stars.length, my_rating: myId ? ((rs ?? []).find((r) => r.user_id === myId)?.stars ?? null) : null,
  };
}

export async function getPlacePhotos(placeId: string): Promise<PublicPhoto[]> {
  const sb = need();
  const { data } = await sb.from('photos').select('id,storage_path').eq('place_id', placeId).is('deleted_at', null).order('created_at');
  if (!data?.length) return [];
  const { data: signed } = await sb.storage.from('photos').createSignedUrls(data.map((d) => d.storage_path), 3600);
  const out: PublicPhoto[] = [];
  data.forEach((d, i) => { const u = signed?.[i]?.signedUrl; if (u) out.push({ id: d.id, url: u }); });
  return out;
}

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!supabase || !paths.length) return {};
  const { data } = await supabase.storage.from('photos').createSignedUrls(paths, 3600);
  const m: Record<string, string> = {};
  data?.forEach((d, i) => { if (d.signedUrl) m[paths[i]] = d.signedUrl; });
  return m;
}

export async function getComments(placeId: string): Promise<Comment[]> {
  const sb = need();
  const { data, error } = await sb.from('comments').select('id,user_id,body,created_at').eq('place_id', placeId).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  const ids = [...new Set((data ?? []).map((c) => c.user_id))];
  const { data: profs } = ids.length ? await sb.from('profiles').select('id,display_name').in('id', ids) : { data: [] as { id: string; display_name: string }[] };
  const names = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
  return (data ?? []).map((c) => ({ ...c, author: names.get(c.user_id) ?? 'Explorer' }));
}
export async function addComment(placeId: string, userId: string, body: string) {
  const { error } = await need().from('comments').insert({ place_id: placeId, user_id: userId, body: body.trim() });
  if (error) throw error;
}
export async function deleteComment(id: string) {
  const { error } = await need().from('comments').delete().eq('id', id);
  if (error) throw error;
}
export async function rate(placeId: string, userId: string, stars: number) {
  const { error } = await need().from('ratings').upsert({ place_id: placeId, user_id: userId, stars });
  if (error) throw error;
}
export type ReportReason = 'incorrect' | 'dangerous' | 'private_property' | 'inappropriate' | 'spam' | 'other';
export async function report(userId: string, args: { placeId?: string; commentId?: string; reason: ReportReason; details?: string }) {
  const { error } = await need().from('reports').insert({ reporter_id: userId, place_id: args.placeId ?? null, comment_id: args.commentId ?? null, reason: args.reason, details: args.details ?? null });
  if (error) throw error;
}
export async function blockUser(userId: string, blockedId: string) {
  const { error } = await need().from('user_blocks').upsert({ blocker_id: userId, blocked_id: blockedId });
  if (error) throw error;
}
export async function updateDisplayName(userId: string, name: string) {
  const { error } = await need().from('profiles').update({ display_name: name.trim() }).eq('id', userId);
  if (error) throw error;
}

/** Account deletion: remove the user's photos from storage, then delete the auth user + cascade all data. */
export async function deleteAccountRemote(userId: string) {
  const sb = need();
  for (;;) {
    const { data } = await sb.storage.from('photos').list(userId, { limit: 100 });
    if (!data?.length) break;
    const { error } = await sb.storage.from('photos').remove(data.map((f) => `${userId}/${f.name}`));
    if (error) break;
  }
  const { error } = await sb.rpc('delete_my_account');
  if (error) throw error;
  await sb.auth.signOut();
}

/** Upload a photo to a PUBLIC place owned by someone else (needs internet). */
export async function uploadCommunityPhoto(placeId: string, userId: string, localUri: string) {
  const sb = need();
  const { readBytes } = await import('./photos');
  const id = (globalThis.crypto as any)?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `${userId}/${id}.jpg`;
  const up = await sb.storage.from('photos').upload(path, await readBytes(localUri), { contentType: 'image/jpeg', upsert: true });
  if (up.error) throw up.error;
  const { error } = await sb.from('photos').insert({ id, user_id: userId, place_id: placeId, storage_path: path });
  if (error) { await sb.storage.from('photos').remove([path]); throw error; }
}
