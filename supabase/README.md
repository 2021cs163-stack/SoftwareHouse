# Supabase setup

1. Open your Supabase project → SQL Editor → New query.
2. Run `migrations/202609150001_workspace.sql` once, then `migrations/202609150002_project_details_investments.sql`. For an existing database, run only the unapplied new migration.
3. Create ONE login account in Authentication > Users (email/password).
4. Replace `YOUR_LOGIN_EMAIL` in `03_single_user_access.sql`, then run it. Do not run the old four-partner approval script.
5. Put your project URL and public publishable key in the root `.env`, restart `npm run dev`, and sign in.

The first script creates a dedicated private schema and three authenticated RPCs. It does not change existing application tables. Keep this applied migration immutable; later schema changes should be new migration files.

Only the selected administrator account can access company records. The four partners remain financial records and do not need accounts. The single-user setup revokes previous accounts' access without deleting records or Auth users, and enforces at most one active login. Other signed-in users and anonymous users cannot read or change company data. Do not add the private schema to Supabase's exposed schemas. Never put a service-role key in the frontend.

Amounts use AFN with two decimal places. Received payments are recorded explicitly; a project does not automatically create cash. Enter the paid and remaining amounts yourself in the project form. The contract total is their sum; paid money creates one receipt. Existing project balances are preserved. Every mutation is transactional and has a request ID to prevent a retried save from being counted twice. Concurrent receipts and partner payouts are serialized and checked in the database.

Partner entitlement = 25% of max(receipts minus expenses, 0), rounded down to cents. Previous payouts reduce that partner's available balance. Business cash = receipts plus partner investments minus expenses minus all partner payouts. Investments are capital and do not increase profit shares. An expense can reveal a deficit or a partner overdistribution; the app shows the real negative balance rather than hiding it. Cash reserve for future spending is not automatically withheld.

Online project completion starts the first subscription term, expiring on its calendar anniversary. Renewal is available one calendar month before expiry. Early renewal starts at the previous expiry; late renewal starts today. Terms are retained in history. Leap-day anniversaries clamp to February 28. All date-based rules use Asia/Kabul. Subscription renewal records the service term only, not a payment or fee.

In-app alerts recalculate on load and every minute while the app is open. Read state is saved per user. Optional desktop notifications require browser permission and an open app. Closed-browser push/email delivery is not configured.

Source references: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [API security](https://supabase.com/docs/guides/api/securing-your-api).
