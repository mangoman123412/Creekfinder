import React, { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '../src/custom/Icon';
import { Alert } from '../src/lib/alert';
import { Button, Chip, Empty, Pressy, Text } from '../src/components/ui';
import { ColorRow, Group2, IconGrid, SwitchRow } from '../src/custom/controls';
import { createFolder, deleteFolder, listFolders, updateFolder } from '../src/db/local';
import { useDbQuery } from '../src/state/hooks';
import { descendantIds, flattenFolders, FOLDER_COLORS, FOLDER_ICONS } from '../src/custom/organize';
import { colors, font, radius, shadow } from '../src/theme';
import { themed } from '../src/custom/themed';
import type { Folder } from '../src/types';

interface Draft { id?: string; name: string; icon: string; color: string | null; parent_id: string | null; private: boolean }

/** Folder manager: names, icons, colours, nesting and private collections. */
function Folders() {
  const folders = useDbQuery(listFolders, [], [] as Folder[]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const tree = useMemo(() => flattenFolders(folders.data), [folders.data]);
  const blocked = draft?.id ? descendantIds(folders.data, draft.id) : [];

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { Alert.alert('Name your folder', 'Give it a name, like “Summer 2026”.'); return; }
    if (draft.id) await updateFolder(draft.id, { name: draft.name, icon: draft.icon, color: draft.color, parent_id: draft.parent_id, private: draft.private });
    else await createFolder(draft.name, { icon: draft.icon, color: draft.color, parent_id: draft.parent_id, private: draft.private });
    setDraft(null);
  };
  const del = (f: Folder) => Alert.alert(`Delete “${f.name}”?`, 'Places inside are kept and become unfiled. Sub-folders move up one level.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteFolder(f.id) }]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 18, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
      <Text style={font.h1}>Folders</Text>
      <Text style={[font.small, { marginVertical: 8 }]}>Name them anything, pick an icon and colour, nest them inside each other, or make a private collection that can never be shared.</Text>
      {!draft && <Button icon="add" title="New folder" onPress={() => setDraft({ name: '', icon: 'folder', color: null, parent_id: null, private: false })} />}

      {draft && (
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginTop: 14, gap: 4 }, shadow.card]}>
          <Text style={font.h2}>{draft.id ? 'Edit folder' : 'New folder'}</Text>
          <Text style={[font.label, { marginTop: 10 }]}>Name</Text>
          <TextInput value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} maxLength={40} placeholder="e.g. Secret swimming holes" placeholderTextColor={colors.faint} accessibilityLabel="Folder name" style={{ backgroundColor: colors.surface2, borderRadius: 12, padding: 12, fontSize: 16, color: colors.ink, marginTop: 6 }} />
          <Text style={[font.label, { marginTop: 14 }]}>Icon</Text>
          <IconGrid icons={FOLDER_ICONS} value={draft.icon} color={draft.color ?? colors.primary} onChange={(icon) => setDraft({ ...draft, icon })} />
          <Text style={[font.label, { marginTop: 4 }]}>Colour</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 10 }}>
            <Pressy onPress={() => setDraft({ ...draft, color: null })} accessibilityLabel="Default colour" style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: draft.color == null ? colors.ink : colors.line, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={16} color={colors.muted} /></Pressy>
            {FOLDER_COLORS.map((c) => <Pressy key={c} onPress={() => setDraft({ ...draft, color: c })} accessibilityLabel={`Colour ${c}`} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: draft.color === c ? 3 : 0, borderColor: colors.ink }}><View /></Pressy>)}
          </View>
          <ColorRow label="Custom colour (HEX)" value={draft.color ?? colors.primary} onChange={(c) => setDraft({ ...draft, color: c })} />
          <Text style={[font.label, { marginTop: 10 }]}>Inside</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <Chip label="Top level" active={draft.parent_id == null} onPress={() => setDraft({ ...draft, parent_id: null })} />
            {tree.filter((n) => !blocked.includes(n.folder.id)).map((n) => <Chip key={n.folder.id} label={`${'· '.repeat(n.depth)}${n.folder.name}`} icon={n.folder.icon as any} active={draft.parent_id === n.folder.id} onPress={() => setDraft({ ...draft, parent_id: n.folder.id })} />)}
          </ScrollView>
          <View style={{ marginTop: 10 }}><Group2><SwitchRow icon="lock-closed" title="Private collection" subtitle="Places in it can never be made public or shown on the community map." value={draft.private} onChange={(v) => setDraft({ ...draft, private: v })} /></Group2></View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}><Button variant="secondary" title="Cancel" style={{ flex: 1 }} onPress={() => setDraft(null)} /><Button title="Save folder" icon="checkmark" style={{ flex: 1 }} onPress={save} /></View>
        </View>
      )}

      <View style={{ marginTop: 18 }}>
        {tree.length === 0 ? <Empty icon="folder-open" title="No folders" body="Create your first folder above." /> : tree.map(({ folder: f, depth }) => (
          <View key={f.id} style={[{ marginLeft: depth * 22, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, marginBottom: 8 }, shadow.soft]}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: f.color ?? colors.primary, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={f.icon as any} size={20} color="#fff" /></View>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }} numberOfLines={1}>{f.name}</Text>{f.private ? <Text style={font.small}>🔒 Private collection</Text> : null}</View>
            <Pressy onPress={() => setDraft({ id: f.id, name: f.name, icon: f.icon, color: f.color, parent_id: f.parent_id, private: !!f.private })} accessibilityLabel={`Edit ${f.name}`} hitSlop={8}><Ionicons name="create" size={20} color={colors.muted} /></Pressy>
            <Pressy onPress={() => setDraft({ name: '', icon: 'folder', color: null, parent_id: f.id, private: false })} accessibilityLabel={`Add folder inside ${f.name}`} hitSlop={8}><Ionicons name="add-circle" size={22} color={colors.primary} /></Pressy>
            <Pressy onPress={() => del(f)} accessibilityLabel={`Delete ${f.name}`} hitSlop={8}><Ionicons name="trash" size={19} color={colors.danger} /></Pressy>
          </View>))}
      </View>
    </ScrollView>
  );
}
export default themed(Folders);
