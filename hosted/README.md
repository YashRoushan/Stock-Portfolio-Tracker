# Hosted Stock Portfolio Tracker

This deployment runs the existing React interface and shared average-cost calculations with a Cloudflare Worker API and a persistent D1 SQLite database.

The Node.js/Express/Prisma/PostgreSQL implementation remains available through the original backend and Docker Compose setup. The shared calculation module uses structural TypeScript types so both backends execute the same accounting logic.

## Run the hosted build locally

Use Node.js 22.13 or later from the repository root.

```sh
npm ci
npm run build
npm run check
npm test
npm run dev
```

The local server applies the committed SQL migrations once to its own development database. It generates an ephemeral signing key. Local sessions must be restarted after the server restarts.

## Public demo behaviour

- Try the demo creates an isolated guest account and a seeded portfolio in the database.
- Guest workspaces expire after seven days and are remembered in the browser until sign-out. New visitors receive independent workspaces.
- Fixed sample prices cover AAPL, MSFT, VTI, GOOGL and NVDA in USD. They are explicitly labelled illustrative.
- [Market Quotes](https://yash-stock-portfolio-tracker.yashroushan.chatgpt.site/market) displays delayed market quotes for the same symbols using TradingView’s branded widget. The widget uses no API key and runs in a sandboxed frame. Its quotes are separate from the portfolio calculation feed.
- Visitors can create portfolios and enter buy/sell transactions and manual dividends. The server persists records and recalculates holdings, average cost, realised/unrealised profit/loss, allocation and the cost-basis history.
- Unknown tickers remain valid transaction records. The interface marks unavailable valuations.
- Registration and sign-in use signed, expiring JWTs and bcrypt password hashes. Every data request checks account ownership.
- Atomic inventory checks reject overselling, including concurrent and backdated sales.
- The public service limits authentication attempts and the number of records in a workspace.

## Build and storage

`hosted/src/worker.ts` serves the compiled interface and API from one origin. `hosted/src/api.ts` implements the original API contract. `backend/src/services/portfolio.ts` contains the shared calculations.

`npm run build` creates `dist/server/index.js` with the frontend assets embedded in the Worker. Generated frontend bundles stay out of version control.

`.openai/hosting.json` identifies the managed Sites deployment and declares its `DB` binding. Configure `JWT_SECRET` as a hosting secret of at least 32 characters. Keep production secrets out of Git.

## Enable end-of-day valuations

Obtain a [Tiingo subscription with public display rights](https://www.tiingo.com/products/end-of-day-stock-price-data) for this public app. A personal token alone does not grant redistribution rights. In the hosting environment, set `STOCK_PRICE_PROVIDER=tiingo` and add `TIINGO_API_TOKEN` as a secret, then deploy the saved version. The token stays on the server and is sent only in the authentication header to Tiingo.

The API uses the two latest unadjusted daily closes in USD and displays the quote date. A shared D1 cache limits refresh attempts to one per supported symbol every six hours. Failed requests use any usable dated close already in the cache. With no usable quote, the UI marks the valuation unavailable. The public demo uses labelled sample valuations until the licensed feed is configured.

The schema lives in `hosted/src/schema.ts`. For future schema changes, run `npm run db:generate`, review and commit the new SQL and journal files in `drizzle/`. Existing applied migrations are immutable. The managed publishing workflow applies new migrations before deploying the Worker.

The GitHub verification workflow runs the production build, type checks and regression tests. Publish reviewed source through the connected Sites deployment workflow, then verify `/api/health` and the browser before updating portfolio links.

## Verification

Regression tests cover isolated visitor workspaces, ownership checks, persistent trades and dividends, average-cost calculations, fractional quantities, concurrent/backdated sell rejection, registration/login, authentication limits and cross-origin write rejection.
