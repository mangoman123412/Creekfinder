import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { hasBackend, config } from '../config';
import { subscribeDb, wipeLocal, kvGet, kvSet } from '../db/local';
import { syncNow, pendingCount } from '../db/sync';
import { billingLogin, currentPremium, onPremiumChange, billingConfigured } from '../lib/entitlements';
import { FREE_PLACE_LIMIT } from '../config';

interface Ctx {
  user: User | null;
  ready: boolean;
  online: boolean;
  premium: boolean;
  syncing: boolean;
  pending: number;
  lastSyncError: string | null;
  placeLimit: number;
  imperial: boolean;
  setImperial: (v: boolean) => void;
  displayName: string;
  sync: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshPremium: () => Promise<void>;
  devPremium: boolean;
  setDevPremium: (v: boolean) => void;
}

const AppCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [storePremium, setStorePremium] = useState(false);
  const [serverPremium, setServerPremium] = useState(false);
  const [devPremium, setDevPremium] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [imperial, setImperialState] = useState(true);
  const [displayName, setDisplayName] = useState('Explorer');
  const uid = session?.user.id ?? null;
  const onlineRef = useRef(true);
  onlineRef.current = online;

  useEffect(() => {
    void kvGet('imperial').then((v) => { if (v != null) setImperialState(v === '1'); });
    if (!supabase) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => NetInfo.addEventListener((s) => setOnline(!!s.isConnected && s.isInternetReachable !== false)), []);

  // Billing identity + profile
  useEffect(() => {
    void billingLogin(uid).then(() => currentPremium().then(setStorePremium));
    const off = onPremiumChange(setStorePremium);
    if (supabase && uid) {
      supabase.from('profiles').select('is_premium,display_name').eq('id', uid).maybeSingle().then(({ data }) => {
        setServerPremium(!!data?.is_premium);
        if (data?.display_name) setDisplayName(data.display_name);
      });
    } else { setServerPremium(false); }
    return off;
  }, [uid]);

  const sync = useCallback(async () => {
    if (!uid || !onlineRef.current) { setPending(await pendingCount()); return; }
    setSyncing(true);
    try {
      const r = await syncNow(uid);
      setErr(r.errors[0] ?? null);
    } catch (e: any) { setErr(e?.message ?? 'Sync failed'); }
    setSyncing(false);
    setPending(await pendingCount());
  }, [uid]);

  // Sync: on sign-in, when connectivity returns, when app returns to foreground, and shortly after any local change.
  useEffect(() => { if (uid && online) void sync(); }, [uid, online, sync]);
  useEffect(() => {
    const s = AppState.addEventListener('change', (st) => { if (st === 'active') void sync(); });
    return () => s.remove();
  }, [sync]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const off = subscribeDb(() => {
      if (t) clearTimeout(t);
      t = setTimeout(() => { void sync(); }, 2500);
    });
    void pendingCount().then(setPending);
    return () => { off(); if (t) clearTimeout(t); };
  }, [sync]);

  const signOut = useCallback(async () => {
    // Don't leave the previous person's private places on the device.
    if (uid && onlineRef.current) { try { await syncNow(uid); } catch {} }
    await supabase?.auth.signOut();
    await wipeLocal();
  }, [uid]);

  const refreshPremium = useCallback(async () => { setStorePremium(await currentPremium()); }, []);
  const setImperial = (v: boolean) => { setImperialState(v); void kvSet('imperial', v ? '1' : '0'); };

  const premium = config.unlockAll || storePremium || serverPremium || (__DEV__ && devPremium);
  const value = useMemo<Ctx>(() => ({
    user: session?.user ?? null, ready, online, premium, syncing, pending, lastSyncError: err, placeLimit: premium ? Infinity : FREE_PLACE_LIMIT,
    imperial, setImperial, displayName, sync, signOut, refreshPremium, devPremium, setDevPremium,
  }), [session, ready, online, premium, syncing, pending, err, imperial, displayName, sync, signOut, refreshPremium, devPremium]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export { hasBackend, billingConfigured };
