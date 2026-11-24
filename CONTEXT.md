# Officeworks AI-Native Engineer assessment

I chose **ItemVista** as the name for the web product catalogue built for this assessment.

## Goal and status

Build an interactive catalogue proof of concept that can evolve as the product source, visual design and mail provider change. Customers browse categories or search, open product details and send a sales enquiry. Phase 1 screen designs and Phase 2 backend APIs are approved. Phase 3 connects the React screens to the backend and removes the frontend product fixture and simulated enquiry. Phase 4 search is approved. Phase 5 implements enquiry delivery through Mailpit and was verified from the browser to the local sales inbox.

## Agreed implementation direction

- React frontend and Node.js backend, both in TypeScript. The reviewer clones from GitHub and installs and runs each service from its own folder. Both services have separate npm manifests and lockfiles. From Phase 3, the frontend obtains product data and submits enquiries through the backend HTTP API. Vite forwards relative /IV/v1 requests during local development. Docker Compose is optional and starts the frontend, backend and Mailpit with one command. The independent npm and standalone Mailpit workflows remain supported. Aim for local startup in under 10 minutes without paid services or reviewer accounts.
- Fake Store API access is backend-only and read-only. Use `GET https://fakestoreapi.com/products` for the catalogue and derive categories from product data. Use `GET https://fakestoreapi.com/products/:id` for a single product. Both live Fake Store endpoints returned HTTP 200 from the Node.js runtime during Phase 2.
- The home page features up to ten products in a carousel, with up to five visible at once, ranked by Fake Store average rating. Higher review count breaks a rating tie, then lower product ID breaks any remaining tie. Products without a rating stay in the regular catalogue.
- Each category features up to two products using the same rating rule. All other products appear below in API response order.
- Search on submit. The proposed default is a trimmed, case-insensitive substring match against title and description, with a clear empty state.
- Opening a product tile shows the matching product details. Put an Enquire action on both the tile and the details page. Pre-fill the selected product and ask for name and email only. Resolve the product server-side using its ID.
- Interpret frontend email verification as format validation before submission and validate again on the backend. Ownership verification by code or link is outside this interpretation. If SMTP succeeds, show Thank you. If it fails, keep the form available for retry.
- Use Mailpit as the initial sales inbox, subject to reviewing the demo. Run the standalone binary on loopback with SMTP on port 1025 and the inbox at http://127.0.0.1:8025. It needs no account. The README documents the standalone binary setup for reviewers. Evaluate a real inbox after seeing the local flow. A real recipient still requires an SMTP delivery service.
- Keep secrets out of Git and provide an example environment file when configuration is added. Any infrastructure included must be AWS-compatible.

## Delivery phases

| Phase | Scope | Ready when |
| --- | --- | --- |
| 1. Frontend screen designs (approved) | Home with five featured products, category page with two featured items and the rest below, product details, search results, and an enquiry form with the selected product, name and email. Include loading, empty, error and confirmation states in the designs. Use the supplied product data for representative content. | The screens and navigation can be reviewed before wiring APIs. |
| 2. Backend APIs (approved) | Implement `GET /IV/v1/categories`, `GET /IV/v1/categories/:category/products`, `GET /IV/v1/products/:id`, and `POST /IV/v1/enquiries`. Provide catalogue data for the five home picks through `GET /IV/v1/products`. Validate product ID, name and email in the enquiry endpoint and define the mail integration point. | Catalogue endpoints return the expected data, and enquiry input validation is testable. Valid requests receive an explicit unavailable response until mail delivery is connected. |
| 3. Frontend integration (implemented) | Connect the home, category, product detail and enquiry screens to the backend. Make navigation responsive and keyboard-accessible, and handle loading and failures without losing enquiry input. | A reviewer can browse to a product and open a correctly populated enquiry form from a tile or product page. |
| 4. Search (approved) | Add a persistent search box, a shareable results URL and a backend search endpoint. | Enter and the Search button both show only matching products, with blank submissions returning to Featured and clear no-match and failure states. |
| 5. Enquiry email (implemented and verified) | Connect the enquiry handler to Mailpit over SMTP and verify receipt in the local inbox. | The email contains the selected product and contact details, Thank you appears after SMTP accepts it, and delivery failures keep the form available for retry. |

### Phase 1 delivered

- ItemVista wordmark on white with Item in deep navy (#194E85), Vista in burnt orange (#C4511B), and the italic tagline “Explore products. Find your fit.” Primary buttons use navy. Active tab accents use burnt orange. Input focus uses a soft blue fill and a navy border.
- Featured and Catalogues navigation. The home page opens with Featured Products and the five agreed picks, with Browse Product Catalogues below.
- The Catalogues overview shows four clickable category tiles, each with a product image preview. The initial category previews featured the first two products and showed the rest below, with a Back to Catalogues arrow above the category heading. Individual product details retain the Enquire action and the category link.
- Product details, snapshot-based search results and suggestions, and an enquiry form that preselects the product and asks for name and email. The form checks email format and simulates confirmation for design review.
- Frontend and backend are independent npm services with separate dependencies and lockfiles. Start the preview with npm run dev from frontend. Vite prints the available URL and forwards /IV/v1 requests to the backend during development. At the end of Phase 1, the backend exposed only /IV/v1/health.
- The frontend TypeScript and Vite build passed after the final navigation adjustment.

### Phase 2 plan

1. Keep the standalone Node.js TypeScript backend and health endpoint. Add a small boundary for product data and check the live Fake Store reads from the backend runtime. Normalize upstream responses and handle timeouts, upstream errors and missing products. Use the supplied snapshot as a deterministic test fixture. If live access remains unreliable, document an explicit local snapshot mode for reviewer runs.
2. Define and implement the read routes. GET /IV/v1/products returns the catalogue and the featured IDs in rank order. GET /IV/v1/categories returns stable slugs and display names that match the preview. GET /IV/v1/categories/:category/products returns the top-rated products as featured and preserves source order for the remainder. GET /IV/v1/products/:id returns one product. Use each upstream category's original value internally, including jewelery.
3. Implement POST /IV/v1/enquiries with a JSON body containing productId, name and email. Check input at the server, resolve the product by ID, and prepare the mail integration point. Return 400 for malformed or invalid requests, 404 for unknown products, and an explicit 503 for valid submissions while mail delivery is unavailable. Leave SMTP delivery for Phase 5.
4. Run backend tests against the fixture and smoke-test the routes locally. Cover the five home picks, four categories, feature order, product lookup, invalid IDs, upstream failure, invalid enquiries and the mail-unavailable response. Document request and response examples and start commands for the Phase 3 handoff.

### Phase 2 delivered and assumptions

- Backend structure follows the request flow from routes to controllers to services. The Fake Store client lives under integrations, and shared HTTP parsing and response helpers live under http. The API composition and error mapping live in api.ts.

- The standalone Node.js backend uses only Fake Store GET /products for the catalogue and GET /products/:id for product details and enquiry lookups. The approved API prefix is /IV/v1, and the frontend uses it through the Vite proxy.
- The reference catalogue contains 20 products. This proof of concept has no database and makes no separate upstream API call for categories or category filtering. Both endpoints derive their results from the same catalogue lookup implementation. Each request fetches the upstream list once. Category display names and slugs match the approved frontend. Phase 2 initially used source order for category picks. Phase 3 replaced that rule with average rating.
- In production, obtain category metadata from a dedicated upstream endpoint or a categories table with stable IDs. Query products by category using an index and fetch one page at a time in a stable order. For rating-based features at scale, query a rating index for the top results. Avoid deriving the full category inventory by repeatedly downloading the entire catalogue.
- Upstream request timeout is five seconds. Upstream failures or invalid data return HTTP 502. The attached snapshot is a test fixture. The live endpoints worked from the backend runtime, so a runtime snapshot fallback was left out of this phase.
- The enquiry accepts a positive integer productId, a name of up to 120 characters, and a basic email format up to 254 characters. The request body is limited to 8 KB. Contact values are trimmed and stay in the backend. Phase 2 returned HTTP 503 for valid requests until delivery was connected.
- Verified live health, catalogue, categories, Electronics listing, product details and the enquiry response. The Jest HTTP integration suite uses the supplied snapshot to mock Fake Store responses and covers the catalogue, category ordering, product lookups, upstream errors and enquiry validation. All 21 Jest HTTP integration tests passed after the prefix update. Run npm test from backend.

### Phase 3 delivered and assumptions

- React reads /IV/v1 through the local Vite proxy. Home uses backend featured IDs, Catalogues uses the category list and product image previews, category pages use the backend featured and remaining groups, and product and enquiry pages fetch the selected product.
- Removed frontend/src/products.json. The backend test fixture remains for deterministic Jest tests.
- Added loading, empty, not-found and retry states. The enquiry form posts the selected product ID, name and email. The submit button is disabled while sending and contact fields stay filled after an error. Confirmation requires a successful API response. During Phase 3, valid submissions returned HTTP 503 while SMTP was pending.
- The header info icon beside Search explains that each category features its two highest-rated products and the home page features the ten highest-rated overall. The page loading state uses a centered spinner with Loading... and offers retry if a catalogue read stalls.
- At the end of Phase 3, search suggestions and full results still used browser-side matching against the live product list.

### Product snapshot

The supplied products.json contains 20 products across four categories. Use the original category values in data handling, including the API spelling `jewelery`, and display readable category labels. Use the attachment as a reference for screen design and deterministic tests. The backend remains responsible for supplying product data to React.

### Search and catalogue refinements

- The search field uses a subtle background change on focus. Submitting an empty or whitespace-only search returns to Featured.
- The Featured tab shows a responsive carousel of the ten top-rated products. At desktop width, five cards are visible, and each arrow advances one card. All Products is a separate tab with the full live catalogue, category filtering and price sorting. The Shortlist tab sits on the far right of the navigation.

### Search behavior

- Suggest up to five product titles after two trimmed characters using a case-insensitive partial match. Select a suggestion to open that product. Enter in the input or the Search button opens full results. The header loads the existing catalogue from our backend once per page when suggestions are first needed, then filters titles locally. Use Up and Down to move between suggestions, Enter on a focused suggestion to open it, or Escape to close the list.

- Submit using Enter or the Search button. Trim the term and return to Featured if it is blank. For a non-empty term, put it in the results URL as `/search?q=backpack` so refresh and browser navigation preserve it.
- React requests `GET /IV/v1/products?q=backpack` from our backend. The backend does a case-insensitive substring match on product titles and descriptions and preserves catalogue order. The search response is { products }, with an empty array for no matches. The same list endpoint without a query returns the full catalogue and featured IDs. A blank q returns HTTP 400 before any upstream call.
- Search the small catalogue in memory using the same backend product source as browsing. Show the query, matched products, and a no-results message when appropriate. Each result links to product details and offers the same Enquire action.
- Jest covers partial and mixed-case matches, description-only matches, source order, blank and no-match queries, and upstream failure. The supplied snapshot contains a backpack match with product ID 1.

### Phase 5 delivered

- Nodemailer connects the enquiry service to an SMTP transport. The default local recipient is sales@example.test and the default SMTP server is Mailpit on 127.0.0.1:1025. The Mailpit inbox is available on http://127.0.0.1:8025.
- The plain-text sales message gives the customer name, email, product name and product ID. Its Reply-To is the customer address. The server still resolves the product by ID and keeps contact details out of the Fake Store request.
- The API returns 200 with status sent after SMTP accepts the message, or 503 if delivery fails. The frontend shows Thank you after success and keeps contact fields filled on failure.
- backend/.env.example documents SMTP overrides. The README explains the Docker-free demo and standalone Mailpit setup. A real provider can be configured with environment settings.
- Verified a synthetic enquiry in ItemVista and confirmed the same message arrived in Mailpit. All 30 Jest tests pass, including message content and SMTP failure handling.

### Ratings and enquiry refinements

- Product cards and detail pages use one rating display for the API score and review count. Missing ratings display Not yet rated. The ranking rules are unchanged.
- The enquiry form accepts an optional question of up to 500 characters. The example placeholder is How fast can this be delivered? A supplied question is included in the plain-text sales email. Empty questions are omitted.

### Shortlist

- Search uses keywords. Category filtering and price sorting are available on All Products.
- Product cards and details share shortlist state. The browser stores only product IDs in localStorage. The Shortlist page resolves those IDs against the current backend catalogue and lets users remove unavailable entries. A bookmark icon next to Enquire toggles a single item. Remove all clears the local shortlist. Send bulk enquiry opens one form and sends one email with all saved products. Missing products must be removed before sending. A successful enquiry removes the submitted products from the shortlist while keeping the confirmation visible. Failed enquiries keep the saved products.

### Guest details

- Continue as guest is optional. Name and email prefill both enquiry forms and remain editable. The default is sessionStorage. Remember me uses localStorage. The round profile icon beside Search opens the guest form or the saved name, email and Log out action. Logging out removes both saved copies. The guest profile stays in the browser and provides contact defaults.

### Final review fixes

- Product details and Enquire render as soon as the product lookup succeeds. Category metadata is loaded independently and the optional category link is omitted if that lookup fails.
- The category API provides a URL-ready slug. The frontend reuses it verbatim, including percent-encoded characters. A Jest regression test exercises a replacement category named office supplies.
- The enquiry UI says it could not confirm delivery when SMTP returns an ambiguous failure. The contact fields remain available for retry.
- Search continues to match titles and descriptions.

## Assessment and submission

- The brief scores solution design, decisions and assumptions, implementation quality, critical-path tests, and AI engineering practice. Use AI to plan and build, review its output and be ready to defend the submission. Shortlisted candidates have a 45-minute walkthrough with a small live change.
- Suggested time box is two to three hours. Record actual time split across planning, building, testing and review. Document any justified simplifications.
- Submit the GitHub repository link by replying to the original email. Grant named reviewers access if private. Leave a feature-branch PR into main open and write a clear description.
- Include full source, tests, and reviewer setup and configuration in the README. See decision.md for assumptions, scope cuts, scaling plans and next steps.
- AI_USAGE.md documents the tool and model, plan, five decisions, review corrections, and the estimated time split for the overall project. The README explains the stack choice.
- Before submission, test the critical flows, verify a real message in Mailpit, and time the README setup from a fresh checkout.
