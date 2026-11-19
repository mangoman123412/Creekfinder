import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { Banner, Text } from '../src/components/ui';
import { SafetyPanel } from '../src/components/SafetyPanel';
import { ensureForegroundPermission, lastKnown } from '../src/lib/location';
import { colors, font, space } from '../src/theme';

/** "Notifications" = real weather & flood alerts for where you are right now. */
export default function Alerts() {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => { void (async () => { if (!(await ensureForegroundPermission())) { setDenied(true); return; } const l = await lastKnown(); if (l) setPos(l); })(); }, []);
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <Text style={font.h1}>Alerts near you</Text>
      <Text style={[font.small, { marginVertical: 8 }]}>Active weather and flood alerts for your current location, plus nearby stream gauges. Push notifications aren't enabled — check here before you head out.</Text>
      {denied && <Banner tone="info" icon="location">Allow location access to see alerts for where you are.</Banner>}
      {pos ? <SafetyPanel lat={pos.lat} lng={pos.lng} /> : !denied && <Text style={font.small}>Finding your location…</Text>}
    </ScrollView>
  );
}
