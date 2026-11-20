import React from 'react';
import { Ionicons as Base } from '@expo/vector-icons';
import { runtime } from '../theme';

type Props = React.ComponentProps<typeof Base>;
const glyphs = (Base as any).glyphMap as Record<string, number>;

/** Ionicons that honour the user's icon size + icon style (outline / filled) settings. */
export function Icon({ name, size = 24, ...rest }: Props) {
  let n = name as string;
  if (runtime.iconStyle === 'outline' && !n.endsWith('-outline') && !n.endsWith('-sharp') && glyphs[`${n}-outline`] != null) n = `${n}-outline`;
  else if (runtime.iconStyle === 'filled' && n.endsWith('-outline') && glyphs[n.slice(0, -8)] != null) n = n.slice(0, -8);
  return <Base name={n as any} size={Math.round((size as number) * runtime.iconScale)} {...rest} />;
}
(Icon as any).glyphMap = glyphs;
export { Icon as Ionicons };
