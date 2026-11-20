import React, { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, TextInput, useColorScheme, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../src/custom/Icon';
import { Alert } from '../src/lib/alert';
import { Banner, Button, Chip, IconButton, Pill, Pressy, Skeleton, Stars, Text } from '../src/components/ui';
import { MiniPhone } from '../src/custom/MiniPhone';
import { CreekMap } from '../src/components/CreekMap';
import { communityDesigns, noteDownload, officialDesigns, payloadOf, publishDesign, rateDesign, type Design, type DesignKind } from '../src/custom/market';
import { activeProfile, addImportedProfile, applyThemeSpec, createMapPreset, mutate, saveTheme, switchProfile, useSettings, getMapPreset } from '../src/custom/store';
import { resolveSeeds } from '../src/custom/themeEngine';
import { useApp } from '../src/state/app';
import { hasBackend } from '../src/config';
import { colors, font, radius, shadow } from '../src/theme';
import { themed } from '../src/custom/themed';
import type { Settings } from '../src/custom/schema';

const KINDS: { id: DesignKind; label: string; icon: string }[] = [{ id: 'theme', label: 'Themes', icon: 'color-palette' }, { id: 'layout', label: 'Layouts', icon: 'grid' }, { id: 'profile', label: 'Profiles', icon: 'person-circle' }, { id: 'mappreset', label: 'Maps', icon: 'map' }];

function Marketplace() {
  const router = useRouter(); const { user, online } = useApp(); const live = useSettings(); const sys = useColorScheme() === 'dark';
  const [kind, setKind] = useState<DesignKind>('theme');
  const [community, setCommunity] = useState<Design[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [prev, setPrev] = useState<Design | null>(null);
  const [pub, setPub] = useState(false); const [pname, setPname] = useState(''); const [pdesc, setPdesc] = useState('');

  const load = useCallback(async () => { setCommunity(null); setErr(null); if (!hasBackend || !online) { setCommunity([]); return; } try { setCommunity(await communityDesigns(kind)); } catch (e: any) { setErr(e.message ?? 'Could not load community designs.'); setCommunity([]); } }, [kind, online]);
  useEffect(() => { void load(); }, [load]);

  const settingsFor = (d: Design): Settings => d.kind === 'theme' ? { ...live, theme: d.spec! } : d.kind === 'layout' ? { ...live, home: { widgets: d.widgets! } } : d.kind === 'profile' ? d.settings! : live;
  const apply = (d: Design) => {
    if (d.kind === 'theme') applyThemeSpec(d.spec!);
    else if (d.kind === 'layout') mutate((s) => { s.home.widgets = d.widgets!; });
    else if (d.kind === 'profile') { const id = addImportedProfile({ name: d.name, icon: d.icon ?? 'leaf', settings: d.settings! }); switchProfile(id); }
    else createMapPreset(d.name, d.preset!);
    if (!d.official) void noteDownload(d.id);
    setPrev(null); Alert.alert('Applied', `“${d.name}” is now ${d.kind === 'profile' ? 'a profile you can switch to' : 'active'}.`);
  };
  const rate = async (d: Design, n: number) => { if (!user) { router.push('/auth'); return; } try { await rateDesign(user.id, d.id, n); await load(); } catch (e: any) { Alert.alert('Could not rate', e.message); } };
  const publish = async () => {
    if (!user) { router.push('/auth'); return; }
    const payload = kind === 'theme' ? { spec: live.theme } : kind === 'layout' ? { widgets: live.home.widgets } : kind === 'profile' ? { icon: activeProfile().icon, settings: live } : { preset: getMapPreset() };
    try { await publishDesign(user.id, kind, pname || `My ${kind}`, pdesc, payload); setPub(false); setPname(''); setPdesc(''); Alert.alert('Shared!', 'Your design is now in the community marketplace.'); await load(); } catch (e: any) { Alert.alert('Could not share', e.message); }
  };
  const swatches = (d: Design) => { if (d.kind !== 'theme') return null; const sd = resolveSeeds(d.spec!, sys).seeds; return <View style={{ flexDirection: 'row' }}>{[sd.primary, sd.secondary, sd.accent, sd.background].map((c, i) => <View key={i} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, marginLeft: i ? -6 : 0, borderWidth: 1.5, borderColor: colors.surface }} />)}</View>; };

  const card = (d: Design) => (
    <View key={d.id} style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginBottom: 10 }, shadow.soft]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {swatches(d) ?? <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.waterTint, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={(d.kind === 'layout' ? 'grid' : d.kind === 'profile' ? (d.icon ?? 'person-circle') : (d.preset?.icon ?? 'map')) as any} size={20} color={colors.water} /></View>}
        <View style={{ flex: 1 }}><Text style={{ fontWeight: '800', fontSize: 15.5 }} numberOfLines={1}>{d.name}</Text><Text style={font.small} numberOfLines={2}>{d.description || 'No description'}</Text></View>
        {d.official ? <Pill tone="ok" icon="shield-checkmark" label="Official" /> : null}
      </View>
      {!d.official && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Stars value={d.rating ?? 0} size={16} onChange={(n) => rate(d, n)} /><Text style={font.small}>{d.rating ? `${d.rating.toFixed(1)} (${d.ratingCount})` : 'Not rated'} · by {d.author} · {d.downloads ?? 0} downloads</Text>
        </View>)}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <Button small variant="secondary" icon="eye" title="Preview" style={{ flex: 1 }} onPress={() => setPrev(d)} />
        <Button small icon="checkmark-circle" title="Apply" style={{ flex: 1 }} onPress={() => apply(d)} />
        {d.kind === 'theme' && <Button small variant="secondary" icon="bookmark" title="" onPress={() => { saveTheme(d.name, d.spec!); Alert.alert('Saved', 'Added to “My themes”.'); }} />}
      </View>
    </View>
  );
  const official = officialDesigns(kind);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 18, paddingBottom: 120 }}>
      <Text style={font.h1}>Marketplace</Text>
      <Text style={[font.small, { marginVertical: 8 }]}>Official designs plus designs shared by explorers. You always preview before applying. Designs are plain settings — they can’t run code.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 6 }}>{KINDS.map((k) => <Chip key={k.id} label={k.label} icon={k.icon as any} active={kind === k.id} onPress={() => setKind(k.id)} />)}</ScrollView>
      <Text style={[font.h2, { marginTop: 14, marginBottom: 10 }]}>Official CreekFinder</Text>
      {official.map(card)}
      <Text style={[font.h2, { marginTop: 18, marginBottom: 10 }]}>Community</Text>
      {!hasBackend ? <Banner tone="info" icon="information-circle">Community designs need the backend (Supabase) connected. Official designs and design codes work now.</Banner> : !online ? <Banner tone="info" icon="cloud-offline">You’re offline — community designs load when you’re back online.</Banner> : null}
      {err && <Banner tone="warn" icon="alert-circle">{err}</Banner>}
      {community == null ? <View style={{ gap: 10 }}><Skeleton h={110} r={18} /><Skeleton h={110} r={18} /></View> : community.length === 0 && hasBackend && online && !err ? <Text style={font.small}>No community {kind === 'mappreset' ? 'map presets' : kind + 's'} yet — be the first to share yours.</Text> : community.map(card)}
      <View style={{ marginTop: 16 }}>
        {!pub ? <Button icon="cloud-upload" title={`Share my current ${kind === 'mappreset' ? 'map preset' : kind}`} variant="secondary" onPress={() => setPub(true)} disabled={!hasBackend} /> : (
          <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 8 }, shadow.soft]}>
            <Text style={{ fontWeight: '800' }}>Share to the marketplace</Text>
            <TextInput value={pname} onChangeText={setPname} maxLength={40} placeholder="Name" placeholderTextColor={colors.faint} accessibilityLabel="Design name" style={{ backgroundColor: colors.surface2, borderRadius: 12, padding: 12, color: colors.ink, fontSize: 16 }} />
            <TextInput value={pdesc} onChangeText={setPdesc} maxLength={200} placeholder="Short description" placeholderTextColor={colors.faint} accessibilityLabel="Design description" multiline style={{ backgroundColor: colors.surface2, borderRadius: 12, padding: 12, color: colors.ink, fontSize: 15, minHeight: 60 }} />
            <Text style={font.small}>Only settings are shared (colours, layouts, preferences) — never your places, photos or location.</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}><Button small variant="secondary" title="Cancel" style={{ flex: 1 }} onPress={() => setPub(false)} /><Button small title="Share" icon="cloud-upload" style={{ flex: 1 }} onPress={publish} /></View>
          </View>)}
      </View>

      <Modal visible={!!prev} animationType="slide" onRequestClose={() => setPrev(null)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, padding: 18, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          {prev && (<>
            <Text style={font.h1}>{prev.name}</Text>
            {prev.kind === 'mappreset' ? <View style={{ width: '100%', height: 360, borderRadius: radius.lg, overflow: 'hidden' }}><CreekMap preset={prev.preset} pins={[]} showUser={false} initial={{ center: [-81.6746, 36.2168], zoom: prev.preset!.defaultZoom }} /></View> : <MiniPhone s={settingsFor(prev)} systemDark={sys} width={210} />}
            <Text style={[font.small, { textAlign: 'center' }]}>Preview — nothing changes until you tap Apply.</Text>
            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}><Button variant="secondary" title="Close" style={{ flex: 1 }} onPress={() => setPrev(null)} /><Button icon="checkmark-circle" title="Apply" style={{ flex: 1 }} onPress={() => apply(prev)} /></View>
          </>)}
          <View style={{ position: 'absolute', top: 14, right: 14 }}><IconButton icon="close" label="Close preview" onPress={() => setPrev(null)} /></View>
        </View>
      </Modal>
    </ScrollView>
  );
}
void Pressy;
export default themed(Marketplace);
