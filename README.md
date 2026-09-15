# Rayan Tech Solution management system

A shared workspace for four partners, with a blue-and-cyan login and animated circuit-board background.

## Run locally

Use Node.js 22 or newer. Fill in the root .env file:

SUPABASE_URL=your_project_url
SUPABASE_PUBLISHABLE_KEY=your_public_publishable_key

Run npm run dev and open http://localhost:5173. Restart after changing .env. The server exposes only these two public connection settings, not the .env file. Never use a secret or service-role key.

For a static deployment, run npm run configure to generate the public browser settings. This never copies the .env file to the public folder.

## Set up Supabase

1. Run supabase/migrations/202609150001_workspace.sql once in the SQL Editor.
2. Create the four email/password accounts in Authentication → Users.
3. Replace the four email placeholders in supabase/02_approve_partners.sql, then run it.
4. Sign in with an approved account.

The migration and account setup have been tested locally with PostgreSQL. Applying them to the real Supabase project is a separate setup step. See supabase/README.md for security and accounting details.

## Included

- Dashboard: actual business cash, receipts, expenses, outstanding balances, recent activity, cash flow, project counts, reminders.
- Projects: contract ID, project/client names, online/offline type, responsible partner, start date, full contract amount, optional actual deposit, yellow ongoing and green done lists.
- Expenses: reason, amount, date and searchable history.
- Received payments: amount, date, linked contract/client, optional note.
- Remaining payments: full contract minus all actual receipts; 50% deposit target shown separately.
- Subscriptions: annual term begins on online project completion; green active, yellow one calendar month before expiry, red on expiry; renewal history.
- Partners: four named 25% cards, earned shares, paid amounts, available balances, payout history.
- Notifications: subscription and completed-project payment alerts, per-account read status, opt-in desktop alerts while open.
- Search/filter and CSV history exports, transactional saves, duplicate request protection, immutable activity history.

## Accounting rules

All amounts use AFN. Business cash = actual receipts − expenses − partner payouts. Each partner earns 25% of max(receipts − expenses, 0), rounded down to cents. That partner's previous payouts reduce the available balance. Payouts cannot exceed the partner's balance or company cash.

Project creation does not assume money was received. Check the deposit box to record an actual deposit, prefilled with 50% (rounded up to cents). Later payments can be partial and cannot exceed the outstanding contract amount. Expenses can reveal a deficit or overdistributed partner balance; the app displays it rather than hiding it.

Subscription expiry uses calendar anniversaries, clamping February 29 to February 28. Date rules use Asia/Kabul. A renewal is available one month before expiry; early renewal starts at the old expiry, late renewal starts today. Renewal does not record a fee or payment.

All four approved partners have equal access. This version does not delete or edit financial history. Sessions are held in memory and refreshed while the app is open; page reload requires sign-in. Preview is an isolated, clearly labeled in-memory sandbox; its records are never sent to Supabase and reset on exit or reload.

Desktop notifications require permission and an open app. Background push and email are not configured.

## Folder structure

dist/
  index.html
  assets/                  Brand favicon
  styles/                  Login theme and workspace styles
  src/
    app.js                 Navigation, forms, notification behavior
    config.js              Public connection settings
    components/            Brand, circuit, workspace shell, forms
    pages/                 Login and management views
    lib/                   Formatting and financial/date calculations
    services/              Authentication, database calls, isolated preview
supabase/
  migrations/              Versioned SQL migrations
  02_approve_partners.sql   Partner account allowlist setup
scripts/                   Local server, public configuration, checks and tests

## Validation

npm run check — JavaScript syntax and required assets.
npm test — local PostgreSQL migration, access control, accounting, and subscription tests.
npm run test:browser — browser workflow and responsive checks, with the local server running. Uses an installed Edge or Chrome; otherwise install Playwright Chromium.
