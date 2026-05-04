# Prompt: scene stats menu

Polish the in-scene gameplay UI.

Requirements:
- Remove the `Start over` button from the scene panel.
- Remove the top-level `Stats` button and the separate stats screen from the player flow.
- Show stats as a compact collapsible mini panel inside the scene story panel.
- The mini panel should include current scene/status context and any author-selected stats variables.
- If there are no stats variables, show a quiet empty state inside the mini panel.
- Keep story choices as the primary interaction and avoid visual clutter.
- Keep existing gameplay/session APIs intact.
- Preserve responsive behavior on narrow screens.
