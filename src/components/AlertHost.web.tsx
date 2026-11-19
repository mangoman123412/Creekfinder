import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { setAlertListener, type AlertState } from '../lib/alert.web';
import { colors, font, radius, space } from '../theme';

export function AlertHost() {
  const [a, setA] = useState<AlertState | null>(null);
  useEffect(() => { setAlertListener(setA); return () => setAlertListener(null); }, []);
  if (!a) return null;
  const close = (fn?: () => void) => { setA(null); setTimeout(() => fn?.(), 0); };
  const cancel = a.buttons.find((b) => b.style === 'cancel');
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close(cancel?.onPress)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: space.xl }}>
        <View style={{ backgroundColor: '#fff', borderRadius: radius.lg, padding: space.lg, maxHeight: '85%', maxWidth: 460, width: '100%', alignSelf: 'center' }}>
          <Text style={font.h2}>{a.title}</Text>
          {a.message ? <ScrollView style={{ marginTop: 8 }}><Text style={font.body}>{a.message}</Text></ScrollView> : null}
          <ScrollView style={{ marginTop: space.md }}>
            {a.buttons.map((b, i) => (
              <Pressable key={i} onPress={() => close(b.onPress)} style={{ paddingVertical: 14, borderTopWidth: 1, borderColor: colors.line }} accessibilityRole="button">
                <Text style={{ textAlign: 'center', fontSize: 17, fontWeight: b.style === 'cancel' ? '500' : '700', color: b.style === 'destructive' ? colors.danger : b.style === 'cancel' ? colors.muted : colors.forest }}>{b.text}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
