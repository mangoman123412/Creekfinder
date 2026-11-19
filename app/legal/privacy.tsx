import React from 'react';
import { Linking, ScrollView } from 'react-native';
import { Text } from '../../src/components/ui';
import { PRIVACY } from '../../src/legal';
import { colors, font, space } from '../../src/theme';
export default function Privacy() {
  return <ScrollView style={{ backgroundColor: colors.sand }} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}><Text selectable style={font.body}>{PRIVACY}</Text></ScrollView>;
}
