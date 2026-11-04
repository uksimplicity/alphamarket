# Admin commission percentage

Finance > Commissions has a percentage form with no preset rate. Admin enters
a number from 0 to 100; 10 means 10%. Zero is a valid saved percentage and is
distinct from an unset setting. The signed-in admin account supplies admin_id.

The local /api/admin/commission-setting adapter loads the documented backend
GET /api/v1/admin/platform-settings/all and saves through
PUT /api/v1/admin/platform-settings/upsert?admin_id=... with this DTO:

    { "key": "commission_percentage", "value": "10",
      "description": "Admin-defined commission percentage; 10 means 10%." }

The key commission_percentage is the convention introduced by this frontend;
the API documentation does not establish a commission calculation key. Set the
server environment ADMIN_COMMISSION_SETTING_KEY to an existing backend key if
needed. Its value must represent percentage points (10 for 10%), not a ratio.
This form saves platform configuration; the backend must explicitly consume
that same key to calculate commissions. It does not recalculate existing ledger
records or prove the backend applies a newly saved percentage to transactions.

The UI reads back the setting before confirming success. Uncertain writes keep
the entered value and require refreshing the saved percentage before retrying.
Mutations are sent once without redirects or endpoint fallbacks. Authenticated
backend authorization and accounting remain enforced by the backend.

The form loads independently of commission records, so a records-list failure
does not prevent settings from loading. The generic Platform settings page can
also show the saved key. Malformed/unknown settings responses block editing
instead of being interpreted as an unset percentage.

Validation: node --test tests/commission-settings.test.cjs. Tests use synthetic
responses and do not modify live settings. Backend calculation integration and
authenticated deployment testing remain unverified.
