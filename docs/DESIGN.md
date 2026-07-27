# RPS visual language — "GOLD RUSH" pass

Black-and-gold casino energy. Warm near-black felt, everything money glows
gold, poster-weight type, graffiti tagline, coins drifting through hero
areas. Every screen should feel like a high-stakes table, never like a
settings dialog.

## Tokens — import from `src/theme.ts` (never hardcode)

- `theme.bg` `#0B0906` — warm near-black (whisky tint, never blue)
- `theme.bgRaised` `#14100A`, `theme.panel` `#171208`
- `theme.panelBorder` `#33280F`, `theme.goldBorder` `#8A6B1F` (money frames)
- `theme.text` `#FFF6E3` (warm white), `theme.textDim` `#A08F6C`
- `theme.accent` `#FFC93C` (THE gold), `.accentHot` `#F59E0B`, `.accentDeep` `#B87700`
- `theme.danger` `#FF4D5E`, `theme.green` `#3DE07A`, `theme.blue` reserved —
  avoid blue in chrome; the identity is black + gold.
- `theme.gradients.cta` 3-stop gold, `.heroGlow`, `.tabBar` (see theme.ts)
- Spacing ×4 via `theme.space(n)`. Radii: `.sm` 10 `.md` 14 `.lg` 20 `.xl` 28 `.pill`.
- Glows: `theme.glow(color)` for rounded containers, `theme.textGlow(color)`
  for glyphs (web-safe split — never put `glow` on text or plain wrappers).

## Typography (loaded in root layout)

- **Anton_400Regular** (`theme.fonts.display`, `<DisplayText>`): headings,
  CTAs, VICTORY moments. Uppercase, tight tracking (~3% of size).
- **BebasNeue_400Regular** (`theme.fonts.numeric`, `<StatNumber>`): all
  money and stat numerals — tall, condensed, rolls on change.
- **PermanentMarker_400Regular** (`theme.fonts.marker`, `<MarkerText>`):
  the graffiti voice — "Real money. Real wins." One per screen max,
  usually rotated −2°.
- Body: system font, weight 600–900, letterSpacing on labels 1.5–3.

## Bling toolkit — `src/components/bling.tsx`

- `<CoinField count>` — deterministic scatter of drifting 🪙 (ambient, no
  Math.random, pointerEvents none). Hero areas only.
- `<ShineSweep>` — diagonal light bar sweeping every ~3s (parent needs
  overflow hidden + radius).
- `<GoldPlate>` — THE money CTA: 3-stop gold slab, rim highlight, pulsing
  glow, shine sweep. "PLAY NOW" is one of these.
- `<LightPool size>` — soft warm disc behind heroes (home/login/matchmaking).

## Signature layouts

- **Home is ONE SCREEN — no scrolling, ever.** Header (avatar + rank chip |
  BALANCE pill) → hero (RPS logo, marker tagline, glow arch, ✊✋✌️ on
  plinths, coin field; hero flexes to absorb spare height) → stake console
  (CURRENT STAKE + "WINNER TAKES 🪙2×" inline, −/+ stepper, tier chips
  FREE…1K, PLAY NOW GoldPlate) → stats row (total wins / win rate /
  biggest win) → single-line rotating RECENT WIN ticker → bottom row
  (compact DAILY BONUS + practice-bot card). `useWindowDimensions` compact
  mode kicks in under 780px height. The web app requests true fullscreen
  on the login/signup/play taps (src/fullscreen.ts).
- **Tab bar** (custom, `(main)/_layout.tsx`): RANKS · FRIENDS · [raised
  gold fist PLAY] · WALLET · PROFILE. Profile icon = the user's avatar in a
  circle. Center fist navigates home.
- **Ranks**: Olympic podium (2·1·3, crown on #1, gold/silver/bronze rings)
  above the list.
- **Wallet**: bankroll hero + typed transaction feed (green +/red −).

## The reveal (classic skin) — staged like a real RPS game

RevealScene timeline (total ≈2.75s, inside the server's 3s reveal window —
never exceed it): three synced fist pumps with ticks (0–1.02s) → both
throws snap out SIMULTANEOUSLY (reveal sound) → a held ~700ms beat, hands
frozen → the winning hand lunges and SMASHES the loser (white flash,
screen shake, smash.wav; loser tumbles away crushed) → verdict banner
slams in. Draws bump knuckles and bounce apart. The skin's RevealScene
owns ALL reveal sounds. On 'ended', the VICTORY/DEFEAT stamp lands first;
PayoutCelebration mounts 550ms later.

## Voice chat (src/voice.ts)

PvP matches open a WebRTC audio line (p1 offers, p2 answers) signaled via
'voice:signal' relay; live from match start through the end screen, torn
down on leaving the match screen. Default ON; toggle + Quiet/Normal/Loud
volume in Settings; mic mute chip in the match header (accessibilityLabel
"Mic toggle"). Web only — silent no-op on native. Debug: window.__rpsVoice.

## Motion standards (Reanimated; must work on web)

- Press: everything tappable scales 0.96 via `<PressableScale>`/`Button`.
- Entrances: stagger `FadeInDown.delay(i * 60).springify()` on 3–6 blocks;
  list rows only first ~8.
- Loops: gentle infinite bobs/pulses/sweeps; repeat callbacks must guard
  `if (finished)` before reassigning shared values (recursion bug).
- Numbers roll via `<StatNumber>`. Nothing blocking input except reveals.

## Hard invariants — DO NOT break (automated tests/scripts depend on these)

- All game logic, stores, socket code, and the `Skin` interface stay
  untouched. Skins change only their own folder's visuals (both skin
  palettes are warm-tinted to sit inside the black+gold app chrome).
- Keep these exact user-visible strings/labels:
  - Auth: placeholders "Username (3–20 chars)", "Password (6+ chars)",
    link "New here? Create an account", button "Create account"
  - Home: accessibilityLabels "Play now" (the GoldPlate), "Raise stake",
    "Lower stake", "Balance"; chip texts FREE/1/5/10/20/50/100/1K;
    "Practice vs bot — free"
  - Tab bar: accessibilityLabels "RANKS tab", "FRIENDS tab", "Play tab",
    "WALLET tab", "PROFILE tab"
  - Match: move labels per skin unchanged (Rock/Paper/Scissors,
    KICK/PUNCH/BLOCK); "Forfeit"; accessibility labels "Emote wheel" and
    "Emote: <label>" (the wheel lives on the END screen, not mid-round);
    classic end shows VICTORY/DEFEAT; fighter end contains "K.O.";
    no-play loss shows "NO PLAY" + ✕
  - Settings: skin cards show "Rock Paper Scissors" and "Kick Block Punch";
    sound + music toggles stay
- `tsc --noEmit` must stay clean across all workspaces.
- Keep every screen's existing functionality and navigation exactly as-is.
