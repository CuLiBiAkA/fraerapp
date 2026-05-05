# Prompt: story publication workflow

Implement the story publication workflow from the production plan.

Requirements:
- Preserve existing import, validation, publish, catalog, and gameplay contracts.
- Add the full status path: `draft -> review -> published -> archived`.
- Keep published stories visible only when status is `published`; archived and review stories must disappear from the public catalog/runtime.
- Add author/admin endpoints to submit a story for review, publish it, archive it, preview the current unpublished document, list versions, and roll back to a saved version.
- Add database-backed story version snapshots so imports and publication transitions can be audited and restored.
- Store snapshots as Story JSON exported from the current database state.
- Rollback must restore story metadata, assets, scenes, choices, and status from the selected version while keeping ownership and story id stable.
- Update the story builder author UI with workflow actions and version rollback controls.
- Cover the workflow with backend tests.
