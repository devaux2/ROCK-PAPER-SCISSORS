import type { TextStyle, ViewStyle } from 'react-native';

/**
 * App-wide "ARENA" design tokens (docs/DESIGN.md). Skins theme the game
 * screen's arena area; everything else speaks this language.
 */
export const theme = {
  bg: '#0B0E1A',
  bgRaised: '#131829',
  panel: '#181E33',
  panelBorder: '#28304D',
  text: '#F2F5FF',
  textDim: '#8B94B8',
  accent: '#FFC53D',
  accentHot: '#FF9F1C',
  accentText: '#131313',
  danger: '#FF3D68',
  red: '#FF3D68',
  blue: '#3D9BFF',
  green: '#2EE66B',

  gradients: {
    cta: ['#FFC53D', '#FF9F1C'] as const,
    win: ['#2EE66B', '#12B886'] as const,
    lose: ['#FF3D68', '#C2255C'] as const,
    panelSheen: ['#1B2138', '#141A2E'] as const,
  },

  space: (n: number) => n * 4,
  radius: { sm: 10, md: 14, lg: 20, pill: 999 },

  fonts: {
    display: 'BebasNeue_400Regular',
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
