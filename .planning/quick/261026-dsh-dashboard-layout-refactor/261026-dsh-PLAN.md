---
phase: quick-261026-dsh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/traffic-dashboard.tsx
  - src/components/panel.tsx
  - src/app/globals.css
  - src/components/traffic-dashboard.test.tsx
autonomous: true
requirements: [UI-01, UI-02, UI-03, UI-04]
must_haves:
  truths:
    - "The single-page report uses a persistent desktop sidebar and compact mobile navigation while retaining the existing brutalist palette, typography, borders, shadows, and interactions"
    - "Search remains the primary workflow and all existing traffic, ads, referral, SE Ranking, Trustpilot, and WHOIS sections remain available without API or state-flow changes"
    - "Report content is grouped into scan-friendly dashboard sections with stable anchors and responsive grids from mobile through 1920px displays"
    - "Keyboard focus, semantic landmarks, loading/error states, dialogs, and responsive tables continue to work"
  artifacts:
    - path: "src/components/traffic-dashboard.tsx"
      provides: "Dashboard shell, sidebar/navigation, compact header/search workflow, and reorganized report composition"
    - path: "src/components/panel.tsx"
      provides: "Reusable panel primitives aligned to the dashboard density"
    - path: "src/app/globals.css"
      provides: "Responsive dashboard layout helpers and preserved visual tokens"
---

<objective>
Refactor the existing single-page frontend into a production-grade dashboard layout without changing its brutalist visual identity or business behavior.

Purpose: improve information architecture, scanability, content density, responsiveness, and navigation across a long multi-source intelligence report.
Output: a persistent desktop dashboard shell, compact mobile navigation, anchored report sections, refined grid composition, and regression coverage.
</objective>

<context>
@AGENTS.md
@src/components/traffic-dashboard.tsx
@src/components/panel.tsx
@src/app/globals.css
@src/components/traffic-dashboard.test.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Establish the dashboard shell and navigation architecture</name>
  <files>src/components/traffic-dashboard.tsx, src/app/globals.css</files>
  <action>
Add a semantic application shell with a persistent sidebar at desktop widths, a compact mobile top/navigation region, clear active report navigation, and a structured main header. Reuse the existing palette, type treatments, hard borders, offset shadows, focus styles, and interactions. Keep the domain search form and examples fully functional; do not add routes, fake metrics, dependencies, or API calls.
  </action>
  <verify>
    <automated>npm.cmd test -- src/components/traffic-dashboard.test.tsx</automated>
  </verify>
</task>

<task type="auto">
  <name>Task 2: Recompose report content into dashboard sections</name>
  <files>src/components/traffic-dashboard.tsx, src/components/panel.tsx, src/app/globals.css</files>
  <action>
Group existing report panels into anchored overview, acquisition, market/SEO, advertising, reputation, and domain sections. Improve content width, card density, grid spans, section headings, and responsive stacking while preserving every existing component, data flow, label, loading state, error state, modal, button, and on-demand request behavior. Refine reusable Panel and MetricCard structure only where it improves consistency without changing their visual language.
  </action>
  <verify>
    <automated>npm.cmd test</automated>
  </verify>
</task>

<task type="auto">
  <name>Task 3: Add regression coverage and complete visual/quality verification</name>
  <files>src/components/traffic-dashboard.test.tsx</files>
  <action>
Add focused tests for the new navigation landmarks and report anchors. Run lint, TypeScript/build, and the full test suite. Start the local app and visually inspect desktop, laptop/tablet, and mobile layouts with Windows browser automation; correct overflow, spacing, hierarchy, or interaction regressions found during inspection.
  </action>
  <verify>
    <automated>npm.cmd test &amp;&amp; npm.cmd run lint &amp;&amp; npm.cmd run build</automated>
  </verify>
</task>

</tasks>

<verification>
Full Vitest suite, ESLint, Next.js production build, and browser visual QA at representative desktop/tablet/mobile widths.
</verification>

<success_criteria>
The application reads as a cohesive dashboard, is materially easier to navigate and scan, retains the original visual identity and behavior, and passes all automated and visual checks.
</success_criteria>

<output>
Create `.planning/quick/261026-dsh-dashboard-layout-refactor/261026-dsh-SUMMARY.md` when done.
</output>
