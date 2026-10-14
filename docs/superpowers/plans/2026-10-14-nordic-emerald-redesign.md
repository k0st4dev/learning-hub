# Nordic Emerald & Slate Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the learning platform UI into an expansive, airy, developer-grade environment with a dedicated left sidebar, fluid wide canvas, and a Nordic Emerald & Slate dark visual identity.

**Architecture:** Implement a responsive two-column layout in `StudentShell` (desktop sidebar + mobile dialog drawer) for authenticated pages, while keeping public auth pages centered and distraction-free. Upgrade design tokens and CSS utility classes in `globals.css` to remove cramped constraints (`1120px` width, `22ch` headings) and introduce emerald/mint accents while strictly maintaining WCAG AA contrast and Playwright test assertions.

**Tech Stack:** Next.js 16.3 (App Router), React 19, Tailwind CSS 4, Playwright E2E.

**Spec:** [docs/superpowers/specs/2026-10-14-nordic-emerald-redesign-design.md](file:///home/kst/Documents/learnDev/learning-hub/docs/superpowers/specs/2026-10-14-nordic-emerald-redesign-design.md)

## Global Constraints

- `--background` must evaluate to `rgb(11, 18, 32)` (`#0b1220`) in dark mode to strictly satisfy `tests/e2e/theme.spec.ts:77,181,425`.
- `--surface` on `.site-header` must evaluate to `rgb(17, 24, 39)` (`#111827`) in dark mode to strictly satisfy `tests/e2e/theme.spec.ts:89,198`.
- Light mode tokens (`#f8fafc`, `#1d4ed8`, `#0f172a`) must remain completely functional and intact.
- Mobile viewports (320px–360px) must reflow cleanly without introducing a horizontal page scrollbar (conforming to §201 audits).
- Keyboard Tab order must start with the skip link `#main` (conforming to §204 audits).
- Mobile navigation dialog drawer must trap focus, close on Escape, and restore focus to trigger button (conforming to §207 audits).
- All 107 existing Playwright tests must pass (`npx playwright test --reporter=list`).

## Review Focus

1. Mobile viewport (320px) sidebar drawer reflow: ensure drawer does not cause body horizontal overflow (`overflow-x: hidden`).
2. Keyboard Tab navigation: ensure the `#main` skip link skips the desktop sidebar directly to main content.
3. Contrast ratio of emerald and mint text on dark slate surfaces: ensure minimum 4.5:1 ratio for all readable text.
4. Unauthenticated public pages (`/login`, `/register`, `/`): ensure they remain single-column centered without rendering student sidebar artifacts.
5. Quick search shortcut `Ctrl+K`: ensure pressing `Ctrl+K` inside an input field does not prevent default typing unless intended.

---

### Task 1: Design Tokens & CSS Typography Expansion in `src/app/globals.css`

**Files:**
- Modify: `src/app/globals.css:147-270`
- Test: `tests/e2e/theme.spec.ts`

**Interfaces:**
- Produces: CSS custom properties `--emerald-500`, `--emerald-400`, `--slate-850`, `--border-emerald`, updated `.page-shell` max-width, removed `max-width: 22ch` from `h1`.

- [ ] **Step 1: Check existing theme tests pass before modifications**

Run: `npx playwright test tests/e2e/theme.spec.ts --reporter=list`
Expected: PASS (all theme tests passing)

- [ ] **Step 2: Update `src/app/globals.css` with Nordic Emerald tokens & spacious layout classes**

In `src/app/globals.css`:
- Add Nordic Emerald tokens to `:root` / dark mode:
  ```css
  --emerald-500: #10b981;
  --emerald-400: #34d399;
  --emerald-600: #059669;
  --surface-elevated: #162a2d;
  --border-emerald: rgba(16, 185, 129, 0.2);
  ```
- Update `.page-shell`: change `max-width: 1120px` to `max-width: 1440px`, with padding `32px` on desktop and `16px` on mobile (≤640px). Keep `.page-shell.narrow` at `max-width: 480px` for auth forms.
- Update `h1`: remove `max-width: 22ch` to allow headings to breathe on wider screens.
- Update `.card`: adjust `border-radius: 14px`, background `var(--surface)`, border `1px solid var(--border)` with subtle transition on hover.
- Update `.button` / primary buttons to support emerald accent styling.

- [ ] **Step 3: Run theme tests to verify token compatibility**

Run: `npx playwright test tests/e2e/theme.spec.ts --reporter=list`
Expected: PASS (verifying background, text color, header bg, and axe a11y contrast checks)

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add Nordic Emerald design tokens and expand page-shell width"
```

---

### Task 2: Modern Left Sidebar Navigation in `StudentShell` & `StudentNavigation`

**Files:**
- Modify: `src/components/student-navigation.tsx`
- Modify: `src/components/student-shell.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/e2e/authenticated.spec.ts`, `tests/e2e/keyboard-focus.spec.ts`

**Interfaces:**
- Consumes: `StudentNavigation` props `{ name: string, fullCourse: boolean }`
- Produces: Two-column student shell layout (desktop fixed sidebar + main canvas; mobile drawer)

- [ ] **Step 1: Update `src/components/student-navigation.tsx` to render rich sidebar navigation**

In `src/components/student-navigation.tsx`:
- Desktop nav: render vertical sidebar navigation `<nav aria-label="Student" className="student-sidebar-nav">` with brand icon (`🌿 LearningHub`), module label, navigation items with semantic icons (`⚡ Dashboard`, `📚 Kurikulum`, `📈 Napredak`, `📖 Resursi`, `🔍 Pretraga`, `⚙️ Podešavanja`), active state indicator (`border-l-3` emerald accent), and student profile badge at bottom with status indicator.
- Mobile nav: retain accessible `<dialog ref={dialog} id={id}>` drawer triggered by mobile menu button with `aria-haspopup="dialog"`, preserving keyboard focus trap and Escape key dismiss behavior.
- Retain existing links and routes (`/dashboard`, `/course/software-engineer`, `/course/software-engineer/progress`, `/resources`, `/search`, `/settings`, and `<Logout />`).

- [ ] **Step 2: Update `src/components/student-shell.tsx` for two-column workspace grid**

In `src/components/student-shell.tsx`:
- Wrap student workspace in `<div className="student-workspace-layout">`.
- Render `<StudentNavigation>` as left column on desktop (≥1024px, width 240px).
- Render `<div className="student-workspace-content">` containing `children` with full width and responsive overflow control.

- [ ] **Step 3: Add sidebar CSS layout rules to `src/app/globals.css`**

- Desktop (≥1024px): `.student-workspace-layout { display: flex; min-height: 100vh; }` with `.student-sidebar-nav { width: 240px; flex-shrink: 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; background: #0e1a1d; border-right: 1px solid var(--border); padding: 24px 16px; }`.
- Mobile (<1024px): `.student-sidebar-nav { display: none; }`, `.student-mobile-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--surface); border-bottom: 1px solid var(--border); }`.
- Ensure `#main` receives focus properly when skip link is clicked.

- [ ] **Step 4: Run authenticated & keyboard navigation tests**

Run: `npx playwright test tests/e2e/authenticated.spec.ts tests/e2e/keyboard-focus.spec.ts --reporter=list`
Expected: PASS (verifying skip link, dialog focus trap, and authenticated routes reflow)

- [ ] **Step 5: Commit**

```bash
git add src/components/student-navigation.tsx src/components/student-shell.tsx src/app/globals.css
git commit -m "feat(ui): implement modern Nordic Emerald left sidebar for student workspace"
```

---

### Task 3: Top Utility Bar & Global Search Shortcut (`Ctrl+K`)

**Files:**
- Create: `src/components/top-utility-bar.tsx`
- Modify: `src/components/student-shell.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/e2e/authenticated.spec.ts`

**Interfaces:**
- Produces: `<TopUtilityBar>` component with breadcrumbs, live local sync pill, and `Ctrl+K` shortcut listener.

- [ ] **Step 1: Create `src/components/top-utility-bar.tsx`**

Implement `TopUtilityBar`:
- Hook: listen for `keydown` event on `window`. If `(event.ctrlKey || event.metaKey) && event.key === 'k'`, prevent default and call `router.push('/search')`.
- Render breadcrumb slot or current section title.
- Render live status pill: "🟢 Lokalna baza" / "Lokalno učenje".
- Render search button trigger: `🔍 Pretraga (Ctrl+K)`.

- [ ] **Step 2: Integrate `TopUtilityBar` into `src/components/student-shell.tsx`**

Render `<TopUtilityBar />` at the top of `.student-workspace-content`.

- [ ] **Step 3: Run authenticated Playwright tests**

Run: `npx playwright test tests/e2e/authenticated.spec.ts --reporter=list`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/top-utility-bar.tsx src/components/student-shell.tsx src/app/globals.css
git commit -m "feat(ui): add top utility bar with Ctrl+K shortcut and sync status badge"
```

---

### Task 4: Dashboard Modernization & Spacious 3-Column Metrics Grid

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/components/progress-overview.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/e2e/authenticated.spec.ts`, `tests/e2e/reflow-tables.spec.ts`

**Interfaces:**
- Consumes: Existing student course state, progress summary, and enrollment data
- Produces: Modern hero "Active Task" card with prominent CTA, and a spacious 3-column metric card grid

- [x] **Step 1: Modernize Dashboard layout in `src/app/dashboard/page.tsx`**

In `src/app/dashboard/page.tsx`:
- Render prominent Hero Card: "DANAŠNJI FOKUS • DAN X", current day title, short summary, and emerald primary action button "Nastavi sa učenjem →".
- Render 3-column metric cards grid:
  1. **Ukupan Napredak:** percentage badge, large numeric display, visual gradient progress bar (`linear-gradient(90deg, #10b981, #2dd4bf)`).
  2. **Urađene Vežbe:** count of completed units vs total required units, status checkmark.
  3. **Zabeleške & Rad:** count of student notes and exercises saved locally.
- Keep existing `ProgressOverview` and course links accessible with clean spacing (`gap-6`).

- [x] **Step 2: Add responsive grid rules in `src/app/globals.css`**

- Desktop (≥1024px): `.dashboard-metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }`.
- Tablet (640px–1023px): `grid-template-columns: repeat(2, 1fr);`.
- Mobile (<640px): `grid-template-columns: 1fr; gap: 14px;` (ensuring 320px reflow passes without overflow).

- [x] **Step 3: Run Playwright authenticated & reflow tests**

Run: `npx playwright test tests/e2e/authenticated.spec.ts tests/e2e/reflow-tables.spec.ts --reporter=list`
Expected: PASS (verifying 320px reflow baseline and dashboard interactive elements)

- [x] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx src/components/progress-overview.tsx src/app/globals.css
git commit -m "feat(dashboard): modernize hero action card and spacious metrics grid"
```

---

### Task 5: Full E2E Verification & Reflow Audit Across All Viewports

**Files:**
- Test: All tests in `tests/e2e/*.spec.ts`

- [x] **Step 1: Run complete Playwright test suite**

Run: `npx playwright test --reporter=list`
Expected: PASS (`107 passed` across all 7 test suites: `authenticated.spec.ts`, `foundation.spec.ts`, `integrated-audit.spec.ts`, `keyboard-focus.spec.ts`, `reflow-tables.spec.ts`, `smoke.spec.ts`, `states.spec.ts`, `theme.spec.ts`)

- [x] **Step 2: Run typecheck and linting**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors, 0 warnings

- [x] **Step 3: Verify git status is clean**

Run: `git status`
Expected: Working tree clean
