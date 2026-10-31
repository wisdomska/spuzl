## What changed

## Why

## QA checklist

- [ ] `pnpm check` passes (typecheck, lint, format, unit)
- [ ] New logic has tests; games keep 90%+ coverage
- [ ] Checked on mobile 390 × 844 and desktop 1280, dark and light
- [ ] Keyboard and screen reader paths work; axe shows no serious issues
- [ ] Copy has no em or en dashes; one label per action
- [ ] Server decides scores, rewards and results

## Motion checklist

- [ ] Every new animation matches the Handoff spec (duration, curve, delay, properties)
- [ ] Transform and opacity only; no ease-in; celebrations skip on tap
- [ ] Sound and haptic paired with each visual
- [ ] Reduced-motion variant verified
- [ ] `review-animations` and `animation-performance` passed

## Screenshots or video
