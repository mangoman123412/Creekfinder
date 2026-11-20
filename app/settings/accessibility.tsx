import React from 'react';
import { Banner } from '../../src/components/ui';
import { Group2, SettingsPage, SliderRow, SwitchRow } from '../../src/custom/controls';
import { LivePreview } from '../../src/custom/pages';
import { mutate, useSettings } from '../../src/custom/store';
import { themed } from '../../src/custom/themed';
import { resetSection } from '../../src/custom/store';

function Accessibility() {
  const s = useSettings();
  return (
    <SettingsPage onReset={() => { resetSection('a11y'); }} resetLabel="Reset accessibility">
      <LivePreview width={150} />
      <Group2 title="Vision" footer="High contrast uses pure black/white surfaces, stronger borders and guarantees readable colours — even with a custom theme.">
        <SwitchRow icon="contrast" title="High contrast" subtitle="Maximum text and border contrast" value={s.a11y.highContrast} onChange={(v) => mutate((d) => { d.a11y.highContrast = v; })} />
        <SwitchRow icon="text" title="Bold text" subtitle="Heavier font weight everywhere" value={s.display.boldText} onChange={(v) => mutate((d) => { d.display.boldText = v; })} />
        <SliderRow title="Text size" value={s.display.textScale} min={0.8} max={1.6} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => mutate((d) => { d.display.textScale = v; })} />
      </Group2>
      <Group2 title="Motion" footer="Reduce motion also turns on automatically when your phone's system setting is on.">
        <SwitchRow icon="pause-circle" title="Reduce motion" subtitle="Removes animations and transitions" value={s.a11y.reduceMotion} onChange={(v) => mutate((d) => { d.a11y.reduceMotion = v; })} />
      </Group2>
      <Group2 title="Touch & screen readers">
        <SwitchRow icon="hand-left" title="Larger touch targets" subtitle="Bigger buttons and tap areas" value={s.a11y.largeTargets} onChange={(v) => mutate((d) => { d.a11y.largeTargets = v; })} />
        <SwitchRow icon="volume-high" title="Detailed screen-reader hints" subtitle="Adds “double tap to…” hints for VoiceOver / TalkBack" value={s.a11y.screenReader} onChange={(v) => mutate((d) => { d.a11y.screenReader = v; })} />
      </Group2>
      <Banner tone="info" icon="information-circle">Every button, tab and slider has a spoken label and works with VoiceOver and TalkBack. Drag-and-drop lists always have Up/Down buttons as an alternative.</Banner>
    </SettingsPage>
  );
}
export default themed(Accessibility);
