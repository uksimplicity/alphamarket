# Production chat integration preparation

The live marketplace Swagger contract was checked on 4 November 2026:
https://marketplace.archintell.com/swagger/index.html

`src/app/api/chat/productionProxy.ts` prepares the production transport against
`NEXT_PUBLIC_API_BASE_URL` under `/api/v1`. It is not yet connected to the active
route or UI. The existing presentation chat remains active pending response samples.

Prepared operations:

- GET/POST `/chat/conversations`
- GET `/chat/conversations/{id}`
- GET/POST `/chat/conversations/{id}/messages`
- POST `/chat/conversations/{id}/read`
- GET `/chat-categories` (local adapter path: `categories`)

The adapter forwards bearer authorization, strips identity overrides, uses
offset pagination for conversations and `before` timestamps for message history,
and sends text using `body`. It does not replay mutations or follow redirects.
Sending attachments is not implemented in this initial text transport.

Before activating it, obtain successful authenticated conversation-list and
message-list responses, plus a send-response example. Swagger's generic
`response.APIResponse` schema does not describe the records inside `data`.
The provided 401 response confirms missing authorization, not a data shape.
Do not copy tokens or private message content into notes or test fixtures.

The UI migration must also replace seller-ID conversation starts with product,
order or delivery context IDs (or a support category). The old service's session,
seller directory, sequence cursor and stable client message ID are not documented
by the production API. Do not preserve automatic send retries without a backend
idempotency contract. Seller-name lookups currently using the presentation
directory also need an appropriate production source or their existing fallback.

Validation: `node --test tests/chat.test.cjs tests/production-chat.test.cjs`
passes all 10 tests using synthetic responses. No real conversations or messages
were created, and authenticated production response decoding remains pending.
