# ItemVista decisions

ItemVista is a local proof of concept for browsing, searching and asking a sales team about products. The decisions below explain the current implementation, deliberate scope cuts, and how the design can grow.

## Architecture and reviewer setup

| Decision | Rationale and trade-off |
| --- | --- |
| React and TypeScript on the frontend | A browser UI avoids emulator setup. Shared product cards, ratings and enquiry controls keep the main flows consistent. TypeScript makes the product and enquiry contracts explicit. |
| Standalone Node.js and TypeScript backend | A small HTTP service handles catalogue reads, validation and SMTP. Routes match URLs, controllers validate and translate HTTP inputs, services own business rules, and integrations handle Fake Store and SMTP. The two npm packages remain independently installable and buildable. |
| Versioned same-origin HTTP API under `/IV/v1` | The frontend uses relative paths. Vite proxies them locally and Nginx proxies them in Compose. The browser can switch between these setups without changing API URLs or contacting Fake Store directly. |
| Two local startup paths | Reviewers can use separate npm terminals and the standalone Mailpit binary, or one `docker compose up --build` command. Compose serves the built React app through Nginx, keeps the API and SMTP ports on the container network, and publishes the site and inbox to loopback. The manifest and direct proxy flow were verified. Full container startup and AWS deployment remain unverified. |

## Catalogue and discovery

| Decision | Rationale and trade-off |
| --- | --- |
| Live, read-only Fake Store API with no application database | The backend uses only `GET /products` and `GET /products/:id` upstream. The provided 20-product snapshot was used for design and remains as an automated test fixture. The production runtime uses the provider, so provider availability is a demo dependency. |
| Normalize at the upstream boundary | The Fake Store client checks response shape and product IDs, uses a five-second timeout, and distinguishes an unknown product from an upstream failure. Required field errors fail the request. Missing ratings become `null`. The product detail screen loads independently of its optional category link. |
| Derive categories from the sample catalogue | This suits the 20-product dataset and avoids database setup or an extra upstream category call. The backend owns category values, readable labels and URL-ready slugs. The frontend reuses the slug directly, including percent encoding. A category such as `office supplies` has regression coverage. |
| Featured means highest-rated | The backend ranks by average rating, then review count, then product ID. It features up to two products per category and preserves provider order for the rest. The original home scope was five featured products. The user later asked for the top ten in a carousel, with five initially visible at desktop width and one-card steps. Unrated products remain in the regular catalogue. |
| Submitted search is a literal title and description match | The backend trims the query, matches substrings case-insensitively and preserves catalogue order. The URL stores the search term. The browser loads the small product list when needed to show up to five title suggestions after two characters. All Products owns category filtering and price sorting. A separate search-filter UI was tried and removed at the user's request. |
| Shortlist stores product IDs in the browser | The shortlist requires no account and renders current catalogue information. Users can clear the list, remove individual or unavailable products, or enquire about the saved set. Successful enquiries remove only submitted items. The list belongs to the browser and origin, with no cross-device sync. |

## Enquiries and guest details

| Decision | Rationale and trade-off |
| --- | --- |
| Resolve products and validate on the server | A single enquiry accepts one product ID, while a bulk enquiry accepts 1–50 IDs and removes duplicates. The server resolves every selected product before sending so an unknown item cannot generate a partial bulk message. Contact details and an optional 500-character question are validated on the server as well as in the form. Email validation is about format. Mailbox ownership verification was kept outside scope. |
| Use one SMTP message to sales per submission | Mailpit gives reviewers a real local inbox without a paid account, Docker requirement or real sending credentials. The email lists the selected products and any question, with the customer's address in Reply-To. The app displays Thank you after SMTP acceptance and preserves the form and shortlist when delivery cannot be confirmed. |
| Keep the mail provider replaceable | Nodemailer sits behind a mail-sending function and can use configurable SMTP settings. The demo uses `sales@example.test`. Real external delivery and a separate customer acknowledgement would require additional configuration or product work. |
| Make guest details optional | Guests can save a name and email to prefill editable enquiry fields. The default is tab-scoped session storage. Remember me opts into browser-local persistence, and Log out clears both copies. This is a convenience profile with no authentication, account database or Google sign-in. Browsing and enquiries remain available without a guest profile. |

## What was deferred and why

- **Database, search service and pagination.** The sample catalogue is small enough to rank and filter in memory. Keeping the proof of concept on one upstream read path makes it easier for a reviewer to run.
- **Google sign-in and durable accounts.** The user chose guest prefill for this iteration. Identity verification and cross-device profiles would add a separate authentication and storage workflow.
- **Live sales delivery and customer acknowledgement.** Mailpit satisfies the local delivery demo. Real mail credentials, public transport, and an external recipient were outside the agreed setup.
- **Cloud deployment.** Compose is the optional local packaging path. Cloud deployment would require service networking, TLS, configuration and secrets management, and a production SMTP provider. The local demo wiring is not an AWS deployment claim.
- **Durable enquiry delivery.** The current request waits for SMTP acceptance. Handling retries across outages and preventing duplicate delivery after an ambiguous response would require a durable enquiry record and an idempotency strategy.

## If the catalogue grows

Use a provider or database with stable category IDs, indexed category and price queries, and paginated product reads. Fetch featured rows using a rating and review-count index. Move substring search and limited suggestions into a backend search index and debounce suggestion requests in the browser. Resolve bulk product IDs together with a provider batch lookup or indexed database query. Keep the existing frontend API boundary while replacing its catalogue implementation.

## With another day

1. Run a clean checkout on a machine with Docker, time both setup paths, and exercise the browse, search and bulk enquiry path through the three containers.
2. Automate browser coverage for the current critical path, including shortlist cleanup after success and retry after a mail failure.
3. If the proof of concept needs a production release, plan a durable enquiry workflow and production SMTP settings before exposing it publicly.

For run instructions and the API contract, see [README.md](README.md). For the delivery history, see [CONTEXT.md](CONTEXT.md).
