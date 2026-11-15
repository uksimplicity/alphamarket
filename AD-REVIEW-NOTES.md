# Ad review layout and rejection comments - 15 November 2026

Changes approved by the user: show complete photos with thumbnail selection and
enlargement, compact the moderation panel, label the listing details, show the
poster name when returned and allow copying its ID, capitalize action labels,
and require an explicit rejection comment. The title/photo content and the
unresolved moderation-status mapping are outside this change.

AdGallery uses the existing media URL resolver, preserves saved media, and fits
images with object-fit: contain. AdPoster displays only names supplied with the
ad, with a clear fallback when unavailable; it does not invent a seller identity.

The rejection dialog labels its required field Reason for rejection, limits it
to 2,000 characters, and sends the trimmed comment as `reason` to the existing
`POST /admin/ads/{id}/reject`. A failed moderation request leaves the dialog
open with its comment and error. Only confirmed success closes it and refreshes
the record/history. Uncertain writes retain the existing no-repeat safeguard
and expose the reload guidance within the dialog. The seller feedback panel
shows a rejection heading and the returned comment; history remains available.

Status-dependent availability of approve/reject remains unchanged. An ad with
an unreadable status will still require the separately paused investigation
before those controls can be offered. No live moderation action was performed.

Verification: 20 Ads/rejection/media tests, TypeScript, production build, and
all 14 synthetic Ads browser scenarios passed. Browser checks include full-fit
images, thumbnail selection, enlargement, mobile detail layout, and preserving
the rejection comment/dialog after a failed request. Focused lint has no errors
and three native-image optimization warnings. Desktop/mobile preview images are
local ignored QA artifacts.

Publication record (local): pushed to `uksimplicity/alphamarket` main as
`0f2026739b9abf40e21b78c12d441cb138400c7b`. The branch update was verified.
Vercel reported pending:
https://vercel.com/fnuk-s-projects/alphamarket/CzEGvkmV6toWvydZJnAxtooZpWFT
Publication used the GitHub integration; local Git refs/index are still on an
older baseline. The local production preview server was stopped after testing.

## Follow-up: admin moderation only

The user subsequently approved restricting admin ad review to Approve, Reject,
Suspend and Unsuspend. Admin Edit ad, Delete and Request changes controls have
been removed. Only the ad owner can mount the editor from this detail page.
The app's admin Ads proxy rejects PUT/DELETE on ad records and POST requests to
request-changes before any backend call. Posting-fee configuration and owner
editing retain their existing routes. Backend authorization outside this app
remains the backend's responsibility. Status mapping remains unchanged/paused.

Verification for this follow-up: 17 moderation/proxy regression checks and
focused lint passed. This follow-up has not been published yet.

## Follow-up: nested moderation status

The user supplied an actual admin list response with the ad status at
`moderation.status` and explicitly approved the frontend mapping fix. The shared
status reader now prefers that nested string and falls back to nonblank legacy
`moderation_status`, `moderationStatus`, or `status`. Values are trimmed and
lowercased. Owner account status and activity flags do not supply ad status.
This resolves the previously paused mapping issue for list/detail badges,
moderation action availability and promotion eligibility without a backend change.

All 19 moderation/proxy/status regression checks and focused lint passed.
These status and moderation-only follow-ups are still local, not published.
