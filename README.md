# Officeworks AI-Native Engineer Assessment | Web Product Catalogue

This is a **web-only product catalogue and sales enquiry application** built for the Officeworks AI-Native Engineer assessment. I chose **ItemVista** as the name for my submission. It runs in a browser and supports browsing, search, shortlisting, and individual or bulk product enquiries.

The frontend and backend each have their own package manifest, lockfile, and dependencies. See [project context](CONTEXT.md) for the challenge and delivery phases.

## Why React and Node.js?

- **React for the frontend.** Reusable components keep product cards, ratings, shortlist controls, and enquiry forms consistent across screens. React also handles interactive browser features such as keyboard search suggestions, the featured carousel, and local guest profiles.
- **Node.js for the backend.** The application mainly handles network I/O. Node.js can fetch products from Fake Store and send enquiries over SMTP asynchronously. Keeping these integrations on the server gives the browser a single HTTP API and keeps SMTP settings out of client code.
- **TypeScript for both.** Explicit types make the product and enquiry data easier to validate and maintain across the two services. Vite provides the frontend development server and local API proxy.

See [AI usage and time spent](AI_USAGE.md) for the planning, prompting and review notes, and [project decisions](decision.md) for assumptions, scope and next steps.

## Run with Docker Compose

With Docker and Compose installed, run this from the repository root:

```sh
docker compose up --build
```

- Open [ItemVista](http://127.0.0.1:8080/) and the [Mailpit inbox](http://127.0.0.1:8025/).
- The frontend serves the built React app and forwards /IV/v1 to the backend. The backend sends enquiries to Mailpit on the Compose network. Only the web app and inbox are published to loopback.
- Use `docker compose down` to stop the stack. The local Mailpit inbox is temporary and removing the container discards its messages.
- If standalone Mailpit is already using port 8025, stop it or set `ITEMVISTA_MAILPIT_PORT` to another port before running Compose. Set `ITEMVISTA_WEB_PORT` if 8080 is busy. For example, in PowerShell run `$env:ITEMVISTA_MAILPIT_PORT = '8026'` before the startup command.

## Run locally without Docker

Use Node.js 20.15 or newer and npm. No Docker is needed.

**Terminal 1** · From the repository root, start the frontend.

```sh
cd frontend
npm ci
npm run dev
```

Open the Local URL that Vite prints. It starts at http://127.0.0.1:5173 and tries the next available port if that port is busy. Start both services to use the catalogue. The frontend reads live data via the backend. Start Mailpit as well to verify email delivery.

**Terminal 2** · From the repository root, start the backend.

```sh
cd backend
npm ci
npm run dev
```

The backend health endpoint is http://127.0.0.1:3000/IV/v1/health. During frontend development, Vite forwards relative requests under /IV/v1 to the backend over HTTP. For example, open /IV/v1/health on the Local URL printed by Vite while both services are running. A deployment can route /IV/v1 to the backend through its own HTTP gateway or reverse proxy.

Run `npm run build` in either service directory to build that service.

## Browse the catalogue

Featured shows the ten highest-rated products in a carousel, with up to five cards visible at once. Each arrow advances one card. All Products lists the full catalogue and supports category filtering and price sorting.

## Shortlist

Use the bookmark icon beside Enquire on a product card or detail page, then open Shortlist. Remove all clears saved items immediately. Send bulk enquiry opens one form for the entire shortlist. After successful delivery, the app removes the products included in either an individual or a bulk enquiry from the shortlist. The browser stores product IDs locally and reloads their current details from the catalogue. A saved product that is no longer available can still be removed.

## Guest details

Open the round profile icon beside Search and choose Continue as guest to save a name and email for individual and bulk enquiries. The form prefills those fields and still lets you edit them. By default the details are stored in the current browser tab's session. Choose Remember me on this device to keep them across browser sessions, or use Log out in Guest profile to remove them.

## Verify enquiry delivery locally

1. Download and extract the standalone binary for your OS from the [Mailpit releases](https://github.com/axllent/mailpit/releases). On Windows, run this from the extracted folder:

   ```powershell
   .\mailpit.exe --listen 127.0.0.1:8025 --smtp 127.0.0.1:1025
   ```

   On macOS or Linux, run `./mailpit --listen 127.0.0.1:8025 --smtp 127.0.0.1:1025`.

2. If you started the Compose stack, skip the standalone Mailpit download and startup above. With frontend and backend running, open any product and select **Enquire**. Submit a sample name and email such as `Alex Demo` and `alex.demo@example.test`.
3. Confirm ItemVista displays **Thank you** and open the [local sales inbox](http://127.0.0.1:8025/) to check the message. It includes the customer name and email, product name and ID, any question entered on the form, and a Reply-To address for follow-up.

Mailpit captures email locally. The backend defaults to loopback SMTP and the demo recipient `sales@example.test`, so the local demo needs no account or environment file. For another SMTP provider, copy `backend/.env.example` to `backend/.env`, set your SMTP and sales inbox values, and restart the backend. Keep credentials in the ignored .env file. A delivery failure leaves the form available for retry.

## Backend structure

- `src/server.ts` starts the Node.js service. `src/api.ts` wires the dependencies and maps errors to HTTP responses.
- `src/routes` matches request methods and paths. `src/controllers` validates HTTP inputs and shapes responses.
- `src/services` owns catalogue rules and enquiry processing. `src/integrations` owns Fake Store HTTP access and response normalization.
- `src/http` contains shared request and response helpers. `test` exercises the public API with a product fixture.

## Phase 2 API contract

The backend reads Fake Store API at runtime. Run `npm test` from `backend` to compile TypeScript and run the Jest HTTP integration suite. The suite starts a local test server and uses the supplied snapshot to mock Fake Store responses.

| Request | Successful response body |
| --- | --- |
| `GET /IV/v1/health` | `{ "status": "ok" }` |
| `GET /IV/v1/products` | `{ products, featuredIds }` |
| GET /IV/v1/products?q=backpack | { products }, filtered by title and description |
| GET /IV/v1/categories | `{ categories }`, with `value`, `slug`, and `label` for each category |
| `GET /IV/v1/categories/electronics/products` | `{ category, featured, remaining }` |
| `GET /IV/v1/products/1` | `{ product }` |

Product records include `id`, `title`, `price`, `description`, `category`, `image`, and `rating`. Category listing URLs use the URL-ready slug from the categories response as-is. For example, a category named office supplies returns office%20supplies. Featured products are selected by descending average rating, then descending review count, then ascending product ID. The API returns up to ten rated picks for Featured and two per category. Unrated products remain available in the catalogue. Search trims the term and uses case-insensitive partial matching. An empty result returns an empty products array. A blank query returns HTTP 400. The frontend results URL is /search?q=backpack.

Send `POST /IV/v1/enquiries` with `Content-Type: application/json` and a body such as `{"productId":1,"name":"Alex","email":"alex@example.test"}`. For a bulk enquiry, send productIds with an array of 1 to 50 product IDs in place of productId. The server resolves every ID before sending one email. The optional question field accepts a string of up to 500 characters. A valid request returns HTTP 200 with `{ "status": "sent" }` after SMTP accepts the message. SMTP delivery failure returns 503. Invalid input returns 400, oversized bodies return 413, and unsupported media types return 415. Missing products or categories return 404. Upstream failures return 502. Error bodies use `{ error }`.
