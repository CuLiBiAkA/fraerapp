# Story package examples

`serial-story-package.json` is the current authoring example: one story with two
ordered chapters and a season label. The package envelope has schemaVersion 1;
the contained story has schemaVersion 2. Import it through **My stories → Import
story**, review the preview, then confirm creation of private drafts. It is not
seeded or published automatically. The prompt dialog downloads the same example
without replacing the current Builder draft. See [the prompt guide](../prompts/authoring-guide.md).

## Legacy compatibility fixture

`chapters-package.json` is a synthetic legacy compatibility fixture, not the
recommended format for a new story. It is not seeded or published automatically.
Import through My stories → Import story creates private drafts under the author.

The legacy example contains nested collections and a two-chapter story. Historical
JSON type values and nesting are retained for compatibility only. The ticket chapter
transfers `courage` → `initialCourage` and `helpedConductor` → `metAlly` to the
carriage chapter. The carriage's sequel link starts the independent keeper story.
Only explicit fields are transferred; the second chapter requires a prior save.

Open the folder, arrange its parts, then choose Submit for review. The moderator
sees one expandable folder application and reviews its new/changed parts before an
explicit aggregate decision. Unchanged published parts are not reviewed again;
drafts which were not submitted never enter that decision. References and folder
membership are limited to the current author's own works.

For local validation, use synthetic accounts and an isolated database. Do not
import this package into production as a deployment smoke test. Media paths are
omitted so that the example does not depend on private uploads or external URLs.
