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
