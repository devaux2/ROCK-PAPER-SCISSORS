import type { TextStyle, ViewStyle } from 'react-native';

/**
 * "GOLD RUSH" design language (docs/DESIGN.md): warm near-black felt,
 * everything money glows gold, poster-weight type. Skins theme the game
 * screen's arena area; everything else speaks this language.
 */
export const theme = {
  // Warm blacks — charcoal with a whisky tint, never blue.
  bg: '#0B0906',
  bgRaised: '#14100A',
  panel: '#171208',
  panelBorder: '#33280F',
  goldBorder: '#8A6B1F',

  text: '#FFF6E3',
  textDim: '#A08F6C',

  // The money color. accent == gold everywhere.
  accent: '#FFC93C',
  accentHot: '#F59E0B',
  accentDeep: '#B87700',
  accentText: '#1A1102',
  danger: '#FF4D5E',
  red: '#FF4D5E',
  blue: '#4DA7FF',
  green: '#3DE07A',

  gradients: {
    cta: ['#FFE082', '#FFC93C', '#EE9D0C'] as const,
    ctaPressed: ['#FFD75E', '#E8940A'] as const,
    win: ['#3DE07A', '#12B886'] as const,
    lose: ['#FF4D5E', '#C2255C'] as const,
    panelSheen: ['#1D1709', '#120E07'] as const,
    // Vertical wash behind heroes: warm glow fading into the felt.
    heroGlow: ['rgba(255,178,32,0.16)', 'rgba(255,178,32,0.05)', 'rgba(11,9,6,0)'] as const,
    tabBar: ['#181207', '#0C0905'] as const,
  },

  space: (n: number) => n * 4,
  radius: { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },

  fonts: {
    /** Anton — heavyweight poster type for headings and CTAs. */
    display: 'Anton_400Regular',
    /** Bebas — tall condensed numerals for money and stats. */
    numeric: 'BebasNeue_400Regular',
    /** Permanent Marker — the graffiti voice ("REAL MONEY. REAL WINS."). */
    marker: 'PermanentMarker_400Regular',
  },

  springs: {
    press: { damping: 18, stiffness: 420 },
    pop: { damping: 12, stiffness: 260 },
    sheet: { damping: 16, stiffness: 220 },
  },

  /**
   * Soft colored glow for ROUNDED CONTAINERS ONLY — RN-web turns shadow*
   * into box-shadow around the element's box, so apply this to the view
   * that owns the borderRadius, never to text or a plain wrapper.
   */
  glow: (color: string, radius = 18): ViewStyle => ({
    shadowColor: color,
    shadowOpacity: 0.45,
    shadowRadius: radius,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  }),

  /** Glow for TEXT — halo hugs the glyphs on native and web alike. */
  textGlow: (color: string, radius = 16): TextStyle => ({
    textShadowColor: color,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: radius,
  }),
};
