# Product-type API investigation — 1 November 2026

The signed-in user reported this response for the web request
`GET /api/admin/product-types?limit=100`, with status `200 OK`:

```json
{"success":true,"data":{"products":[],"total":0,"limit":100,"offset":0}}
```

This is an empty products collection. It does not establish whether the backend
has any product-type records. The authenticated upstream response has not been
verified directly: the configured QA admin accounts were rejected at login.

## Documented routes

- `GET/POST /api/v1/admin/product-types`
- `GET/PUT/DELETE /api/v1/admin/product-types/{id}`
- `GET /api/v1/seller/product-types`
- `GET /api/v1/seller/product-types/{id}`

Sources: [admin schema](https://marketplace.archintell.com/admin-docs/doc.json)
and [marketplace schema](https://marketplace.archintell.com/swagger/doc.json).
Both declare generic response schemas, rather than a concrete list envelope.

## Web changes

- Product-type reads load independently of unrelated products and attributes.
  The list shows loading, retry, service errors, and genuine empty results separately.
- The proxy uses the documented admin path without guessed root-level routes or
  followed redirects. A wrong collection triggers one read from the documented
  seller product-type catalog using the same authorization token. Authorization
  failures do not trigger fallback. Writes are sent once to the admin route.
- If neither catalog returns a product-type response, the UI shows the service
  mismatch instead of presenting an empty product-type list.
- Product-type responses include `X-Admin-Upstream-Path` for route verification;
  authorization headers are never included in diagnostics.
- Record parsing supports snake case, camel case, and capitalized fields already
  recognized by the seller form. Category relations remain attached to the type.
- Creation must return a saved record or confirm it through the list. A generic
  success acknowledgement no longer creates a fabricated `tmppt-...` row.

## Backend check still needed

With a valid admin session, request the documented upstream admin URL directly
and compare it with the seller catalog. Check the route/controller binding,
service/repository query, and response serialization if either returns products.
The list should contain persisted product-type IDs, names, and category IDs or
category objects. A successful create should return the persisted record or make
it available through the list immediately.

Frontend regression tests cover the exact reported response, recovery from a
correct seller catalog, explicit errors when both sources return the wrong
collection, independent loading, and accepted-but-unconfirmed creation. These
checks use synthetic responses and do not prove that live records were restored.
