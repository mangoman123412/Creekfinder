import React from 'react';
import { SettingsPage } from '../../src/custom/controls';
import { LivePreview } from '../../src/custom/pages';
import { ThemeSection } from '../../src/custom/sections';
import { mutate, resetSection, useSettings } from '../../src/custom/store';
import { themed } from '../../src/custom/themed';

function Appearance() {
  const s = useSettings();
  return <SettingsPage onReset={() => resetSection('theme')} resetLabel="Reset appearance"><LivePreview width={170} /><ThemeSection s={s} update={(fn) => mutate(fn)} /></SettingsPage>;
}
export default themed(Appearance);
