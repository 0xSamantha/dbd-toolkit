# Results and importing match data

The tracker displays total matches, wins, losses, draws, surrenders, win rate, survivor escape rate and average known killer kills before the entry form. The advanced section contains results by role, a killer kill distribution, character results and perk usage with sample sizes.

Reporting conventions are explicit app choices:

- Survivor: Escaped = win; Died or Surrendered = loss; Draw is a manual result.
- Killer: 0–1 kills = loss; 2 = draw; 3–4 = win. Draw and Surrendered can also be selected without a kill count.
- Surrenders are included in losses and separately counted as a subset. Do not add the surrender counter to losses again.
- Win rate is wins divided by all matches, including draws. Survivor escape rate includes all survivor results in its denominator. Unknown kill counts are excluded from kill averages/distributions.
- Observed builds never count as played matches. Perk analysis includes only matches where perks were recorded; it does not establish causal perk effectiveness.

**Existing Supabase projects:** run `supabase-match-results.sql` once in SQL Editor to allow the new result strings. It replaces the validation function without deleting matches or changing ownership policies. New projects can use the updated full `supabase-schema.sql`.

JSON file uploads accept an array of match objects, one match object, or an object containing a `matches` array. Files must be under 5 MB with at most 5,000 rows. All records are validated before preview, and the user confirms before they are merged into the current history. Repeated IDs update those records; other history is retained. Export continues to produce the compatible match array.

A match has `id` (positive safe integer), `date` (YYYY-MM-DD), `role` (S/K), `character`, `result`, `perks` (up to four names), and `notes` (up to 300 characters). Survivor results are Escaped, Died, Draw or Surrendered; killer results are numeric 0–4, Draw or Surrendered. Existing records remain compatible.

Screenshot recognition is not implemented. A future importer can locate perk slots and compare icon crops against the perk catalog, return candidate matches and confidence, and let the user correct the draft before saving. OCR would help extract text, but icon recognition is a separate step. Cropping, platform UI scale, overlays and image quality require testing on representative screenshots. Screenshots should never silently become confirmed match records.
