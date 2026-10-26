---
phase: quick-261026-tab
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/traffic-dashboard.tsx
  - src/components/traffic-dashboard.test.tsx
autonomous: true
requirements: [TAB-01, TAB-02, TAB-03]
must_haves:
  truths:
    - "Only the selected dashboard tab content is mounted and visible"
    - "A successful search opens the overview tab while preserving the fetched report across tab changes"
    - "Existing on-demand panels remain reachable and do not request data before their tab is selected"
---

<objective>
Replace the long scrolling multi-section report with true single-panel tab navigation.

Purpose: let researchers focus on one report area at a time without scrolling through unrelated sections.
Output: accessible tab controls, conditional section rendering, automatic overview selection after search, and updated regression coverage.
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Convert dashboard navigation into controlled tabs</name>
  <files>src/components/traffic-dashboard.tsx</files>
  <action>
Use button-based tab semantics for desktop and mobile navigation. Keep the search workspace as one tab and conditionally mount only the selected report section. Remove scroll-observer behavior and switch to the overview tab after a successful search. Preserve all API contracts and report data state.
  </action>
  <verify>
    <automated>npm.cmd test -- src/components/traffic-dashboard.test.tsx</automated>
  </verify>
</task>

<task type="auto">
  <name>Task 2: Update tab-focused regression tests and quality gates</name>
  <files>src/components/traffic-dashboard.test.tsx</files>
  <action>
Update existing workflows to select the relevant tab before asserting its panels. Verify inactive tab content is absent and on-demand requests are not triggered before tab selection. Run the full test, lint, and build gates.
  </action>
  <verify>
    <automated>npm.cmd test &amp;&amp; npm.cmd run lint &amp;&amp; npm.cmd run build</automated>
  </verify>
</task>

</tasks>

<success_criteria>
Only one dashboard area renders at a time, navigation remains responsive and accessible, and all existing workflows pass their tests.
</success_criteria>

<output>
Create `.planning/quick/261026-tab-single-panel-navigation/261026-tab-SUMMARY.md` when done.
</output>
