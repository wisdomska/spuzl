# Crownfall region palette

Crownfall regions are told apart in three independent ways:

1. **Region edges (always on).** Cells touch; every cell side that faces another region or the board edge
   gets a 2 px line in `var(--text)` (4 px where two regions meet). Inside a region there is only an 18 %
   hairline. Shapes are readable even in greyscale.
2. **Palette contrast.** The `--reg-0` … `--reg-9` colours in `app/globals.css` meet the metric below in both
   themes, for normal vision and for simulated dichromacy.
3. **Patterns (opt in).** Any colour-blind mode (`cb` setting) adds a per-region texture (`[data-cb]
[data-region]` rules in `app/globals.css`). The first non-tutorial Crownfall a player opens offers a
   one-tap "Turn on patterns" (sets `cb` to `deutan`, like the Pause sheet toggle); the offer is remembered in
   `localStorage['spuzl.cfPatternsOffered']` and never shown again.

## Metric

- **Colour difference:** CIEDE2000 (ΔE00, kL = kC = kH = 1) between region colours, after converting sRGB to
  CIELAB (D65).
- **Vision simulation:** Machado, Oliveira & Fernandes (2009) matrices at severity 1.0 (full protanopia,
  deuteranopia, tritanopia), applied in linear RGB. Code: `lib/a11y/colour.ts`.
- **Thresholds, for every pair of the 10 palette colours (not only neighbours):**

  | Vision       | Min ΔE00 |
  | ------------ | -------- |
  | Normal       | 18       |
  | Protanopia   | 9        |
  | Deuteranopia | 9        |
  | Tritanopia   | 9        |

  ΔE00 ≈ 2 is a just-noticeable difference side by side; ≥ 10 is commonly used as "clearly different at a
  glance" for categorical colours. A dichromat sees a 2-D colour space, so 10 colours cannot all be ≥ 10
  apart at the lightness range a board needs; 9 is the best we found while keeping the colours nameable.
  The region edges carry the rest.

- **Text contrast:** every region colour is ≥ 4.5:1 (WCAG 2) against `var(--text)`, which draws crowns and
  region edges.

The tests are `games/crownfall/palette.test.ts` (reads the CSS, checks all pairs and the 10 seeded boards'
adjacent pairs) and `lib/a11y/colour.test.ts` (CIEDE2000 against the Sharma reference data).

## Current values

| #   | Name   | Dark      | Light     |
| --- | ------ | --------- | --------- |
| 0   | purple | `#382d79` | `#888deb` |
| 1   | teal   | `#007d86` | `#5af7f6` |
| 2   | pink   | `#680746` | `#d09ec5` |
| 3   | green  | `#577957` | `#b4dbac` |
| 4   | orange | `#a4602b` | `#f1a872` |
| 5   | blue   | `#0e5c9b` | `#6ac3fe` |
| 6   | red    | `#7e3e3a` | `#ef6d77` |
| 7   | olive  | `#253a12` | `#9c9a2f` |
| 8   | gold   | `#624d00` | `#ffe381` |
| 9   | grey   | `#585859` | `#9d9d9d` |

Minimum pairwise ΔE00 (normal / protan / deutan / tritan): dark 19.5 / 9.8 / 9.8 / 9.8, light
20.7 / 10.4 / 10.3 / 10.4. The previous palette scored 6.7 / 1.7 / 1.3 / 2.8 (dark) and 5.8 / 2.1 / 1.7 / 1.4
(light).

The names are used in hints and screen-reader labels (`CROWNFALL_COPY.regionNames` in
`lib/copy/crownfall.ts`); keep each colour recognisable as its name in both themes when changing a value.

## Changing the palette

Pick colours in CIELAB/LCh around the named hue, keep lightness inside the theme's band (dark L\* 22–50,
light 62–92) so the 4.5:1 text contrast holds, then run `pnpm vitest run games/crownfall/palette.test.ts`.
Any failing pair is listed by name, vision and ΔE.
