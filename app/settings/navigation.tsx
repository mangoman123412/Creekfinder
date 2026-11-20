import React from 'react';
import { SettingsPage } from '../../src/custom/controls';
import { LivePreview } from '../../src/custom/pages';
import { NavSection } from '../../src/custom/sections';
import { mutate, useSettings } from '../../src/custom/store';
import { themed } from '../../src/custom/themed';

function Navigation() {
  const s = useSettings();
  return <SettingsPage><LivePreview width={170} /><NavSection s={s} update={(fn) => mutate(fn)} /></SettingsPage>;
}
export default themed(Navigation);
