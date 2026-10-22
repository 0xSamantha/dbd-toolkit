# Enable your private analytics tab

Prepared for:
- Supabase user: `16a1ddb9-7ebe-4281-a3f7-494c4da72166`
- Google Analytics property: `560294101`
- Site origin: `https://dbdtoolkit.xyz`

Your verified account sees Admin after signing in. Other accounts and guests do not.
The Edge Function also verifies every caller with Supabase Auth and checks the exact user ID before returning any data. Hiding the tab is not the security boundary.
This grants access only to aggregate Google reports; it does not grant access to other people's match history. No database migration is needed.

## 1. Create a Google reporting identity

1. Open https://console.cloud.google.com/ and select or create a project.
2. Under **APIs & Services → Library**, enable **Google Analytics Data API**.
3. Under **IAM & Admin → Service Accounts**, create a service account named `dbd-analytics-reader`. No Google Cloud project role is needed just to read Analytics.
4. Copy its email address (ending in `iam.gserviceaccount.com`).
5. Open Google Analytics → Admin → **Property access management** for property 560294101.
6. Add the service-account email as a **Viewer**. Do not add it only to your Google Cloud project; access must be granted on the Analytics property.
7. In Google Cloud, open that service account → **Keys → Add key → Create new key → JSON**. Keep the downloaded file private.

Do not paste the JSON here, put it in the website, or commit it to GitHub. It contains a private key.
The measurement ID G-826YJEHMG0 is for collecting visits; this private service account is for reading reports.

## 2. Store the credential in Supabase

Open your Supabase project → **Edge Functions → Secrets**.

Add a secret named `GOOGLE_SERVICE_ACCOUNT_JSON`. Its value is the entire contents of the downloaded Google JSON file, including braces. Supabase also supplies SUPABASE_URL and SUPABASE_ANON_KEY to Edge Functions automatically.

The function defaults to allowing browser requests from https://dbdtoolkit.xyz.
For a separate staging deployment, set ADMIN_SITE_ORIGIN to that staging origin; it accepts one origin, not a URL path. Never set an unrestricted origin just to bypass a setup error.

## 3. Deploy the function

Option A — Supabase dashboard:
1. Go to **Edge Functions** and create a function called `admin-analytics` using the editor.
2. Copy `supabase/functions/admin-analytics/index.ts` into its index.ts.
3. Add a second file called `handler.mjs` using the contents of `supabase/functions/admin-analytics/handler.mjs`.
4. Deploy. Disable the gateway's legacy **Verify JWT** setting for this function if shown. Authentication remains mandatory: handler.mjs explicitly checks the bearer token using Supabase Auth before checking your user ID or reading reports. Never remove that check.

Option B — Supabase CLI, from the repository root:
```sh
supabase login
supabase link --project-ref mhkjkavvnetzupemkyon
supabase functions deploy admin-analytics
```
The repository's supabase/config.toml disables only the gateway's legacy JWT verifier; the function performs its own live Auth check. If the CLI is not installed, use the dashboard option or the official installation guide linked below.

## 4. Publish and check

1. Commit and push the website files to GitHub Pages.
2. Sign out and sign back in with your verified owner account.
3. Open **Admin**, choose 7, 30, or 90 days, then click **Load report**.
4. Test a different account and a guest: neither should see Admin. A direct API request from another user must return 403. A request without a session must return 401.
5. Change the browser's visible controls/user ID if testing security: that must never authorize the backend.

Reports cover complete calendar days through yesterday in the Analytics property's timezone. They may be delayed, cached for five minutes, or limited by Google privacy thresholds. Counts are estimates affected by consent and blockers; regional/daily visitor counts must not be summed as period-unique totals. An empty report shortly after installation is normal; earlier traffic cannot be reconstructed.

If Load report fails:
- 401: sign out/in; check function authentication settings.
- 403: use the verified owner account and the correct domain.
- 502: check GOOGLE_SERVICE_ACCOUNT_JSON, enabled Data API, and Viewer access on property 560294101.
- Deployment error: ensure BOTH function files exist, and inspect Supabase function logs. Do not log credentials or session tokens.

The standard GA4 reporting API and Supabase free tier have quotas. This setup does not enable billing or purchase a paid plan.

References:
- Google service-account quickstart: https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart
- Google metrics and dimensions: https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema
- Supabase getUser validation: https://supabase.com/docs/reference/javascript/auth-getuser
- Supabase CLI installation: https://supabase.com/docs/guides/local-development/cli/getting-started
