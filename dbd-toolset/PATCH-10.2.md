# Patch 10.2.0 data

The toolkit is pinned to **10.2.0**, build **10.2.0-3840818**, extracted **2026-10-07**. This snapshot does not include later 10.2.1/10.2.2 changes.

- [Perk descriptions, icons and tier text](https://dbd.source.gs/perks/): 321 perks (176 survivor, 145 killer).
- [Snapshot version and character roster](https://dbd.source.gs/): 44 killers.
- [Official live 10.2.0 changes](https://bugreport.deadbydaylight.com/projects/pr-5642738318/releases/6012).
- [Official live Diminishing Returns rules](https://forums.bhvr.com/dead-by-daylight/kb/articles/544-9-6-0-patch-notes).

`perks.txt` and `dbd-perks.js` contain the same dataset, including source links, build metadata and each perk's tier text. The importer preserves “Déjà Vu” and “We'll Make It” spelling for existing builds. Search ignores accents and capitalization.

The speed engine has explicit rules for 52 perks. Both planner and generator calculator use that engine. Effects outside its supported set remain labeled **Not modeled**; importing a description does not automatically simulate every game mechanic. Conditions are snapshots, not a simulation of an entire match. Team repair estimates assume everyone repairing receives the selected team buffs; teammates' own perks are excluded.

Repeated modifiers are ranked by magnitude and weighted at 100%, 50%, 25%, 12.5%, then 5%. Token bonuses from one perk are grouped as one source. Positive action bonuses and negative speed penalties are handled separately; penalties multiply action speed. Add-ons, skill checks, toolboxes, killer powers and enemy debuffs are outside the current model.

In particular, Machine Learning uses the live **8%** Haste, not the PTB's 10%. Spine Chill now models vault speed, Sole Survivor no longer models its removed repair bonus, Botany Knowledge no longer displays the old med-kit efficiency penalty, and Unrelenting includes successful basic-attack cooldown reduction.

To regenerate this exact snapshot after saving both source pages locally:

```sh
python3 tools/import-perks.py /path/to/perks.html /path/to/home.html
node dbd-stats.test.cjs
```

The importer checks the build identifier, perk counts, unique names, icons and character count before writing either dataset file. To support a future patch, review the live notes, update its version checks, and update `BUILD_EFFECTS` and the regression tests together.
