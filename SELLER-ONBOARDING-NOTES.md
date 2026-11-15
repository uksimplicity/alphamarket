# Seller onboarding - 15 November 2026

The seller workspace now displays a persistent setup/activation banner after
login. Inactive accounts see activation guidance and a support link regardless
of whether this browser has saved store details. Store setup is optional and
does not affect account activation. Active accounts without locally saved
details see an optional storefront setup link. Active accounts with saved
details have no banner. Existing product activation checks remain.

Check activation forces a fresh authenticated profile read, then synchronizes
the saved session. Session verification now includes the server's status field
instead of retaining stale login status. Session identity/generation checks
prevent a response from a previous login overwriting another account.

Outstanding integration: storeProfileClient currently stores storefront details
in browser localStorage only. The public Swagger checked during this work has
no store submission or seller verification endpoint. The user confirmed they
have not seen a store endpoint. Saving locally must not be described as submitting a store
for review, and missing browser data does not establish that a server store is
absent. No verification submission or account activation was performed.
