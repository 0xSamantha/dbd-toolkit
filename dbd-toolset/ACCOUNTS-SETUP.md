# Connect online accounts

The Perks tab and guest logging work without a backend. Live accounts need a Supabase project and an HTTP(S)-hosted copy of this folder. Opening the HTML with `file://` is not sufficient for verification redirects.

1. Create a Supabase project. Run `supabase-schema.sql` in its SQL Editor. It creates private per-user match storage and enforces verified-email access with database policies.
2. Under Authentication, enable email/password registration and **Confirm Email**. Set the minimum password length to at least 12. Keep the confirmation email template's `{{ .ConfirmationURL }}` link.
3. Set Authentication URL Configuration's Site URL to the full URL of `dbd-toolkit.html`. Add that same URL to allowed redirect URLs. For local development, serve the folder and allow its exact localhost URL as well.
4. Configure custom SMTP for real users. Supabase's default email sender is limited to testing and is not suitable for general registrations. Configure the sender and SMTP credentials in Supabase, never in these files.
5. Fill in `dbd-auth-config.js` with the project URL, **publishable** key (or legacy anon key), and exact redirect URL. Never use a secret or service-role key in the browser.
6. Publish this folder over HTTPS. Accounts use a pinned Supabase browser SDK from jsDelivr; guest features remain available if the account service cannot load.

Passwords are sent directly to Supabase Auth; this app never writes them into match logs or localStorage. Supabase persists its session token to keep users signed in. Verification uses an email link. Each user sees only their own match rows; no public leaderboard or admin access to other people's records is provided.

Signing in loads the account's cloud history. Signing out restores the separate guest log on that browser. Copying guest matches into an account is explicit and retains the local backup. Imports merge by ID, updating matching IDs rather than deleting other history. Do not copy guest records into a second user's account unless those records belong to them.

Before inviting users, test with two accounts:

- Register; verify that cloud writes fail before confirmation. Click the email link and sign in.
- Save a match as account A; verify it is visible after signing in on another device.
- Sign in as B; verify A's matches are absent. Verify direct database API requests for A's user_id are denied by Row Level Security.
- Sign out; verify the original guest log returns. Test resend verification, expired links and a failed/offline save.

The SQL and live email flow must be tested in your project; no project credentials are included here.

References: [password authentication](https://supabase.com/docs/guides/auth/passwords), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Existing accounts: enable Observed Builds

If you already ran the original setup, run **`supabase-observed-builds.sql`** once in your project's SQL Editor. It adds a separate `observed_builds` table with the same verified-email and per-user ownership protections. It does not modify or erase your `matches` records. New installations can run the updated `supabase-schema.sql`, which includes both tables.

Guest observed builds use a separate browser backup (`fog.observedBuilds`). They are not uploaded automatically. In the Observed Builds tab, use **Copy guest build log into my account** after signing in to migrate your own entries. Each person's notes remain private to their account, even though they describe someone else's loadout. Test with two users before enabling the new cloud table for visitors.
