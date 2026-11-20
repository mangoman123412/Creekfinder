import React, { useEffect, useState } from 'react';
import { themed } from '../src/custom/themed';
import { ScrollView, View } from 'react-native';
import { Text } from '../src/components/ui';
import { Alert } from '../src/lib/alert';
import { Banner, Button, Card, SectionTitle, SAFETY_NOTICE } from '../src/components/ui';
import { SafetyPanel } from '../src/components/SafetyPanel';
import { ensureForegroundPermission, getPreciseFix, lastKnown } from '../src/lib/location';
import { shareLocation } from '../src/lib/actions';
import { formatCoords, formatDMS } from '../src/lib/geo';
import { colors, font, space } from '../src/theme';

const TIPS = [
  'Never enter fast-moving, rising, muddy or flooded water. Flash floods can arrive from storms miles upstream with no rain where you are.',
  'Check the forecast and flood alerts before you go, and again before you leave the car.',
  'Do not jump from heights into water you have not checked, and never swim alone.',
  'Tell someone your plan and expected return time. Share your location below before you lose signal.',
  'Cell service is often missing at creeks. Download offline maps and test them in Airplane Mode before you go.',
  'Respect private property, posted signs and fences. If you cannot confirm public access, do not go. CreekFinder never shows property lines and cannot tell you where you may legally enter.',
  'Wear sturdy shoes, bring water, watch for slippery rocks, snakes, ticks and poison ivy.',
  'In an emergency call 911 (or your local emergency number). Give the coordinates below.',
];

function Safety() {
  const [pos, setPos] = useState<{ lat: number; lng: number; acc: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void (async () => { if (await ensureForegroundPermission()) { const l = await lastKnown(); if (l) setPos({ lat: l.lat, lng: l.lng, acc: l.accuracy }); } })(); }, []);

  const share = async () => {
    setBusy(true);
    try {
      if (!(await ensureForegroundPermission())) { Alert.alert('Location off', 'Allow location access to share where you are.'); return; }
      const f = await getPreciseFix({ timeoutMs: 8000 });
      setPos({ lat: f.lat, lng: f.lng, acc: f.accuracy });
      await shareLocation('My location', f.lat, f.lng, true);
    } catch (e: any) { Alert.alert('Could not get location', e.message); } finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.sand }} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <Banner tone="danger" icon="alert-circle">{SAFETY_NOTICE}</Banner>
      <Card style={{ marginTop: space.sm }}>
        <Text style={font.h2}>Share my location</Text>
        <Text style={[font.small, { marginVertical: 6 }]}>Sends your exact GPS coordinates and map links by message, email or any app, so someone knows where to find you.</Text>
        {pos && <Text selectable style={[font.body, { fontWeight: '700' }]}>{formatCoords(pos.lat, pos.lng, 6)}{'\n'}<Text style={font.small}>{formatDMS(pos.lat, pos.lng)}{pos.acc ? ` · ±${Math.round(pos.acc)} m` : ''}</Text></Text>}
        <View style={{ marginTop: 10 }}><Button variant="danger" icon="share" title="Share my GPS location" onPress={share} loading={busy} /></View>
        <Text style={[font.small, { marginTop: 8 }]}>CreekFinder cannot call emergency services for you. If someone is in danger, call 911 (or your local number).</Text>
      </Card>
      <SectionTitle>Conditions at your location</SectionTitle>
      {pos ? <SafetyPanel lat={pos.lat} lng={pos.lng} /> : <Text style={font.small}>Allow location access to see local weather, flood alerts and nearby stream gauges.</Text>}
      <SectionTitle>Stay safe</SectionTitle>
      {TIPS.map((t, i) => <Text key={i} style={[font.body, { marginBottom: 10 }]}>•  {t}</Text>)}
    </ScrollView>
  );
}
export default themed(Safety);
