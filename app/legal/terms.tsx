import React from 'react';
import { themed } from '../../src/custom/themed';
import { ScrollView } from 'react-native';
import { Text } from '../../src/components/ui';
import { TERMS } from '../../src/legal';
import { colors, font, space } from '../../src/theme';
function Terms() {
  return <ScrollView style={{ backgroundColor: colors.sand }} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}><Text selectable style={font.body}>{TERMS}</Text></ScrollView>;
}
export default themed(Terms);
