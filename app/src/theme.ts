/**
 * Design tokens sampled from the current BRB product page screenshots.
 * Change a colour here and it updates everywhere.
 */
export const colors = {
  brand: '#5C2AA3', // header + primary buttons
  brandDark: '#231338', // round header buttons
  brandDisabled: '#80689A', // "Add to Cart" before a size is picked
  ink: '#2D0061', // product title, headings
  inkSoft: '#360964', // section titles
  price: '#F2BC1E',
  text: '#1D1D1D',
  textMuted: '#7A7A80',
  chip: '#E6E5EA',
  chipSelected: '#5C2AA3',
  warning: '#ED9042',
  closedDot: '#FD393A',
  closedText: '#D37073',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F4F6',
  heartBg: '#F7F6FB',
  divider: '#E8E8EC',
  overlay: 'rgba(0,0,0,0.45)',
  error: '#C62828',
} as const;

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.ink, lineHeight: 34 },
  price: { fontSize: 30, fontWeight: '700' as const, color: colors.price },
  section: { fontSize: 18, fontWeight: '600' as const, color: colors.inkSoft },
  body: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
} as const;
