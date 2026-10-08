# Reading advertisements

New registrations keep the existing `player` role, labelled Reader. Ads depend
on an active subscription, not the author role: a manually granted author without
a subscription still gets ads while reading. Auth supplies the live entitlement
through /auth/me; API never trusts a browser flag or cached role for exemption.

Default: enabled, one dismissible internal ad after five successful scene
transitions across the reader's saves and stories. Initial entry, reload, changing
language and read-only state requests do not count. Endings never show an ad;
the due pause carries to a later non-ending transition. Story progress remains
saved before the ad appears. Escape/Continue close immediately; no forced delay,
autoplay, third-party scripts, tracking cookies or advertising network.

API owns configuration and per-reader counters. Its existing reader lock
serializes transitions. A pending random offer is claimed atomically by one tab;
claim returns creative content and consumes the offer, so later refreshes do not
repeat it. Claim rechecks the live subscription and current configuration. A
failed ad fetch never blocks reading. Retries resume with a later server response,
including choices that loop back to the same scene; a language-only rerender does
not retry. This is delivery, not proof of attention or billing: real network
impressions need a separate verified integration.
Subscribed transitions reset the counter; changing/disabling configuration
invalidates pending offers. No backlog accumulates while subscribed or disabled.

Admin Advertising section: on/off, interval 1–100 (default 5), optional plain-text
heading/body/button and safe HTTPS or same-site destination, preview and an
explicit save. Empty creative fields render a localized demonstration. No HTML
or arbitrary scripts. Configuration is version checked; conflicting updates
retain the draft and require an explicit reload. Only admins can change it.

Verification: actual gameplay API transitions, no duplicate on reload/parallel
claim, cross-user isolation, interval change/off, manual-author vs subscriber,
subscription changes between offer/claim, ending suppression, invalid URL and
admin denial. Browser checks cover dismissal/Escape, no repeated offers, late
responses after navigation, failure recovery, responsive layout and admin save.
