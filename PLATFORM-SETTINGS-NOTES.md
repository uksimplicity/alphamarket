# Editable platform settings

The admin `/admin/platform-settings` page now groups server-provided settings
into Commissions, Escrow & payments, and Delivery pricing. Each setting has a
label, numeric input or supported-option dropdown, current/default values,
validation, an unsaved indicator, a discard action and its own Save changes
button. Search and section links help navigate the list. Zero is a valid value;
percentages allow decimals and escrow hours require whole numbers. Delivery
minimum/maximum checks use the other setting's saved value.

The dedicated `/api/admin/platform-settings` proxy reads
`GET /api/v1/admin/platform-settings/all` and updates through
`PUT /api/v1/admin/platform-settings/upsert` with `{ key, value }`. This matches
the current deployed admin Swagger contract. The authenticated backend supplies
the admin identity; no admin ID or arbitrary key entry is requested in the UI.
Only settings returned by the backend appear. There is no create/delete form.

Updates forward once without endpoint fallback, redirect following or automatic
retry. A fresh settings read must confirm the submitted value before success is
reported. Unknown write results keep drafts and require an explicit refresh
before another save. Other unsaved fields survive individual saves and refresh.
Backend authorization, registered-key/type validation and application of values
remain enforced by the backend. No live configuration was changed during QA.

Validation: six contract/validation tests, eleven Chrome checks using synthetic
responses, TypeScript, focused lint and a production build. Desktop and mobile
screenshots were visually reviewed. Authenticated writes to the hosted backend
remain for the user's controlled test.

    npm run test:settings
    node tests/platform-settings.browser.cjs

Browser checks require the preview on port 3011 and dedicated Chrome CDP on 9228.
