import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Banner, Card, SAFETY_NOTICE } from './ui';
import { getNearbyGauges, getWeather, type Gauge, type Weather } from '../lib/safety';
import { useApp } from '../state/app';
import { formatDistance } from '../lib/geo';
import { colors, font, space } from '../theme';

/** Live weather, flood alerts and USGS gauge readings for a coordinate. Says so plainly when data isn't available. */
export function SafetyPanel({ lat, lng }: { lat: number; lng: number }) {
  const { online, imperial } = useApp();
  const [w, setW] = useState<Weather | null>(null);
  const [g, setG] = useState<Gauge[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let live = true;
    if (!online) { setLoading(false); return; }
    setLoading(true);
    Promise.allSettled([getWeather(lat, lng), getNearbyGauges(lat, lng)]).then(([a, b]) => {
      if (!live) return;
      if (a.status === 'fulfilled') setW(a.value); else setErr(true);
      if (b.status === 'fulfilled') setG(b.value);
      setLoading(false);
    });
    return () => { live = false; };
  }, [lat, lng, online]);

  if (!online) return <Banner tone="info" icon="cloud-offline">Weather and water-level data need an internet connection. Check conditions before you lose signal.</Banner>;
  if (loading) return <ActivityIndicator color={colors.forest} style={{ margin: space.lg }} />;

  const flood = w?.alerts.filter((a) => a.isFlood) ?? [];
  const other = w?.alerts.filter((a) => !a.isFlood) ?? [];
  return (
    <View>
      {flood.map((a) => (
        <Banner key={a.id} tone="danger" icon="alert-circle"><Text style={{ fontWeight: '800' }}>{a.event}. </Text>{a.headline}{'\n'}Stay out of the water and away from the creek.</Banner>
      ))}
      {other.map((a) => <Banner key={a.id} tone="warn" icon="warning"><Text style={{ fontWeight: '800' }}>{a.event}. </Text>{a.headline}</Banner>)}
      {w?.supported ? (
        <Card style={{ marginTop: 6 }}>
          <Text style={font.h3}>Forecast</Text>
          {w.forecast.slice(0, 4).map((f) => (
            <View key={f.name} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={[font.body, { flex: 1 }]}>{f.name}</Text>
              <Text style={[font.small, { flex: 2, textAlign: 'right' }]}>{f.temp}°{f.unit} · {f.short}{f.precipChance != null ? ` · ${f.precipChance}% rain` : ''}</Text>
            </View>
          ))}
          <Text style={[font.small, { marginTop: 4 }]}>Source: US National Weather Service. {flood.length === 0 && 'No active flood alerts reported for this point — conditions can still change quickly.'}</Text>
        </Card>
      ) : (
        <Banner tone="info" icon="information-circle">{err ? 'Could not load weather.' : 'Weather and flood alerts are only available for locations in the United States.'}</Banner>
      )}
      {g && g.length > 0 ? (
        <Card style={{ marginTop: 10 }}>
          <Text style={font.h3}>Nearby stream gauges (USGS)</Text>
          {g.map((x) => (
            <View key={x.siteCode} style={{ paddingVertical: 8 }}>
              <Text style={[font.body, { fontWeight: '600' }]} numberOfLines={1}>{x.name}</Text>
              <Text style={font.small}>
                {formatDistance(x.distance_m, imperial)} away · {x.stageFt != null ? `stage ${x.stageFt.toFixed(2)} ft` : ''}{x.stageFt != null && x.dischargeCfs != null ? ' · ' : ''}{x.dischargeCfs != null ? `flow ${Math.round(x.dischargeCfs)} ft³/s` : ''}
                {x.time ? ` · ${new Date(x.time).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
              </Text>
            </View>
          ))}
          <Text style={font.small}>Gauges may be on a different stream than your location. Rising numbers mean rising water.</Text>
        </Card>
      ) : (
        <Text style={[font.small, { marginTop: 8 }]}>No active USGS stream gauges within ~25 km (or outside the US). Water level is unknown here — judge conditions carefully.</Text>
      )}
      <Banner icon="warning">{SAFETY_NOTICE}</Banner>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Ionicons name="home-outline" size={16} color={colors.muted} />
        <Text style={[font.small, { flex: 1 }]}>Property boundaries aren't shown in the app. Stay on public land and marked trails, and respect "No Trespassing" signs.</Text>
      </View>
    </View>
  );
}
