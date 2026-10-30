# Contributing

1. Branch from `preview`: `feat/*`, `fix/*` or `chore/*`.
2. Use Conventional Commits (`feat(games): add dusk`). Keep commits small and focused.
3. Run `pnpm check` before pushing. Database changes need a migration in `supabase/migrations` and pgTAP coverage in `supabase/tests`.
4. Open a PR into `preview`, fill in the QA and motion checklists, and wait for CI and the preview deploy.
5. Releases go `preview` → `main` through a PR. Both branches are protected and squash-merged.

Commit messages must not contain AI attribution (Co-Authored-By, "Generated with" and similar). A Husky hook and CI reject them.

New games follow `docs/GAME_BRIEF.md`.
