# Results and importing match data

The tracker displays total matches, wins, losses, draws, surrenders, win rate, survivor escape rate and average known killer kills before the entry form. The advanced section contains results by role, a killer kill distribution, optional match statistics, character results and perk usage with sample sizes. The separate **Statistics** tab turns the same history into core role totals, perk pick/escape cards and a character table.

Reporting conventions are explicit app choices:

- Survivor: Escaped = win; Died or Surrendered = loss; Draw is a manual result.
- Killer: 0–1 kills = loss; 2 = draw; 3–4 = win. Draw and Surrendered can also be selected without a kill count.
- Surrenders are included in losses and separately counted as a subset. Do not add the surrender counter to losses again.
- Win rate is wins divided by all matches, including draws. Survivor escape rate includes all survivor results in its denominator. Unknown kill counts are excluded from kill averages/distributions.
- Observed builds never count as played matches. Perk analysis includes only matches where perks were recorded; it does not establish causal perk effectiveness.

**Existing Supabase projects:** run `supabase-match-results.sql` once in SQL Editor to allow the new result strings. It replaces the validation function without deleting matches or changing ownership policies. New projects can use the updated full `supabase-schema.sql`.

JSON file uploads accept an array of match objects, one match object, or an object containing a `matches` array. Files must be under 5 MB with at most 5,000 rows. All records are validated before preview, and the user confirms before they are merged into the current history. Repeated IDs update those records; other history is retained. Export continues to produce the compatible match array.

A match has `id` (positive safe integer), `date` (YYYY-MM-DD), `role` (S/K), `character`, `result`, `perks` (up to four names), and `notes` (up to 300 characters). Survivor results are Escaped, Died, Draw or Surrendered; killer results are numeric 0–4, Draw or Surrendered. Existing records remain compatible.

## Statistics page

The Statistics tab reads the same history as the match tracker; there is no second store.

- Role buttons switch survivor and killer views.
- **Last 30 days** uses the local calendar date and includes today plus the previous 29 days. **All time** uses every logged match.
- **Sort by** applies to perk cards and the character table: pick rate, escape/win rate, matches or name.
- Survivor totals: matches, escapes and escape rate.
- Killer totals: matches, kills, average killer kills and win rate.
- Optional match statistics appear in **Advanced match analysis** on the Match tracker. Survivors show total and average Bloodpoints, total and average survivors healed, total and average times hooked, total chases won, longest chase and the four survivor emblems. Killers show total and average Bloodpoints, total and average hooks, total chases won, longest chase and the four killer emblems.
- Perk pick rate uses matches where a loadout was recorded. Perk escape/win rate uses only matches where that perk was recorded. Character play rate uses all role matches in the period.
- Emblem values count matches where the grade was above zero. A recorded grade of zero is still included in the average. Small samples are shown as-is and are not evidence of perk effectiveness.
- Blank statistics are skipped in totals and averages. A card shows `–` until at least one match has the relevant value.

### Optional per-match statistics

The entry form has a **Match statistics (optional)** section. It accepts whole numbers: `bloodpoints` (0–1,000,000), `healed` (survivors only, 0–99), `timesHooked` (0–99), `chasesWon` (0–999), `longestChaseMs` (0–3,600,000) and `emblems` (`benevolent`/`evader`/`lightbringer`/`unbroken` for survivors; `gatekeeper`/`devout`/`malicious`/`ruthless` for killers). Emblem grades are 0 none, 1 bronze, 2 silver, 3 gold and 4 iridescent. The form asks for the longest chase in seconds and stores milliseconds.

Statistics travel inside the existing match JSON document. Existing Supabase projects need no schema migration; `FogAccounts.validateMatch` validates the optional `stats` object on load, save and import, and older records without it remain valid.

Screenshot recognition is not implemented. A future importer can locate perk slots and compare icon crops against the perk catalog, return candidate matches and confidence, and let the user correct the draft before saving. OCR would help extract text, but icon recognition is a separate step. Cropping, platform UI scale, overlays and image quality require testing on representative screenshots. Screenshots should never silently become confirmed match records.
