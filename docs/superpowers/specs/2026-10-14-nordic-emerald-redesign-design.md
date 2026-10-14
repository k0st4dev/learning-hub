# Design Document: Nordic Emerald & Slate Redesign

## 1. Intent & Problem Statement

The current UI of the learning platform feels cramped, overly constrained, and visually fatiguing:
- The site header and student navigation are cramped into horizontal text links without clear hierarchy or modern aesthetic polish.
- The content container is restricted to `max-width: 1120px` with headings forced into `max-width: 22ch`, causing unnatural line breaks and squished multi-column views.
- The default dark mode lacks modern depth and breathing room, using basic high-contrast dark blues and grays that strain the eyes over long study sessions.
- Key information (current course day, exercise progress, notes, search) does not stand out with sufficient prominence.

The goal is to transform the platform into a modern, airy, developer-grade learning environment inspired by Linear, Vercel, and modern documentation studios, utilizing a custom **Nordic Emerald & Slate** aesthetic with a dedicated left sidebar and an expansive, breathing grid.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Left Modern Sidebar for Student Workspace:** Replace the cramped horizontal navbar on authenticated routes (`/dashboard`, `/course/...`, `/resources`, `/search`, `/settings`) with an accessible, collapsible vertical sidebar containing brand identity, icon-based navigation, active states, status indicator, and student profile controls.
- **Focused Centered Public Routes:** Retain clean, focused, distraction-free centered card layouts for public entry points: the landing page (`/`), login (`/login`), and registration (`/register`).
- **Expansive Fluid Canvas:** Remove artificial narrow bounding boxes (`1120px` and `22ch`) on student workspaces, moving to a generous wide layout (`max-w-7xl` / `1440px` with 32px padding) that gives code, tables, and curriculum text plenty of room to breathe.
- **Nordic Emerald & Slate Palette:** Deep, calm graphite background tones (`#0b1220`, `#111827`) enhanced with emerald (`#10b981`), mint (`#34d399`), and teal accents, designed for hours of fatigue-free coding and reading.
- **Spacious Cards & Visual Hierarchy:** Modern card containers with 16px radius, subtle border treatments (`rgba(16, 185, 129, 0.15)`), clear metric callouts, and spacious padding (20px–28px).
- **100% Verification & Test Retention:** All 107 existing Playwright E2E tests (including 320px reflow, WCAG AA color contrast, keyboard tab order, skip links, and dialog focus traps) must pass cleanly.

### Non-Goals
- Altering server routes, backend business logic, SQLite database schema, or authentication flows.
- Modifying educational curriculum content, lesson text, or markdown curriculum archives.
- Changing light mode tokens (preserving existing light mode so all existing tests pass without regressions).
- Introducing heavy third-party UI libraries (maintaining the light Next.js 16 + React 19 + Tailwind CSS architecture).

### Anti-Goals
- Breaking reflow at 320px viewport or introducing horizontal page scrolling (prohibited by §201 accessibility audits).
- Lowering color contrast below WCAG 2.1 AA standards (prohibited by §203 / A20 theme audits).
- Breaking keyboard accessibility, the `#main` skip link, or focus trap semantics (prohibited by §204 / §205 / §207).

---

## 3. Architecture & User Experience Choices

### 3.1 Layout & Navigation Architecture
- **Authenticated Student Shell (`src/components/student-shell.tsx` & `student-navigation.tsx`):**
  - On desktop (≥1024px): Two-column layout with a fixed-width left sidebar (230px) and a fluid, scrolling main content area.
  - On mobile/tablet (<1024px): The sidebar collapses into an accessible slide-over drawer triggered by a header hamburger menu button, preserving existing modal/dialog focus trap behavior.
- **Public & Auth Shell (`src/app/layout.tsx`):**
  - Unauthenticated pages (`/`, `/login`, `/register`) remain single-column, centered, and distraction-free with the clean site header.
- **Skip Link:** Retains `.skip-link` pointing directly to `#main`, ensuring the very first Tab keypress moves keyboard focus past the sidebar into the primary content.
- **Top Utility Bar:** Lightweight header inside the content canvas with breadcrumb navigation, quick search shortcut (`Ctrl+K` redirecting to `/search`), and live offline status badge.

### 3.2 Visual Language & Design Tokens
- **Background Base:** `--background: #0b1220` (deep graphite charcoal, preserving exact test assertion value)
- **Surface / Card Base:** `--surface: #111827` (slate-pine card base, preserving exact test assertion value)
- **Surface Elevated / Hover:** `--surface-elevated: #162a2d`
- **Primary Accent:** `--primary: #10b981` (emerald green)
- **Secondary Accent:** `--accent: #34d399` (mint highlight)
- **Borders & Dividers:** `--border: #1e293b` with accent borders `rgba(16, 185, 129, 0.2)`
- **Text Primary:** `--text: #f1f5f9` (clean high-contrast white)
- **Text Muted:** `--muted: #94a3b8` (soft slate gray, strictly compliant with WCAG AA ≥ 4.5:1 on background and surface)
- **Light Mode:** Preserved with existing tokens (`#f8fafc`, `#1d4ed8`, `#0f172a`) to ensure seamless multi-theme compatibility and test guarantees.

### 3.3 Key Pages Redesign
1. **Student Dashboard (`/dashboard`):**
   - Hero "Active Task" card with bold typography, progress badge, and prominent "Continue learning" CTA.
   - 3-column metric cards grid: Total Course Progress (visual progress bar), Practical Exercises Completed, and Notes & Work.
   - Recent activity & upcoming curriculum modules displayed in an airy, card-based list.
2. **Course Overview & Day / Lesson Workspace (`/course/software-engineer/...`):**
   - Clean, wide reading canvas for lesson explanations with comfortable line-height and font sizes.
   - Distinct, well-spaced exercise editors, note panels, and copyable prompt boxes.
3. **Resource Library (`/resources`) & Search (`/search`):**
   - Full-width search input with quick category filter pills.
   - Responsive multi-column card grid with tag badges and collapsible detail drawers.
4. **Settings (`/settings`):**
   - Clean modular card groups with generous form field spacing, consistent focus rings, and clear save confirmation toasts.

---

## 4. Implementation Details & Builder Calls

- **Token Compatibility:** Using `--background: #0b1220` and `--surface: #111827` ensures zero regressions in `theme.spec.ts` while new emerald CSS custom properties (`--emerald-500: #10b981`, `--emerald-400: #34d399`, etc.) power the visual refresh.
- **Search Shortcut:** A global `keydown` listener triggers navigation to `/search` on `Ctrl+K` / `Cmd+K`.
- **Responsive Drawer:** The mobile sidebar leverages HTML `<dialog>` with focus trapping and ESC-key dismiss, fully satisfying Playwright §207 checks.
- **CSS Architecture:** Refined utility classes in `src/app/globals.css`, removing restrictive `max-width: 22ch` on headings and `max-width: 1120px` on `.page-shell`, replacing them with responsive fluid containers (`max-width: 1400px; padding: 32px`).

---

## 5. Verification Strategy
- **Playwright Test Suite:** Run `npx playwright test --reporter=list` and verify all tests pass (`107 passed`).
- **Responsive Audit:** Verify 320px, 360px, 768px, 1024px, and 1440px viewports without horizontal scrollbar.
- **A11y Audit:** Verify WCAG AA color contrast across all updated tokens and component surfaces.
