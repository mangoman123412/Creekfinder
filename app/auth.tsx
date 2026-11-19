import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, View } from 'react-native';
import { Text } from '../src/components/ui';
import { Alert } from '../src/lib/alert';
import { useRouter } from 'expo-router';
import { Banner, Button, Field } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { config, hasBackend } from '../src/config';
import { colors, font, space } from '../src/theme';

export default function Auth() {
  const router = useRouter();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  if (!hasBackend || !supabase) {
    return <View style={{ padding: space.xl, backgroundColor: colors.sand, flex: 1 }}><Banner tone="info" icon="information-circle">Accounts aren't connected yet. Add your Supabase URL and key (docs/SETUP.md). Everything else works locally on this phone.</Banner></View>;
  }
  const sb = supabase;
  const go = async () => {
    if (!email.includes('@') || pw.length < 8) { Alert.alert('Check your details', 'Enter a valid email and a password of at least 8 characters.'); return; }
    setBusy(true);
    try {
      if (mode === 'up') {
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password: pw });
        if (error) throw error;
        if (!data.session) { Alert.alert('Check your email', 'We sent a confirmation link. Confirm your email, then sign in.'); setMode('in'); return; }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
      }
      router.back();
    } catch (e: any) { Alert.alert(mode === 'up' ? 'Could not sign up' : 'Could not sign in', e.message ?? 'Try again.'); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    if (!email.includes('@')) { Alert.alert('Enter your email first'); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email.trim());
    Alert.alert(error ? 'Could not send' : 'Check your email', error ? error.message : 'If an account exists, a reset link is on its way.');
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.sand }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.xl }} keyboardShouldPersistTaps="handled">
        <Text style={font.h1}>{mode === 'in' ? 'Welcome back' : 'Create your account'}</Text>
        <Text style={[font.small, { marginVertical: space.md, fontSize: 14 }]}>An account backs up your places across phones and lets you share creeks with the community. Everything you've already saved on this phone is kept and uploaded to your account.</Text>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
        <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry autoComplete={mode === 'in' ? 'current-password' : 'new-password'} textContentType={mode === 'in' ? 'password' : 'newPassword'} placeholder="At least 8 characters" />
        <Button title={mode === 'in' ? 'Sign in' : 'Create account'} onPress={go} loading={busy} />
        <View style={{ height: 10 }} />
        <Button variant="ghost" title={mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'} onPress={() => setMode(mode === 'in' ? 'up' : 'in')} />
        {mode === 'in' && <Button variant="ghost" title="Forgot password?" onPress={reset} />}
        {mode === 'up' && (
          <Text style={[font.small, { textAlign: 'center', marginTop: 8 }]}>
            By creating an account you agree to the{' '}
            <Text style={{ color: colors.water }} onPress={() => router.push('/legal/terms')}>Terms of Service</Text> and{' '}
            <Text style={{ color: colors.water }} onPress={() => router.push('/legal/privacy')}>Privacy Policy</Text>.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
