import React from 'react';
import { SettingsPage } from '../../src/custom/controls';
import { LivePreview } from '../../src/custom/pages';
import { DisplaySection } from '../../src/custom/sections';
import { mutate, useSettings } from '../../src/custom/store';
import { themed } from '../../src/custom/themed';

function Display() {
  const s = useSettings();
  return <SettingsPage><LivePreview width={170} /><DisplaySection s={s} update={(fn) => mutate(fn)} /></SettingsPage>;
}
export default themed(Display);
