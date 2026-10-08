# Author subscriptions

## Intent and first release

Registered readers can activate an Author subscription and immediately create
stories. This release simulates checkout; no payment provider, payment details,
money collection or automatic renewal. The displayed tariff is ₽139/month. The page must say this before
confirmation and after success. Confirmed by the owner: ₽139 per calendar month;
access ends on expiry until renewed. Months are added in UTC, retaining the
remaining period on renewal. Test checkout charges zero and is identified throughout.

The single /subscription/ page serves guests, readers, existing authors and
subscribers. It shows benefits, period, test-mode notice, current access and
history. Guests use existing sign-in; readers confirm a test purchase. Active
subscribers can renew explicitly. Repeated requests use an idempotency key and
cannot extend the same purchase twice. Failed requests retain the key for retry.
No card form or pretend receipt. Purchase is recorded as test_succeeded, price 13900 kopecks, amount charged 0.

## Ownership and lifecycle

Auth owns subscriptions alongside account roles. Active, unrevoked subscription
adds author to effective roles at request time; expired subscriptions never rely
on a scheduled cleanup job. Existing manual roles are separate and survive
expiry/revocation. API already consults /auth/me on each request, so access changes
take effect without waiting for JWT expiry. Subscription expiry does not change
story data, visibility, publication or moderation. Removing Author or reducing a
user to Reader explicitly revokes subscription access too; blocking still denies
all access. Deleting an account cascades its subscription records.

A subscription row per user tracks period and version. Immutable test purchase
records snapshot each activation/renewal. An event log records purchase and admin
revocation (actor, time, reason). User-row locking serializes purchase/renewal,
role changes and admin revocation. Conditional version checks reject stale admin
actions. A configuration switch can disable mock checkout. A real provider must
later verify server-side payment events before issuing access; it must not reuse
the unauthenticated idea of a browser reporting payment success.

## Administration and verification

The admin Subscriptions section has server-side search, status filter, pagination,
summary counts, period/source details and operation history. Administrators can
revoke test access with a reason; manual roles are preserved and explained.
Non-admins cannot inspect other subscribers or change access.

Implementation order: auth migration and API/role regression tests; subscription
service and live effective roles; customer page/account links; admin section;
desktop/mobile browser journeys; full relevant suites and operational docs.
Checks cover anonymous/blocked/non-admin denial, idempotency/concurrent renewals,
expiry, preserved manual roles, stale revocation, status filters, no secret data,
retry and success, session refresh and keyboard/mobile fit. Production payment
processing is outside this release.
