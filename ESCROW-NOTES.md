# Escrow integration status

Updated 2026-10-29. The user supplied the [admin API documentation](https://marketplace.archintell.com/admin-docs/index.html#/) and confirmed that escrow applies to all user categories, including marketplace and delivery participants. The backend repository is not available in this workspace.

## Confirmed API contract

The admin specification at `/admin-docs/doc.json` uses `/api/v1` as its base path and documents:

- `GET /admin/escrows/pending` and `GET /admin/escrows/timed-out`, each with `limit` and `offset`.
- `POST /admin/escrows/{id}/release`, using an **escrow ID**, with optional `{ "notes": "..." }`.
- `POST /admin/escrows/{id}/reverse`, using an **escrow ID**, with required, non-empty notes. The prose calls notes optional, but `dto.ReverseEscrowRequest.required` includes `notes`; follow the schema.
- `GET /admin/orders`, described as orders for all users, with optional buyer, seller and status filters, and `GET /admin/orders/{id}`.

The release description mentions paying a rider; the user explicitly confirmed that escrow applies to all categories. The UI therefore preserves every returned category and uses the neutral term **recipient**. Backend support for every category still needs runtime verification.

## Implemented frontend behavior

- Admin queues include all returned categories without imposing a seller-only or rider-only filter. Marketplace, rider and super-admin roles can access the controls, subject to the backend's authorization rules.
- Release and reversal use explicit confirmation dialogs. Cancellation sends no request. Reversal requires an intentional reason. Records without an escrow ID or with a terminal escrow status cannot be resolved from the UI.
- A dedicated admin escrow proxy forwards to the documented endpoint once. It does not follow redirects, guess non-admin fallback URLs, or automatically replay a financial action after a lost response.
- After an uncertain action, the row stays blocked until the administrator explicitly refreshes the queue. The backend remains responsible for preventing duplicate releases across sessions or concurrent requests.
- Customer and seller order details show escrow status separately from payment status. Missing escrow status is shown as **not reported**, never inferred as held or released from `payment_status: "paid"`.
- Receipt confirmation is available only when the backend identifies the signed-in account as the order's customer, payment is paid, delivery is marked delivered, and escrow is not terminal. It uses the documented `/buyer/orders/{id}/confirm-delivery` endpoint, asks for confirmation, and reloads backend status. It does not itself assign an escrow-release state.
- Admin finance lists now describe pending and timed-out records as escrows rather than completed payouts or transaction history.
- Non-admin accounts do not receive admin escrow-list access or release/reversal buttons. Other applications, including the separate rider app, have not been edited by this change.

## Still unverified

API documentation establishes the interface, not the backend's accounting behavior. The response schema is generic, so actual escrow record fields and category coverage still need confirmation with authenticated data.

Use backend code or a controlled test environment to verify that:

1. Successful Paystack payment creates held funds without immediately increasing a withdrawable recipient balance.
2. Users can view only their own order/escrow data; only authorized administrators can release or reverse escrow; only the actual customer can confirm receipt.
3. Marketplace and rider/delivery categories follow the intended hold, release and reversal rules.
4. Repeated callbacks, receipt confirmations and concurrent admin actions cannot release or refund funds twice.
5. A timeout does not automatically turn into a successful payout or refund unless that behavior is explicitly implemented and intended.
6. Withdrawal eligibility changes correctly after release, and reversal refunds/cancellation behave as documented.

No live escrow has been released, reversed or paid out during implementation. Financial browser checks use synthetic data. Seller bank setup, account verification, payout summary and withdrawal history/request/cancellation are connected at `/vendor/payments`. Their available balance comes only from the payout service, independently of paid sales and escrow statuses. Actual accounting and fund movement remain unverified.
