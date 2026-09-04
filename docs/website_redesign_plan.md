# Lululemon Guest Intelligence Dashboard — Redesign Plan

Prepared wearing three hats at once: the engineering call on what's safe to touch, the executive call on what the business actually needs, and the design call on how it should feel to use. Two open decisions from the last round are resolved below rather than left pending, so this plan is final and buildable.

## 1. Goals and audience

The site currently reads like two internal tools bolted together — a general dashboard and a separate "VP" dashboard nobody outside the nav dropdown would find. The audience is broader than that: company leadership, fashion designers making product calls, and (per the brief) customers. That means the top of the site has to work as a briefing document — state the headline story in one glance — while still giving designers and analysts a path down into the granular Reviews and Gallery views they already use today.

Non-negotiable constraint carried through this whole plan: `AnalyticsPage.jsx`, `GalleryPage.jsx`, and their component trees (`charts/`, `gallery/`) get zero code changes. Same for the data layer (`loaders.js`, `selectors.js`, JSON exports). This is a structure and visual redesign, not a data or logic change.

## 2. Decisions locked in

Two things were left open last round. Deciding them now so the plan is actionable:

**Old routes (`/vp-vision`, `/vp-vision/analytics`):** redirect to the new equivalents rather than break them. One line each in `App.jsx` via `<Navigate replace />`. Zero cost, no reason to leave dead links.

**VPAnalyticsPage's unique content:** it gets its own nav destination, not folded into the landing page. At 1,144 lines it's a real second analytics view (factory/guest-intelligence cuts that don't exist in AnalyticsPage), and cramming it into the landing hero would turn a one-glance summary into another wall of charts. Landing stays lean; the depth lives one click away.

## 3. Expert Analysis — a real gap worth closing

While reviewing the data layer for this plan, I found something worth flagging: the pipeline already computes a genuine ML/expert-analysis layer on every low-star review — semantic defect matching against your defect taxonomy (`matchedDefectCode`, `matchedDefectDesc`, `matchedDefectGroup`), a similarity/confidence score for how strong that match is (`similarityScore`, `confidenceScore`, `semanticMatchMethod`), a flag for whether the issue is operations/factory-related (`operationRelated`), and a generated business recommendation per theme (`businessInsight`). All of it is normalized and sitting in `src/data/selectors.js` right now. None of it is rendered anywhere — confirmed with a grep across every page and component: zero matches outside the selector file.

That's the "expert analysis" worth adding. It's not something to build from scratch, it's something to finally surface. Proposed treatment:

**New "Expert Analysis" section, living on the Insights page** (see IA below), with three visual pieces: a defect-taxonomy breakdown (which certified defect groups are actually driving complaints, using `officialDefectGroups` + `matchedDefectGroup` — more precise than the keyword-based complaint theme used elsewhere), a confidence/match-quality view (how many complaints were matched with high vs. low semantic confidence, so leadership can see how much of the "expert" read is high-certainty vs. inferred), and an operations-flagged callout row (`operationRelated` issues surfaced as a distinct "factory-side" list, separate from guest-preference issues).

This uses selector functions that already exist and are already written but currently unused on any page (`buildDefectCategoryDistribution`, `buildOperationAnalysisRows`, `buildPriorityReadout`, `buildRootCauseInsights`) — so this is wiring existing computation into new chart components, not new data science or new backend work.

## 4. New information architecture

Six destinations, one nav, no orphaned routes:

**Home** (`/`) — new. Executive-brief landing page. Replaces both VisionPage and VPVisionPage. Answers "what's the state of things right now" in the first screen: top KPIs, sentiment trend direction, top risk theme, and clearly labeled cards pointing into Insights, Analytics, Reviews, and Gallery.

**Insights** (`/insights`) — new destination, built from VPAnalyticsPage's existing content and logic (moved, not rewritten from scratch — the charts and data wiring already work), plus the new Expert Analysis section described above. This is the guest-to-factory intelligence depth view.

**Analytics** (`/analytics`) — unchanged, `AnalyticsPage.jsx` untouched.

**Reviews** (`/reviews`) — unchanged, `ReviewsPage.jsx` untouched, stays in nav per your call to keep it reachable.

**Gallery** (`/gallery`) — unchanged, `GalleryPage.jsx` untouched.

Removed from the live nav: the standalone "Guest-to-Factory Intelligence" link and the old `/vp-vision` naming — folded into "Insights" above.

```
/            Home (new landing)
/insights    Insights (rebuilt from VPAnalyticsPage)
/analytics   Analytics (frozen)
/reviews     Reviews (frozen)
/gallery     Gallery (frozen)
/vp-vision            → redirect to /
/vp-vision/analytics  → redirect to /insights
```

## 5. Visual design system — lululemon theme

Direction: "executive briefing," not "internal dashboard," built on the brand tokens the project already has, not new ones. Confirmed current tokens in `src/data/constants.js`: `severityPalette` (`1★ #E20010`, `2★ #737373`, `3★ #d4d4d4`), `themePalette` (a red-to-grey ramp starting at `#E20010`), `trendPalette` (`positive #1f6f3e`, `negative #E20010`, `neutral #9a9a9a`), and the brand mark at `LOGO_PATH`. This palette is correct and stays — the redesign is about density, hierarchy, and applying it more deliberately, not replacing it.

**Layout.** Home opens with a hero band — three to four KPI tiles at a size that reads from across a conference room, a one-line sentiment trend statement, and a single top-risk callout — before anything chart-heavy appears. Everything below the fold is entry cards into Insights/Analytics/Reviews/Gallery, each with a one-line description of what's inside, not just a label.

**Typography and hierarchy.** Current KPI tiles and section headers get a firmer scale — bigger numbers, quieter labels, more whitespace between sections. Applies to `KpiTile.jsx`, `SectionHeader.jsx`, `Panel.jsx` — shared primitives, so the fix propagates everywhere including the frozen pages without touching their code.

**Nav.** Collapses from today's flat five-item list (with one hidden extra) to the six real destinations above, in that order. Product-style selector gets restyled to look like a control, not a form input — same component (`ProductStyleSelect.jsx`), visual pass only.

**Color/branding — lululemon-specific direction.** Primary accent stays `#E20010` (lululemon red), used sparingly for the single most important number or alert on a screen — not on every chart, so it keeps its weight. Base palette stays black/white/greyscale (`#1a1a1a` through `#d9d9d9`, already defined in `themePalette`), consistent with the brand's minimal aesthetic — no new brand colors introduced. Positive/negative trend language uses the existing `trendPalette` (green for improving sentiment, red for declining) rather than inventing a new semantic color set. Logo placement in the header stays circular-badge style as it is today; the new Home hero can use the logo mark at larger scale once, not repeated. Charts on the new Expert Analysis section reuse `severityPalette`/`themePalette` rather than introducing a fourth palette, so the whole site — old pages and new — reads as one consistent brand system rather than a patchwork.

**What doesn't get touched visually:** internals of Analytics, Reviews, and Gallery pages. They'll inherit the shared-primitive polish (KpiTile, Panel, SectionHeader, Header, Footer) automatically since those are shared components, so they'll feel consistent with the new shell without any direct edits to those three page files.

## 6. Technical / component plan

| Area | Action |
|---|---|
| `src/pages/HomePage.jsx` | New file. Replaces VisionPage as the `/` route. Built from VisionPage + VPVisionPage's best content (KPI tiles, sentiment trend, top risk theme), rewritten as a lean overview, not a merge of both files' full content. |
| `src/pages/InsightsPage.jsx` | New file, ported from `VPAnalyticsPage.jsx`. Content and data logic carried over as-is; only the shell/wrapper markup adjusts to match new layout primitives. |
| `src/components/insights/ExpertAnalysisPanel.jsx` (new) | New component rendering the defect-taxonomy breakdown, confidence/match-quality view, and operations-flagged callout row on the Insights page, wired to the already-existing `buildDefectCategoryDistribution`, `buildOperationAnalysisRows`, `buildPriorityReadout` selectors. |
| `src/pages/AnalyticsPage.jsx`, `ReviewsPage.jsx`, `GalleryPage.jsx` | Untouched. |
| `src/pages/VisionPage.jsx`, `VPVisionPage.jsx`, `VPAnalyticsPage.jsx` | Deleted after HomePage/InsightsPage are built and verified — content is superseded, not duplicated indefinitely. |
| `src/App.jsx` | Route table updated to the 5-destination structure above, plus 2 redirect routes. |
| `src/data/constants.js` (`navRoutes`) | Updated to 5 entries: Home, Insights, Analytics, Reviews, Gallery. |
| `src/components/layout/Header.jsx`, `MobileNav.jsx`, `Footer.jsx` | Visual pass: spacing, nav item set, hero-aware header behavior on Home. |
| `src/layouts/DashboardLayout.jsx` | Minor: accommodate a full-width hero band on Home vs. the standard padded container on other pages. |
| `src/components/primitives/{KpiTile,Panel,SectionHeader}.jsx` | Visual scale/spacing pass — shared, so it lifts every page including the frozen ones for free. |
| Data layer (`loaders.js`, `selectors.js`, `data/*`) | No changes. |

Nothing here touches the backend, the Postgres migration just completed, or the pipeline. This is purely `src/` frontend work.

## 7. Phased rollout

**Phase 1 — Shell.** Header, MobileNav, Footer, DashboardLayout, and the three shared primitives (KpiTile, Panel, SectionHeader) get the visual pass first, using the lululemon token set confirmed in section 5. Low risk, immediately visible, and every downstream page benefits automatically. Verify: existing pages (Analytics/Reviews/Gallery) still render correctly with only cosmetic shifts.

**Phase 2 — Home.** Build `HomePage.jsx`. Verify against real dashboard data (not placeholder) so the KPI/trend/risk callouts are accurate on day one.

**Phase 3 — Insights + Expert Analysis.** Port `VPAnalyticsPage.jsx` content into `InsightsPage.jsx`, then build `ExpertAnalysisPanel.jsx` on top of it using the existing `buildDefectCategoryDistribution`/`buildOperationAnalysisRows`/`buildPriorityReadout` selectors. Verify chart-by-chart against the current VP Analytics page to confirm nothing was dropped in the move, and spot-check the new Expert Analysis numbers against a manual read of a sample of `matchedDefectGroup`/`confidenceScore` rows in the source data.

**Phase 4 — Rewire routes and nav.** Update `App.jsx` and `navRoutes`, add the two redirects, remove old files. Verify: every nav link resolves, old bookmarked URLs redirect correctly, no 404s via `*` catch-all.

**Phase 5 — Cross-page consistency pass.** With everything live, do one pass across all six pages together (side by side) to confirm the frozen pages feel visually consistent with the new shell, and fix any spacing seams at the boundary between new shared primitives and old page-specific layout code.

## 8. Verification plan

Before calling this done: `npm run build` succeeds with no errors; manual click-through of all 6 nav destinations plus both redirect routes; visual diff check that Analytics/Reviews/Gallery page *content* is byte-identical to before (only surrounding chrome changed); mobile nav tested at narrow width; confirm no console errors from removed route references anywhere else in the codebase (search for any remaining imports of `VisionPage`, `VPVisionPage`, `VPAnalyticsPage` before deleting those files); confirm Expert Analysis numbers reconcile against raw `matchedDefectGroup`/`confidenceScore` values in `public/data/dashboard_data/reviews.json`.

## 9. Out of scope

No backend changes, no data/pipeline changes, no changes to existing chart logic or data calculations, no new data sources or new ML models — Expert Analysis surfaces data the pipeline already computes. This plan is IA + shell/visual redesign plus one new panel built on existing selectors.

## 10. Open items for sign-off

Confirm before Phase 2 starts: what should the Home page's exact KPI set be (reuse VisionPage's four tiles, VPVisionPage's, or a new combined set)? Should "Insights" be the final nav label, or is there a preferred customer/exec-facing name for that section? And for Expert Analysis specifically — should it appear only on Insights, or does it warrant a summary card on Home too (e.g. "X% of complaints are operations-related" as a headline stat)?
