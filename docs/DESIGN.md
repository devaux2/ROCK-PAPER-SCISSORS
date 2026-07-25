# Throwdown visual language — "ARENA" pass

High-energy, bold, arcade-versus. Dark arena base, hot gold star of the
show, punchy display type, springy motion everywhere. Every screen should
feel like the seconds before a fight, never like a settings dialog.

## Tokens — import from `src/theme.ts` (never hardcode)

- `theme.bg` `#0B0E1A` — near-black navy arena
- `theme.bgRaised` `#131829` — raised surfaces
- `theme.panel` `#181E33` — cards
- `theme.panelBorder` `#28304D`
- `theme.text` `#F2F5FF`, `theme.textDim` `#8B94B8`
- `theme.accent` `#FFC53D` (gold), `theme.accentHot` `#FF9F1C` (gradient partner)
- `theme.danger` `#FF3D68` (hot magenta-red), `theme.blue` `#3D9BFF`,
  `theme.green` `#2EE66B`
- `theme.gradients.cta` gold→orange, `.win` green pair, `.lose` red pair,
  `.panelSheen` subtle dark blue pair (see theme.ts)
- Spacing: multiples of 4 via `theme.space(n)`. Radii: `theme.radius.md` 14,
  `.lg` 20, `.pill` 999.
- Glows: `theme.glow(color)` returns shadow style (works on web via RN-web).

## Typography

- Display font: **BebasNeue_400Regular** (loaded in root layout; use
  `<DisplayText>` from `src/components/ui.tsx`). Use for: screen titles,
  logos, scores, countdowns, coin/elo numbers, buttons ≥ large, VICTORY-type
  moments. Always uppercase, letterSpacing ≥ 1.
- Body: system font, weight 600–800. Dim body text uses `textDim`.

## Motion standards (Reanimated; must work on web)

- Press feedback: every tappable scales to 0.96 with `theme.springs.press`
  — use `<PressableScale>` or `Button` from ui.tsx, do not hand-roll.
- Screen entrances: stagger content with `entering={FadeInDown.delay(i * 60).springify()}`
  on the 3–6 main blocks of each screen. Do not animate every list row past
  the first ~8 (use `index < 8 ? entering : undefined`).
- Numbers that change (coins, elo): `<StatNumber>` animates the roll.
- Modals/sheets: slide up with spring (`entering={SlideInDown.springify().damping(16)}`).
- Countdown ≤3s: pulse scale 1→1.15 each second, color flips to danger.
- Nothing longer than 450ms; nothing blocking input except reveal scenes.

## Shape language

- Cards: `panel` bg, 1px `panelBorder`, radius `lg`, generous padding.
- Hero/CTA elements may add `theme.glow(theme.accent)`.
- Badges/labels: tiny, uppercase, letterSpacing 2, often skewed −6°
  (`transform: [{ skewX: '-6deg' }]`) for the arcade angle. Use sparingly:
  one skewed element per screen region.
- Primary buttons: gold→orange gradient (`Button variant="primary"` does
  this), dark text, DisplayText label.

## Hard invariants — DO NOT break (automated tests/scripts depend on these)

- All game logic, stores, socket code, and the `Skin` interface stay
  untouched. Skins change only their own folder's visuals.
- Keep these exact user-visible strings/labels:
  - Auth: placeholder "Username (3–20 chars)", "Password (6+ chars)",
    link "New here? Create an account", button "Create account"
  - Home: "Find ranked match", "Find casual match", "Play vs bot",
    wager rows contain "🪙 10/50/100/500", "Settings & skins" entry exists
  - Match: move labels per skin unchanged (Rock/Paper/Scissors,
    KICK/PUNCH/BLOCK, Fire/Water/Leaf); "Forfeit"; accessibility labels
    "Emote wheel" and "Emote: <label>"; classic end shows VICTORY/DEFEAT;
    fighter end contains "K.O."; spell end "ARCANE VICTORY"/"SPELL BROKEN"
  - Settings: skin cards show "Rock Paper Scissors", "Kick Block Punch",
    "Spell Duel"; sound toggle stays
- `tsc --noEmit` must stay clean; no new dependencies; imports only from
  existing packages (reanimated, expo-linear-gradient, gesture-handler,
  @rps/shared, ui.tsx primitives).
- Keep every screen's existing functionality and navigation exactly as-is.
