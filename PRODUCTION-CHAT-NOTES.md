# Production chat integration — 4 November 2026

Buyer and seller Messages now use the marketplace API through /api/chat/*.
NEXT_PUBLIC_API_BASE_URL must point to the marketplace host, optionally ending
in /api/v1. No separate chat tunnel is needed for messaging.

Implemented behavior:

- Conversation lists use data arrays and meta.total, with offset pagination.
- Participants provide names and account IDs. The signed-in user's ID determines
  incoming/outgoing messages. Inbox rows show backend unread counts and status.
- A live product's “Ask the seller a question” link passes its product ID.
  “Message seller” opens or creates the product conversation using
  { "type": "product", "context_id": "..." }. Opening Messages alone sends nothing.
- History loads newest-first backend pages and displays them oldest-first.
  “Load older messages” uses the oldest created_at as before. Visible polling
  catches up across missed pages and merges by message ID.
- Text sends use { "body": "..." }. Only backend history renders message bubbles.
  A success acknowledgement clears the draft and refreshes history.
- Failed/uncertain sends preserve the draft and require explicit history review
  before a manual resend. The API does not document send idempotency, so no stable
  client ID or automatic mutation replay is used.
- Loaded visible history calls /read; closed/unknown-status conversations are
  read-only. Account changes abort requests and discard private screen state.

The transport also exposes documented conversation details and chat categories.
Starting support/order/delivery conversations, attachment uploads, Socket.IO
delivery and push notifications are outside this text-chat change. Existing
conversations of these types can appear in the inbox.

The catalog's existing read-only /api/chat/sellers name lookup still uses
CHAT_SERVER_URL, independently of production messaging. If that directory is
offline, existing catalog fallback names remain available. It does not create
sessions/conversations or send messages.

Contract source: https://marketplace.archintell.com/swagger/index.html
Conversation and history fields were verified against successful responses
provided by the user. Test fixtures use synthetic identities and messages.

Checks:

- node --test tests/chat.test.cjs tests/production-chat.test.cjs tests/mobile-parity.test.cjs tests/buyer.test.cjs
- node tests/production-chat.browser.cjs with Next.js on 3011 and a dedicated
  headless Chrome debugging session on 9228.
- npx tsc --noEmit and focused ESLint.

Browser checks cover product starts, draft retention/review, body payloads, read
acknowledgements, older history, mobile layout, closed threads, account switching
and seller replies. They use synthetic API responses. An authenticated live
buyer-to-seller test is still needed; implementation testing sent no real messages.

To test after deployment: sign in as a buyer, open a live product owned by
another seller, choose “Ask the seller a question”, click “Message seller” and send
a test message. Sign in as that seller on another browser and open Messages to
reply. Confirm both histories and unread counts refresh.
