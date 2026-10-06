# Chapters example

`chapters-package.json` is a synthetic authoring example; it is not seeded or
published automatically. Import it through My folders and stories → Import folder
from a file. This creates private drafts under the current author.

The example contains ordinary nested folders and a two-chapter story. Legacy JSON
type values are retained for compatibility; they impose no nesting rules and all
appear as folders. Authors can use any folder names. The ticket chapter
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
