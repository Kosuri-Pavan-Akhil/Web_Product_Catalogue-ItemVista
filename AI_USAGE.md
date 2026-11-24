# AI usage for ItemVista

## Tooling and model

| Tool | How it was used |
| --- | --- |
| OpenAI Codex in the desktop app | Read the challenge brief, turned requirements into a phased plan, proposed trade-offs, edited the frontend and backend, and iterated on user feedback. The session identified the agent as GPT-6-based Codex. The exact model variant was unavailable. |
| PowerShell, Node.js, npm, TypeScript and Vite | Inspected and edited source, installed locked dependencies, built both services, and ran local smoke checks. |
| Jest | Exercised the compiled Node.js API over HTTP. The suite injects a Fake Store fixture and a test mail sender so tests are repeatable without a live upstream or inbox. |
| Codex browser computer use | Checked rendered catalogue screens, search suggestions and keyboard selection, profile and shortlist behavior, enquiry confirmation, and the Mailpit inbox. Used isolated local previews for some checks to avoid changing the user's saved state. |
| Mailpit, Docker Compose CLI and Nginx | Verified real local SMTP capture. Later validated the Compose manifest and smoke-tested the Nginx static serving and API proxy path with the backend and Mailpit outside containers. |

The project used no repository-specific agent instruction files. [CONTEXT.md](CONTEXT.md) contains the working plan, user decisions and phase notes. [decision.md](decision.md) explains the current architecture, scope and follow-up work.

## Implementation plan and what shipped

| Phase | Work completed | Review evidence |
| --- | --- | --- |
| 1. Frontend prototype | Built a clickable React catalogue using the supplied 20-product snapshot. Iterated on the ItemVista wordmark, category previews, product details, navigation and the enquiry form. | The user reviewed the preview and corrected where the Back to Catalogues control should appear. |
| 2. Backend API | Built the standalone versioned API, with routes, controllers, catalogue and enquiry services, and a Fake Store integration. Derived categories from the small product list, checked upstream data, and added Jest HTTP tests. | Live Fake Store list and product reads returned 200 from the Node.js runtime. Fixture tests covered the public API without requiring the live service. |
| 3. Frontend integration | Replaced the frontend snapshot with live reads through the backend. Added loading and retry states, product lookup and enquiry submission. Changed featured selection to use upstream ratings at the user's request. | Verified live API calls through the Vite proxy. A later browser check confirmed the product page and Enquire action still render during a category metadata outage. |
| 4. Search | Moved submitted search to the backend and retained quick title suggestions in the browser. Added a results URL, keyboard navigation, and highlights in the suggestion dropdown. | Used the browser to open a suggestion with the arrow keys and Enter, verify a description-only search, and check the highlighted letters for `men`. |
| 5. Email delivery | Integrated Nodemailer with Mailpit. The sales email includes the customer name, email, product and ID. Reply-To points to the customer address. | Submitted a test enquiry in ItemVista, saw the confirmation, and inspected the captured message in Mailpit. |

After the five phases, the user approved adding ratings and review counts, an optional enquiry question, a browser-local shortlist, and one-form bulk enquiries. A successful enquiry removes the submitted products from the shortlist. The user also added optional guest details to prefill contact fields, and moved filtering and price sorting to All Products while restoring keyword-only search. The UI then gained a ten-item Featured carousel, a separate All Products tab, and several rounds of header and card styling. The last implementation change added optional Docker Compose while keeping independent npm and standalone Mailpit startup.

## Five prompts and decisions that shaped the work

The following are paraphrased from the conversation.

1. **Understand the assessment before solving it.** The user asked Codex to read the full brief, explain what would be assessed, and plan before writing code. Codex proposed a five-phase delivery plan around the browse, search and enquiry flow. The user approved the phases and used the preview as a checkpoint before API integration.
2. **Keep frontend and backend separate and let reviewers run the app without Docker.** The user selected React and Node.js, both in TypeScript, and wanted independent services. Codex replaced the original shared npm setup with two manifests and lockfiles after workspace linking failed on Windows. The services communicate over HTTP. The user later requested Compose as a second startup path, so the npm path stayed available.
3. **Use the small catalogue sensibly, and explain what changes at scale.** The user asked to derive unique categories from the product list and document what would change with real volume. Codex isolated the upstream client, documented when to use dedicated category queries and pagination, and later simplified the nested fetch helper after the user asked how to make it more readable. The user also spotted Fake Store's rating data and approved ranking by score, review count and product ID.
4. **Make search predictable, then refine the interface from actual examples.** The user asked for suggestions and later provided a screenshot showing exactly where to highlight `men`. Codex implemented case-insensitive backend search over titles and descriptions, kept suggestion matching on titles, and applied highlighting inside the dropdown. A trial of category and price filters on the results page was removed at the user's request. The final catalogue tab uses its own category filter and price sort.
5. **Send sales a simple message about the customer and the selected products.** The user approved Mailpit for the demo and specified the email wording. Codex implemented plain-text single and bulk enquiries, an optional question, and a confirmation tied to SMTP acceptance. The user then specified that successful submissions should remove the corresponding bookmarks. Browser testing exercised successful single and bulk submissions and a simulated delivery failure.

## AI mistakes, feedback and corrections

| What happened | How it was caught and corrected |
| --- | --- |
| Codex put Back to Catalogues on the individual product page while the user expected it on the category listing. | The user's screenshot showed the category heading and missing control. Codex added the back link to category listings and removed it from product details after the user clarified the intended placement. |
| Codex highlighted search text in product descriptions on the full results page. | The user supplied a screenshot of the five suggestions for `men`. Codex moved highlighting into the dropdown, removed the description excerpts, and checked the result in the browser. |
| The product page waited for both product details and the category list. A provider category slug could also be encoded twice. | Code review identified both coupling issues. Codex made the category link optional, reused the backend's URL-ready slug, added a regression test for `office supplies`, and tested both paths in an isolated browser preview. |
| The enquiry UI reported that an email had not been sent for every SMTP error. | Code review called out the ambiguous case where the connection drops near acceptance. Codex changed the UI to “We couldn’t confirm your enquiry” and kept the contact fields available. |
| The first shared npm setup hit a Windows workspace symlink failure. The first in-place Jest install also hit a Windows permission error. | Codex split the services into independent packages. Jest was installed in a clean temporary workspace and then verified from the actual backend folder using its own manifest and lockfile. |

## Verification and known limits

- **Builds and automated tests.** Both services built successfully at the Compose milestone. The backend Jest suite passed all 41 tests, covering ranking, category slugs, search, product lookup, enquiry validation, bulk selection, and SMTP failure handling.
- **Browser checks.** Codex checked the carousel advancing one card at a time from ranks 1–5 to 6–10, the final arrow states, All Products category filtering and both price sort directions, shortlist persistence and removal, and guest prefill and logout. These were interactive checks performed during development.
- **SMTP checks.** A local enquiry reached Mailpit from the browser. Separate checks confirmed that an optional question arrived in the message and that a bulk enquiry produced exactly one message containing both selected IDs.
- **Compose checks.** The standalone Compose CLI validated the manifest. A direct local Nginx smoke test checked React routes and assets, forwarding of encoded API paths and search parameters, and an enquiry captured by Mailpit. This machine had no Docker engine, so building and starting the three containers together was not verified. There was no AWS deployment.
- **Reviewer setup.** The README describes both startup paths and the local inbox. The under-ten-minute target was not timed on another reviewer machine.

## Time spent

This is a retrospective estimate of the overall project effort, including time spent outside the Codex chat.

| Activity | Approximate time |
| --- | ---: |
| Reviewing the assessment, sharing project context, and clarifying requirements | 1 hour |
| Planning and iterating on screens and user flows | 45 minutes |
| Developing the frontend and backend | 2–2.5 hours |
| Testing the application and verifying the main flows | 1 hour |
| Adding enhancements, optimizing the implementation, and improving code readability | 1–1.5 hours |
| Setup and troubleshooting | 30 minutes |
| Docker Compose setup and verification | 30 minutes |
| Documentation and submission preparation | 15 minutes |
| **Total** | **7–8 hours** |
