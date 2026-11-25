# DBD Toolkit design system audit

The audit covers two HTML entry points, nine Toolkit views and five Hardcore modes. Prioritize control sizing, keyboard behavior and operation feedback while preserving both visual treatments.

## Inventory

### Scope and architecture

Two rendered HTML entry points. Toolkit has nine views: Build planner, Random loadout, Perks, Account, Admin, Match tracker, Observed builds, Items & add-ons and Gen calculator. Hardcore has five audit surfaces: setup, Survivor run, Killer run, shared read-only run and OBS. The two index pages redirect and retain query/hash parameters. The Toolkit loads classic scripts with shared globals and renders templates into tab sections. Hardcore has its own stylesheet, render controller, run model and portrait catalog. The repository has no standalone component library. The effective library is CSS classes, template helpers and native elements.

index.html · dbd-toolset/index.html · dbd-toolkit.html:265–375 · hardcore.html:8–24

### Toolkit palette

Desk #101113, face #252628, inset panel #191a1c, edge #494344, text #eee9e2 and muted #bdb6ae. The token named --navy is rose #e3aaa4. Blood #842e31 defines dividers, green #a9c69c indicates wins, salmon #ef9690 indicates losses and literal #e3c48d indicates draws. Timer red, perk purple and record/account accents have local literals. The Items workbench adds olive/gold surfaces and five rarity colors, each with a separate purpose.

dbd-toolkit.html:19–40, 168–248

### Hardcore palette

Warm charcoal #131311, panel #1d1c19, edge #3e3931, text #f3eee4, muted #bbb2a5, amber #f5c57f, green #aad4a7 and rust #ffab94. Amber serves navigation, focus, primary actions and active play. The roster always includes the written state. OBS uses translucent #131311ef behind the compact scoreboard.

DESIGN.md · hardcore.css:3–16, 38–51, 65–71

### Typography and spacing

VT323 is loaded independently by both pages. Toolkit uses 20px/1.25 body, 24px section headings, 16px supporting labels, 18px tooltip text and 28px stats (26px on mobile). Items uses a 42px charges display, 36px on mobile. Hardcore uses 21px/1.25 root type, a 2.7–5rem fluid hero, 2rem section headings and 2.7rem score figures. UI monospace serves Hardcore’s timer and monograms, and Georgia italic identifies Toolkit info controls. Toolkit commonly uses 6–12px gaps and 8–12px panel padding. Hardcore uses 10–16px gaps and 20px panel padding.

dbd-toolkit.html:19–78, 114–157, 192–214 · hardcore.css:13–40, 79–89

### Surfaces and controls

Toolkit uses square 1px framed cards, inset stats and fields, and raised/inset button shadows. Its centered window is 880px wide with a fixed taskbar. Hardcore uses 5px control corners, 8px panel corners, 4px portrait corners and flat borders within an 1140px roster-first shell. Its logging panel moves ahead of the roster at 700px. Primary and quiet actions both exist. Toolkit uses .btn and .btn.ghost, Hardcore uses .primary and .quiet. Items rarity tiles and Hardcore portrait tiles are bespoke interactive surfaces.

dbd-toolkit.html:26–122, 168–222 · hardcore.css:19–76

### Navigation, dialogs and dropdowns

Toolkit uses a tab grid, separate Account action and taskbar Start shortcut. The current tab is stored and written with replaceState. Hardcore uses role links with aria-current and a masthead link back. Both use native modal dialogs: Match edit and character history. Match name suggestions use a custom button list. Observed fields and Hardcore perk inputs use native datalists, with native selects elsewhere. Toolkit perk and item info share one scrollable, pinnable description layer. Native details appear in Perks, metrics, backup and logging sections.

dbd-toolkit.html:240–286, 339–373, 483–498, 785–798 · hardcore.html:17–24 · hardcore.js:44–47, 96–105

## Inconsistencies

### High · action geometry and icons

Toolkit navigation, buttons and segments are 40px minimum on desktop and 44px at narrow widths. Slot actions are 36px desktop, perk info in planner slots and grid is 44px, and observed info is only assured 36px. Item info is 36px desktop and 44px mobile. The Hardcore destination uses .btn on an inline anchor, where min-height does not apply. Hardcore Start timer is quiet while End timer is primary, and Toolkit gives both dedicated red treatment. Icon placement uses separate offsets for slots, grid, observed entries and item tiles. Verify baseline, hit area and text wrapping live.

Affected: Toolkit shell, Build planner, Random loadout, Observed builds, Items, Match tracker and Hardcore run forms. dbd-toolkit.html:83–111, 123–141, 159–161, 217–247, 271 · hardcore.js:143–165

### High · navigation and suggestions

Toolkit declares a tablist with tab buttons and aria-selected, while sections lack tabpanel relationships and no roving focus or arrow handling is wired to tabs. Match suggestions can be reached by Tab and dismissed with Escape, but expose neither expanded state nor arrow selection. Free text is accepted and should stay usable. Hardcore role links are real destinations with different saved runs and should preserve normal navigation.

Affected: all nine Toolkit views through the shell, plus character, killer and map fields on Match tracker. dbd-toolkit.html:270–281, 339–373, 483–498 · hardcore.js:7–11, 44–47

### High · pending data looks empty

On a session transition the account controller clears match and observed arrays before loading. Match tracker can render zero values and ‘Nothing logged yet’ under a loading note. Observed builds uses the same no-results copy for empty history and a filter miss and can display it while loading. Match tracker reports a successful save in a status region. Observed save redraws with no explicit completion and its error target is an ordinary paragraph.

Affected: Account, Match tracker and Observed builds. dbd-accounts.js:31–61, 167–182 · dbd-toolkit.html:654–683, 686–739 · dbd-observed.js:13–52

### Medium · feedback on destructive actions and sharing

Match history deletes immediately on activation. Observed builds requests browser confirmation before deleting. The planner reveals the share URL and attempts clipboard write without reporting completion, while Hardcore explicitly reports copied links and publish failures. The Hardcore status region sits after the full app, far from the share action on long rosters.

Affected: Match tracker, Observed builds, Build planner and both local Hardcore runs. dbd-toolkit.html:417, 683 · dbd-observed.js:37 · hardcore.html:17–19 · hardcore.js:254–270, 313–349

### Medium · metric and form rhythm

Admin uses strong inside .stat, while Toolkit’s numeric rule targets .stat b. Match and item measures therefore have stronger hierarchy than Admin totals by source. New queue comparison uses the ordinary horizontal table at mobile widths, while match history transforms to stacked rows. Toolkit form rows wrap at a 170px label basis and Account uses a 460px grid. Hardcore stacks labels and uses a two-column perk grid. Those layouts suit different tasks, but the label gap, help treatment and fieldset padding have no common contract.

Affected: Admin, Match tracker, Items, Build planner, Account, Observed builds and Hardcore setup/run forms. dbd-toolkit.html:63–74, 103–116, 146–158, 254–261 · dbd-admin.js:18–32 · hardcore.css:52–57, 79–80

### Medium · cascade and overlays

Later Toolkit declarations replace the baseline height, spacing and shadow for .btn, .slot, .grid, #tip, .stat b and .taskbar. Selected button padding differs from default, while some breakpoint rules reset it. The hover rule can override selected background. Hardcore .mark starts at 34px and is later set to 72px. Reduced motion is covered by Hardcore; Toolkit’s Items transition and Observed edit’s smooth scroll have no equivalent treatment in source. Match edit uses a 760px/90dvh dialog and Hardcore history 560px/85vh with different padding and backdrop opacity.

Affected: Toolkit shell and card consumers, Build planner, Random loadout, Observed builds, Items, Match tracker and Hardcore roster/history. dbd-toolkit.html:33–44, 83–149, 176, 240–242 · dbd-observed.js:35 · hardcore.css:38, 61–62, 78–89

## Component quality

### Action and info controls

Duplicate action styling spans Toolkit nav, .btn, slot controls, account/taskbar controls, item info and Hardcore buttons/links. Both itemInfo and perkInfo feed the same description renderer through .info and data-d. Define one action geometry contract and one icon-button recipe. Allow item tiles and roster tiles to keep their own sizing and states. This gives the same action the same hit area and focus treatment and preserves each interaction.

Reach: nine Toolkit views through the shell and Hardcore setup plus two editable runs. dbd-toolkit.html:33–44, 89–111, 217–221, 319–324 · dbd-items.js:57–64 · hardcore.css:37–54

### Cards, stats and tables

Metric tiles are composed independently in build estimates, total and advanced match metrics, streaks, Items, Admin and Hardcore. Tables in metrics, Items and Admin repeat wrappers and headers. Share Toolkit panel, metric label/value/note slots and scroll-wrapper CSS first. Promote a table template only if the same header and cell structure recurs after migration. This removes selector-specific hierarchy differences and keeps match history’s mobile rows and the OBS scoreboard adaptable.

Reach: five Toolkit views (Planner, Match tracker, Items, Admin, Observed builds for panels) and four Hardcore scoreboard modes (Survivor, Killer, shared and OBS). dbd-stats.js · dbd-metrics.js · dbd-items.js:129–173 · dbd-admin.js:18–32 · hardcore.js:173–182

### Queue and field templates

The same three queue values are handwritten in Hardcore and supplied by matchQueueFields for Toolkit log, edit and transfer. Share the option values and one fieldset template with explicit name and selected parameters. Keep local field layout and separate timer validation. Standardize label, help and error markup before considering a generic field renderer. A queue label or value then changes in one place.

Reach: five placements (Toolkit log, edit and transfer; Hardcore Survivor and Killer forms). dbd-toolkit.html:577–586, 595–611, 716–721 · hardcore.js:150–156

### Renderer responsibilities and API

drawTrack builds transfer, form, dialog, metrics, history and import controls, then restores draft state and binds events. Hardcore render builds the hero, score, roster, form and sharing and wires timer and publication handlers. Split by stable sections with pure small renderers and leave central workflow state where it is. Use named options for readOnly, selected character and history transfer permission; a positional boolean obscures intent. Replace seg(cur, fn)’s inline function-name string with a named selected role and locally bound change handler when touching callers. Smaller render scopes make keyboard focus and draft preservation easier to verify.

Reach: two main renderers and five role switchers (Planner, Random loadout, Perks, Match tracker and Observed builds). dbd-toolkit.html:375, 686–739 · dbd-observed.js:13–23 · hardcore.js:106–254

### Intentional variants

Keep VT323, Toolkit’s retro bevel, Hardcore’s warm manifest, Items rarity chrome and OBS transparency. Retain native select, datalist, disclosure and dialog behavior for their different jobs. Keep Toolkit’s edit dialog and Hardcore history dialog separate in markup, with shared shell tokens and agreed focus behavior. Using shared geometry and semantic names gives consistency while preserving visual identity and workflow differences.

Reach: two HTML shells, one themed Toolkit view, two dialogs and one overlay mode. DESIGN.md · dbd-toolkit.html:168–221, 240–242 · hardcore.css:61–71

## Interaction states

### Default, hover, focus and active

Toolkit common controls have pointer-aware hover, a rose 2px focus outline and inset active/selected fills. Slot remove, taskbar and info controls use a mixture of local selectors. Hardcore uses amber border hover and a 2px focus outline, with written states for the roster and aria-current for role links. Test focused selected controls independently from hover. Confirm Escape closes the pinned info layer and focus remains predictable when switching tabs or redrawing a section.

Source review · dbd-toolkit.html:33–39, 83–112, 217–221, 785–798 · hardcore.css:40–51, 85–87

### Disabled and locked

Toolkit uses .45 button opacity and Hardcore .55. Preset actions disable for unavailable slots or pending writes, Items disables inapplicable options and pagination bounds, and a live timer locks role/date in Toolkit or disables character in Hardcore. Hardcore disabled controls still match button:hover. Include the lock explanation next to the control and verify that selected, disabled and hovered appearances remain distinct.

Source review · dbd-toolkit.html:86, 513–546 · dbd-presets.js:31–35 · dbd-items.js:81, 168–173 · hardcore.css:43–48 · hardcore.js:136–149

### Loading and retry

Admin has a loading announcement, disabled refresh and error text. Account reports loading and busy. Hardcore shared shows loading and retries after a connection failure. Match save and Observed save disable their buttons, but only the account context indicates cloud loading. Use operation-specific inline feedback on local saves and explicit readiness for dependent content.

Source review · dbd-admin.js:18–32 · dbd-accounts.js:31–61, 228–244 · dbd-observed.js:24–29 · hardcore.js:313–389

### Error, success and empty

Match tracker mixes browser alerts with inline status and reports saved/updated, while observed failures update plain text and success redraws. Admin reports updated time and empty data lists. Import has preview/error states in Match tracker. Hardcore distinguishes invalid/unpublished run and waiting for first match. Queue breakdown distinguishes no sample from a real 0% with an em dash. Keep messages near their action and cover long text, retry and focus in the browser pass.

Source review · dbd-toolkit.html:654–739 · dbd-metrics.js:42 onward · dbd-observed.js:24–52 · dbd-admin.js:18–32 · hardcore.js:173–182, 352–389

## Token structure

### Base tokens · both shells

Start with --font-ui: VT323, monospace; --font-data: ui-monospace, monospace; --line-body: 1.25. Preserve existing body scales as theme aliases. Capture common spacing steps 4, 8, 12, 16, 20 and 24px, retaining a small 6/10px compact pair where already used. Add --stroke-default: 1px and --stroke-emphasis: 2px. This centralizes recurring measurements and limits first-pass visual drift.

Reach: both HTML shells and all 14 reviewed views/modes.

### Semantic theme aliases · both shells

Use --surface-page, --surface-panel, --surface-inset, --text-primary, --text-muted, --border-default, --accent, --focus-ring, --state-success, --state-warning and --state-danger. Map Toolkit rose and Hardcore amber to their existing accent values. Keep outcome colors separate from action colors. Add theme aliases for --radius-control (0/5px), --radius-panel (0/8px), --elevation-raised and --elevation-inset. Naming by role makes palette decisions searchable and lets both themes use the same markup.

Reach: both HTML shells and all 14 reviewed views/modes.

### Component tokens · recurring controls

Use --control-min (40px desktop, 44px narrow), --control-padding-inline (12px), --icon-target (44px), --panel-padding, --panel-gap, --metric-value-size and --dialog-backdrop. Treat these as proposed defaults, starting with action and focus tokens in one small migration. Keep compact controls explicit. Use the existing 2px focus outlines and theme-specific ring colors. Separate media layouts from visual tokens to avoid imposing one breakpoint on every task.

Reach: Toolkit shell, five editable Toolkit forms/workbenches (Planner, Match tracker, Observed builds, Items and Account), two dialogs and all three editable Hardcore modes.

### Local tokens · stateful variants

Keep --rarity scoped to inventory, an explicit timer accent within logging, and overlay surface alpha within OBS. The values communicate equipment rarity, recording state and compositing respectively. Scoping these aliases prevents unrelated buttons and panels from inheriting a gameplay-specific treatment.

Reach: Items, Match tracker, two local Hardcore run forms and OBS.

## Roadmap

### 1 · Establish a baseline, then migrate geometry

Capture the checklist fixtures first. Introduce shared CSS variables and action/field styles with existing theme values. Migrate Toolkit shell buttons and Hardcore masthead/role/form controls first, then normalize slot and icon-button geometry. Compare computed heights and keyboard focus in each migrated slice. Highest reach with incremental, easily reviewed CSS changes.

Reach: both shells, all nine Toolkit views and three editable Hardcore modes.

### 2 · Repair navigation and popover contracts

Complete tab/panel associations and arrow/home/end handling or convert the shell to destination links if back/forward should represent panel navigation. Preserve hash and URL restoration. Implement an accessible free-text suggestions pattern or explicitly keep a disclosed button list with equivalent keyboard access. Preserve native dialog and popover distinctions, add focus return on edit/history close and test Escape in layered states.

Reach: nine Toolkit views through tabs, three Match tracker fields, two dialogs and the shared item/perk info layer.

### 3 · Standardize operation feedback

Reuse a stable inline status pattern on Match tracker, Observed builds, presets and Hardcore publishing, using Admin’s pending label and refresh guard as the first example. Distinguish loading, loaded-empty and filtered-empty. Place error and success near their action and keep draft data for retry. Align confirmation for saved-record deletion after defining the intended recovery behavior. This makes the next action predictable during network failures and duplicate clicks.

Reach: Account, Match tracker, Observed builds, Planner presets, Admin reference and both local Hardcore run forms.

### 4 · Consolidate repeated markup and flatten overrides

Move the Toolkit’s inline CSS into a stylesheet in a mechanical change. Consolidate duplicate selector definitions while retaining responsive behavior. Migrate metric slots, queue fields and action variants individually, then split the two large renderers around workflow sections. Use CSS classes and existing native elements first. Each migration eliminates a recurring source of drift while keeping dependency and regression scope small.

Reach: both entry points, five Toolkit panel consumers, five queue-control placements and two main renderers.

## Regression checklist

### Responsive baselines

Capture desktop at 1440px and narrow at 320px and 390px. Exercise Toolkit boundaries at 350/351, 420/421 and 600/601px and Hardcore at 380/381, 600/601 and 700/701px. Open all nine Toolkit views and Hardcore setup, both roles, published view and transparent OBS. Include long labels, late or missing artwork, 200% zoom, font fallback and mobile safe areas. Check no page-level overflow and preserve in-container table scrolling.

Verify geometry, text wrap, hierarchy, contrast, section order and fixed taskbar overlap.

### Navigation and overlays

Use mouse, touch and keyboard to switch tabs and roles, revisit via refresh/back, open a shared build hash and enter through both redirects. Test arrows and focus rules for tabs and suggestions, selecting or retaining free text, tooltip hover/focus/tap with scroll and Escape, dialog focus containment and return to the triggering action after cancel/close. Test the info button separately from equipping.

Toolkit shell, Match tracker, Planner, Random loadout, Observed builds, Items and Hardcore history.

### Action and form states

Capture default, hover, focus, active, selected, disabled, loading, error, success and empty. Time a match through idle, running, ended, discard and reload in both role flows. Confirm role/date or character locks, data retention after failed save and one write per action. Edit and delete a disposable fixture. Try filtered-empty vs empty history, valid/invalid import and retry. Compare queue rates with tagged, untagged and zero-sample fixtures.

Match tracker, Observed builds, Items, Planner presets and both Hardcore run forms.

### Accounts, read-only and OBS

Use fixtures for guest, connecting, verified, unverified and offline. Check report loading/success/error/no-data in owner Admin. Exercise published, invalid and unpublished Hardcore links, retry/recovery, scoreboard changes and a completed roster. In OBS check alpha over light and dark game content, missing imagery and same-score parity with shared view. Test reduced motion and focus visibility across themes.

Account, Admin, dependent Toolkit views, both local runs, shared and OBS.

### Verification record

Eight existing Node suites passed. They exercise the Toolkit’s template output, calculations and account mocks, plus Hardcore’s model and transfer flows. The browser host was unavailable, so computed geometry, contrast, keyboard interaction, screenshot comparisons and live signed-in paths remain browser checklist items.

Command: node --test dbd-toolset/*.test.*
