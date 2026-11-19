import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Button } from './ui';
import { colors, font, radius, space } from '../theme';

/** Cross-platform text prompt (Alert.prompt is iOS-only). */
export function TextPrompt({ visible, title, initial, placeholder, confirmLabel = 'Save', onCancel, onSubmit }: {
  visible: boolean; title: string; initial?: string; placeholder?: string; confirmLabel?: string; onCancel: () => void; onSubmit: (v: string) => void;
}) {
  const [v, setV] = useState(initial ?? '');
  useEffect(() => { if (visible) setV(initial ?? ''); }, [visible, initial]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: space.xl }}>
        <Pressable style={{ position: 'absolute', inset: 0 }} onPress={onCancel} />
        <View style={{ backgroundColor: '#fff', borderRadius: radius.lg, padding: space.lg }}>
          <Text style={font.h2}>{title}</Text>
          <TextInput autoFocus value={v} onChangeText={setV} placeholder={placeholder} maxLength={80} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, fontSize: 16, marginVertical: space.md }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button variant="secondary" title="Cancel" onPress={onCancel} style={{ flex: 1 }} />
            <Button title={confirmLabel} onPress={() => v.trim() && onSubmit(v.trim())} disabled={!v.trim()} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
