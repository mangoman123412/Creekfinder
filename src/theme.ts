export const colors = {
  forest: '#1F4D3A',
  forestDark: '#143528',
  moss: '#5F8A4E',
  water: '#1E88C7',
  waterDeep: '#146699',
  waterLight: '#DCEFF9',
  earth: '#8B6B4A',
  sand: '#F5F1E8',
  card: '#FFFFFF',
  ink: '#1B2A24',
  muted: '#62706A',
  line: '#E4DFD3',
  danger: '#C0392B',
  dangerBg: '#FBEAE7',
  warn: '#B7791F',
  warnBg: '#FFF4DB',
  ok: '#2E7D4F',
  white: '#FFFFFF',
};

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const shadow = {
  shadowColor: '#0B1F17',
  shadowOpacity: 0.12,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
} as const;

export const font = {
  h1: { fontSize: 28, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.ink },
  h3: { fontSize: 16, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 16, color: colors.ink, lineHeight: 22 },
  small: { fontSize: 13, color: colors.muted, lineHeight: 18 },
};
