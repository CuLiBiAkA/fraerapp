# Prompt: asset storage lifecycle for Story Builder

Goal: remove local-machine file paths from story assets and make uploaded media portable.

Context:
- Story Builder is a static UI, but it already talks to the runtime API.
- Runtime API stores uploaded files under the configured `/uploads/...` public path.
- Authors can add image/music/sound assets globally or locally inside a scene.
- The current UX can leave local paths or orphan uploaded files when assets are deleted from the draft.

Tasks:
- Treat server-side upload storage as the source of truth for images, music, sounds, video-like assets, and sprites.
- When an author uploads a file in Story Builder, store it through the runtime API and replace the asset URL with a public `/uploads/{storyId}/{file}` URL.
- Keep manual URL entry possible for existing static assets such as `/assets/platform.svg`.
- Add a backend author endpoint to delete an uploaded asset by public URL, guarded by story ownership.
- Delete the uploaded file when an author removes a builder asset that points to `/uploads/...`.
- For global assets saved in the asset table, remove the DB asset row when deleting by asset key.
- For scene-local assets, delete only the stored file; the builder draft already removes the local JSON reference.
- Avoid deleting shared static assets or arbitrary filesystem paths.
- Preserve existing publication/import behavior and cleanup unreferenced files on story import.
- Add tests for asset deletion permissions/path safety.
