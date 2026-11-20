import React from 'react';
import { subscribe, getLibrary } from './store';
import { useSyncExternalStore } from 'react';

/** Re-render a screen whenever customization changes (no remount, so navigation + scroll position survive). */
export function useCustomizationVersion() { return useSyncExternalStore(subscribe, () => getLibrary().updatedAt + getLibrary().activeProfileId, () => ''); }

export function themed<P extends object>(C: React.ComponentType<P>): React.ComponentType<P> {
  const W = (props: P) => { useCustomizationVersion(); return <C {...props} />; };
  W.displayName = `themed(${C.displayName || C.name || 'Screen'})`;
  return W;
}
