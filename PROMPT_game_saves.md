# Prompt: game saves

Implement game saves for FraerApp on top of the existing `game_sessions` table.

Requirements:
- Treat every game session as a save slot with a visible save name.
- Creating a new game must create a separate slot and must not overwrite existing progress.
- Add API responses for the player's saved runs, sorted by recent activity.
- Let the player continue a specific saved session.
- Include the latest saved session in the public catalog response so the UI can offer `Continue` and `New game`.
- Add a catalog UI section with the player's saved runs.
- Keep the current story runtime contract and session ownership checks.
- Cover save listing and continuing progress with backend tests.
