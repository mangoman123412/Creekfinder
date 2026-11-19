import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeDb } from '../db/local';

/** Re-runs `fn` whenever local data changes (writes from UI, background tracking, or sync). */
export function useDbQuery<T>(fn: () => Promise<T>, deps: unknown[], initial: T): { data: T; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useCallback(() => {
    fnRef.current().then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { run(); }, [run, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const off = subscribeDb(() => { if (t) return; t = setTimeout(() => { t = null; run(); }, 150); });
    return () => { off(); if (t) clearTimeout(t); };
  }, [run]);
  return { data, loading, reload: run };
}

import { signedUrls } from '../lib/community';
import type { Photo } from '../types';

/** Resolves a displayable URI per photo: the local file if present, otherwise a short-lived signed cloud URL. */
export function usePhotoUris(photos: Photo[]): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});
  const key = photos.map((p) => `${p.id}:${p.local_uri ?? ''}:${p.storage_path ?? ''}`).join('|');
  useEffect(() => {
    const m: Record<string, string> = {};
    const remote: Photo[] = [];
    for (const p of photos) { if (p.local_uri) m[p.id] = p.local_uri; else if (p.storage_path) remote.push(p); }
    setMap(m);
    if (remote.length) {
      void signedUrls(remote.map((p) => p.storage_path!)).then((u) => {
        const add: Record<string, string> = {};
        for (const p of remote) { const url = u[p.storage_path!]; if (url) add[p.id] = url; }
        setMap((cur) => ({ ...cur, ...add }));
      }).catch(() => {});
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return map;
}

/** Run an async loader and track loading/error. Reruns when deps change. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; loading: boolean; error: boolean } {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: boolean }>({ data: null, loading: true, error: false });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    fn().then((d) => { if (live) setState({ data: d, loading: false, error: false }); }).catch(() => { if (live) setState({ data: null, loading: false, error: true }); });
    return () => { live = false; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
