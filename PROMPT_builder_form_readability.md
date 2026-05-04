# Prompt: builder form readability polish

Make the story builder editor friendlier for authoring scenes, especially dense scene forms with local variables, local assets, ending flags, effects, and choices.

Requirements:
- Keep all existing story JSON shape, API contracts, and runtime behavior.
- Improve readability of field labels and values: stronger labels, calmer inputs, better spacing, no cramped full-page technical list.
- Group scene fields into clear semantic blocks: identity/text, media/animation, effects, ending flag, and choices.
- Make nested local variables/assets/conditions/effects/choices look like distinct panels rather than thin indented lines.
- Make boolean flags such as ending/show-in-stats easy to see and click, using a switch-like control with readable text.
- Keep add/delete/reorder controls visible but visually quieter than primary content.
- Ensure long ids, titles, and labels wrap or truncate gracefully without stretching the editor.
- Preserve responsive behavior on desktop and mobile.
