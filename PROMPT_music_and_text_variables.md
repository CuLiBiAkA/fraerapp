# Prompt: music playback and text variable interpolation

Goal: improve FraerApp Story Builder/runtime media behavior.

Tasks:
- Make scene music actually play in the player runtime using `scene.musicUrl`.
- Keep the existing sound toggle, but make it control story music instead of only synthetic WebAudio tones.
- Stop or switch music when scenes change, and stop it when the session ends or the player logs out.
- Keep browser autoplay restrictions in mind: music starts only after the player enables sound.
- Improve author workflow so uploaded audio assets are treated as music where appropriate.
- Add support for inserting global variable placeholders into scene text and rendering their current values during gameplay.
- Preserve existing story JSON shape where possible.
- Add focused tests for variable interpolation.
- Do not disturb the current three-column Story Builder layout.

Suggested placeholder format:
- `{{variable_id}}` inside scene text.
- Missing variables should render as an empty string or a stable readable fallback, without crashing the scene.
