# Prompt: remove duplicate saves panel

Simplify the story catalog by removing the standalone saved-runs panel.

Requirements:
- Do not show a separate `Saved runs` / `Сохранения` column or list.
- Keep the existing per-story actions: `Continue` for the latest run and `New game` for a fresh slot.
- Keep the backend save/session API intact; this is only a catalog UI simplification.
- Use the freed space to make the story catalog wider, cleaner, and easier to scan.
- Remove unused frontend state, API calls, translations, rendering code, and CSS tied only to the separate saves panel.
- Keep responsive behavior polished on desktop and mobile.
