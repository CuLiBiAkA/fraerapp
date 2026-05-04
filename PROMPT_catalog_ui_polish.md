# Prompt: catalog UI polish

Redesign the story catalog screen so it feels like a clean playable product screen instead of a dense technical list.

Requirements:
- Use a wider responsive catalog layout, not the narrow login layout.
- Keep search and sorting easy to scan at the top.
- Render stories as polished cards with clear hierarchy: title, author, progress, recent save context, and actions.
- Make `Continue` the primary action when a save exists, with `New game` as a secondary action.
- Move saved runs into a distinct side panel on desktop and below the catalog on mobile.
- Limit saved runs to the most recent items so the catalog is not overwhelmed.
- Long titles, story keys, and author names must truncate gracefully instead of stretching cards.
- Avoid noisy rows of pill badges; use quieter metrics and compact supporting text.
- Keep existing API contracts and gameplay behavior.
