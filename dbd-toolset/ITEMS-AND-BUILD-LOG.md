# Observed builds and item comparisons

## Observed Builds

Record the date, survivor/killer role, optional player label and character, up to four different perks, and notes. Unknown perks can be left empty. Search old entries by player, character, perk or notes; filter by role; edit, delete or explicitly open an entry in the planner. Opening a build in the planner does not log a match.

Observed entries are entirely separate from own match history and most-used-perk statistics. Guest and signed-in histories are separate. Export/import uses its own JSON format and merges entries by ID. For existing accounts, apply `supabase-observed-builds.sql` in Supabase; see `ACCOUNTS-SETUP.md`. If the migration is missing, the build log reports the cloud error without disabling own match history or silently writing account data into the guest log.

## Items & Add-ons

Data: [dbd.source.gs 10.2.0 item snapshot](https://dbd.source.gs/items/), build 10.2.0-3840818. Contains 8 med-kits, 10 toolboxes, 14 med-kit add-ons and 11 toolbox add-ons, including event variants. Zero, one and two distinct add-ons yield 848 med-kit combinations and 670 toolbox combinations. Search and sort the full list; 25 rows are shown per page. Pin a setup to compare it alongside another under the same current conditions.

Estimates distinguish active speed from item capacity:

- A toolbox's charge capacity is progress, not seconds of use. Generator time includes a fast item phase and a bare-handed phase after depletion. Results show total charges, active repair rate, time until depletion, full generator time, time saved, item/add-on sabotage bonus and available full sabotages. Brand New Part charge reduction is conditional on successful installation; installation time is excluded.
- Med-kit altruistic speed and self-healing penalties are separate. Results show time per heal, charges per heal, partial health states available and complete heals. Self-healing assumes an injured survivor; Broken blocks it. The displayed 33% self-healing speed/efficiency penalties use the conventional exact two-thirds factor. Styptic Agent's snapshot effect improves self-healing efficiency, rather than applying its old Endurance effect.
- Optional planner integration uses the current survivor perks, tier and activation conditions, with solo repair assumptions. Perk/item base modifiers use the common Diminishing Returns model; add-on speed bonuses are exempt. Altruistic-only perks do not accelerate self-healing, and Circle of Healing's no-med-kit bonus is excluded.

All items and compatible add-on pairs are selectable, but these are steady-use estimates, not complete game simulations. Skill-check probability/progression, killer debuffs, recharge perks, interrupted actions, mending and consumable status-effect duration are not simulated. Descriptions and caveats remain visible for these effects. Activating a consuming add-on explicitly sets usable med-kit charges to zero; it is never treated as a permanent speed boost. No assumption of automatic Great Skill Checks is made.

To regenerate item data from a saved source page:

```sh
python3 tools/import-items.py /path/to/items.html
```

Checks:

```sh
node dbd-stats.test.cjs
node dbd-accounts.test.cjs
node dbd-items.test.cjs
```

Account tests use a mock SDK and cannot prove live database policies or email delivery; verify the migration with two real test users in your own project.
