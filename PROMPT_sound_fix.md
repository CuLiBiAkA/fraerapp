# Prompt: story sound behavior

Fix the story runtime sound so it behaves like an explicit user-controlled feature.

Requirements:
- Sound must be off by default.
- Login, story start, scene rendering, and scene changes must not enable sound automatically.
- The sound button is the only way to enable sound.
- Leaving the current story through the story menu, logout, a new story start, or a finished session must stop sound and reset the button to the off state.
- Keep the existing Web Audio implementation, localized button labels, and current gameplay flow intact.
