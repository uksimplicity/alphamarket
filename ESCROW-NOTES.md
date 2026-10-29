# Escrow integration follow-up

Saved on 2026-10-29 at the user's request. The user will provide the escrow endpoint details when available. Leave this follow-up pending until those details arrive.

## Intended behavior

Buyer pays through Paystack → funds stay held in escrow → delivery is confirmed → escrow is released → released funds become available for seller withdrawal.

Payment confirmation alone must not be treated as escrow release or seller payout.

## Current state

- Buyer checkout is connected locally to order creation and Paystack initialization, with callback verification and backend order payment-status checks.
- Buyer order pages read backend orders. Pending orders can resume payment.
- Six focused payment tests and the production build passed during implementation. A full Paystack test-mode transaction has not been performed.
- The deployed Swagger documentation describes `POST /buyer/orders/{id}/confirm-delivery` as confirming delivery and releasing payment to the seller.
- The corresponding frontend API proxy exists at `src/app/api/buyer/orders/[orderId]/confirm-delivery/route.ts`, but the buyer order details page does not yet offer a connected delivery-confirmation action.
- The documentation describes withdrawal requests as reserving wallet funds and requiring admin approval. This does not prove that unreleased escrow funds are excluded from the withdrawable balance.
- Admin pages reference escrow pending, timeout, release, and reversal endpoints. Their contracts and actual behavior still need confirmation.
- Seller payout account and withdrawal screens are not yet connected as part of this payment work.

## Information still needed

The user does not have the backend repository link. They have JSON documentation, which has not yet been shared, and plan to obtain the escrow endpoint details.

When supplied, inspect the JSON or endpoint documentation for paths, HTTP methods, authentication, required fields, response examples, escrow states, and release/reversal conditions. API documentation can establish the intended contract; it cannot by itself prove backend enforcement.

## Resume here

1. Confirm the supplied escrow contract and distinguish payment status from escrow status and withdrawal availability.
2. Connect the buyer delivery-confirmation action and escrow status display to the confirmed endpoints.
3. Verify in backend code or a controlled test environment that payment does not immediately create a withdrawable seller balance; unauthorized or premature release is rejected; and repeated payment callbacks or delivery confirmations cannot release funds twice.
4. Check withdrawal eligibility before and after release, and confirm reversal/refund behavior.
5. Test the full flow in Paystack test mode with buyer and seller accounts before claiming escrow is fully verified.
