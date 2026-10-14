# Programming Learning Platform 🚀

A private, offline-first, local software engineering learning environment built from the comprehensive 26-week curriculum.

Study lesson concepts in the browser, code real projects in your own local IDE, track your progress with verified checklists and evidence, write private study notes, and evaluate your monthly engineering skills—**100% locally on your computer with complete privacy and zero cloud dependencies**.

---

## Table of Contents

- [Why This Platform?](#why-this-platform)
- [How It Works](#how-it-works)
- [Quick Start Guide](#quick-start-guide)
  - [Prerequisites](#prerequisites)
  - [Setup in 3 Steps](#setup-in-3-steps)
- [How to Use the Platform as a Student](#how-to-use-the-platform-as-a-student)
  - [1. Create Your Local Account](#1-create-your-local-account)
  - [2. Course Preparation & Orientation](#2-course-preparation--orientation)
  - [3. The Daily Learning Routine](#3-the-daily-learning-routine)
  - [4. Fast-Resume with "Continue Learning"](#4-fast-resume-with-continue-learning)
  - [5. Private Notes](#5-private-notes)
  - [6. Monthly Scorecard Reviews](#6-monthly-scorecard-reviews)
  - [7. Instant Search & Resource Library](#7-instant-search--resource-library)
  - [8. Dark Mode & Customization](#8-dark-mode--customization)
- [Operations & Data Safety](#operations--data-safety)
  - [Creating a Verified Backup](#creating-a-verified-backup)
  - [Restoring from Backup](#restoring-from-backup)
  - [Running Database Diagnostics](#running-database-diagnostics)
  - [Resetting a Forgotten Password](#resetting-a-forgotten-password)
  - [Curriculum Upgrades](#curriculum-upgrades)
- [Testing & Quality Verification](#testing--quality-verification)
- [Configuration](#configuration)
- [Troubleshooting & FAQ](#troubleshooting--faq)
- [License & Credits](#license--credits)

---

## Why This Platform?

Many modern learning platforms trap your code in simulated in-browser widgets, require constant internet connections, and lock your learning history in remote proprietary clouds.

This platform takes the opposite approach:

- 🔒 **Local & Private First**: Your data stays on your machine. Progress, private notes, and reviews live in a local SQLite database (`data/learning.sqlite`). No tracking, no analytics, no external telemetry.
- 💻 **Real Developer Workflow**: You don't code in artificial sandboxes. You write code using your own local tools (VS Code, terminal, Git) and record your actual results, commits, and self-assessments in the app.
- ⚡ **Fast & Responsive**: High-performance local server with instant sub-200ms search, instant navigation, and seamless state persistence.
- ♿ **Accessible by Design**: Full WCAG 2.2 AA compliance, high-contrast dark and light themes, sequential keyboard navigation, screen-reader live regions, and responsive reflow down to 320px mobile screens.
- 🛡️ **Enterprise Data Safety**: Built-in online backups, stopped-server disaster recovery, database integrity diagnostics, and atomic version upgrades.

---

## How It Works

The platform organizes your journey through a structured 26-week curriculum divided into 6 distinct phases:

1. **Phase 1: JavaScript Fundamentals & Problem Decomposition** (Weeks 1–4, Days 1–28)
2. **Phase 2: Browser, DOM, Tooling & Frontend Architecture** (Weeks 5–8, Days 29–56)
3. **Phase 3: Async JavaScript, APIs & Algorithmic Foundations** (Weeks 9–12, Days 57–84)
4. **Phase 4: Computer Science Fundamentals (C, Memory, Data Structures & Python)** (Weeks 13–19, Days 85–133)
5. **Phase 5: Modern Full-Stack Web Development (React, Node, Express, SQL & Auth)** (Weeks 20–25, Days 134–175)
6. **Phase 6: Independent Capstone Project & Final Synthesis** (Week 26, Days 176–182)

Every single day features a balanced two-step loop:

1. **Study Lesson**: Master core concepts, read original documentation, and review AI guidelines.
2. **Practice Exercise**: Hands-on coding challenge, complete with specific task checklists, completion criteria, and space to record your code evidence and repository references.

---

## Quick Start Guide

### Prerequisites

All you need installed on your computer is:

- **Node.js**: Version **24.21.0** (or compatible 24.x LTS). Download from [nodejs.org](https://nodejs.org/).
- **npm**: Version **11.x** (ships with Node 24).
- **Git**: To clone the repository.

No external database servers (Postgres, MySQL), Docker containers, or cloud API keys are required.

### Setup in 3 Steps

Open your terminal, navigate to the folder where you want to keep the app, and run:

```bash
# 1. Clone the repository
git clone https://github.com/your-username/learning-hub.git
cd learning-hub

# 2. Install dependencies & initialize the local database
npm ci
npm run setup

# 3. Start the application
npm run dev
```

Open your browser and navigate to:
👉 **[http://127.0.0.1:3000](http://127.0.0.1:3000)**

_(Press `Ctrl+C` in your terminal whenever you want to stop the server)._

> [!TIP]
> **Production Mode**: If you prefer running the compiled production build instead of the development server, run `npm run build` followed by `npm start`.

---

## How to Use the Platform as a Student

### 1. Create Your Local Account

- When you first visit the app, click **Register**.
- Enter your email and a strong password (at least 15 characters).
- Your password is protected with modern **Argon2id** hashing and never sent over the internet.
- Sign in with your new account.

### 2. Course Preparation & Orientation

- After signing in, click **Start course** on your Dashboard.
- You will see the **Preparation Checklist**—seven recommended setup checks (IDE setup, Git config, study rhythm).
- You can review and acknowledge them immediately or choose **Defer preparation checks** to begin learning right away.

### 3. The Daily Learning Routine

Each day is broken down into two distinct units:

```
┌─────────────────────────────────┐       ┌───────────────────────────────────┐
│        1. Study Lesson          │       │        2. Practice Exercise       │
│                                 │       │                                   │
│  • Read explanation & theory    │ ────> │  • Build the project in your IDE │
│  • Review original references   │       │  • Complete step-by-step tasks    │
│  • Mark lesson complete         │       │  • Provide self-assessment        │
└─────────────────────────────────┘       └───────────────────────────────────┘
```

1. **Study**: Click into the day's study lesson. Read through the concepts, view original references, and click **Mark lesson complete**.
2. **Practice**: Click **Continue to exercise**. Open your code editor and build the requested project locally.
3. **Submit & Complete**:
   - Check off each task as you complete it.
   - Enter your completion evidence (such as a commit hash or description of your solution).
   - Select your self-assessment result (_"My work passes the criterion"_).
   - Check the attestation box and click **Confirm exercise complete**.

### 4. Fast-Resume with "Continue Learning"

Whenever you return to the platform, you don't have to search for where you left off:

- Click the prominent **Continue Learning** button on your Dashboard or header navigation.
- The app instantly opens your exact active unfinished lesson or exercise and focuses your working cursor.

### 5. Private Notes

- Every Day overview, Study lesson, and Practice exercise includes a built-in **Private Notes** editor.
- Notes are auto-saved locally after an 800ms pause or when you click away.
- Notes support up to 20,000 characters and are completely private to your account.
- If a save ever fails due to a network or server hiccup, your draft is **never lost**—it remains safely in the text box with an instant **Retry** button.

### 6. Monthly Scorecard Reviews

- Professional software engineers regularly assess their technical and professional growth.
- From the Course menu, open **Monthly scorecard**.
- Review yourself across **14 core engineering dimensions** (including Code Quality, Debugging, Algorithmic Thinking, Git Workflow, and Independence) using a clear 0–3 rubric.
- Enter your monthly reflection evidence and click **Save review**.

### 7. Instant Search & Resource Library

- **Search (`/search`)**: Press the Search link in the header to find topics, lessons, tasks, or handbook guides. Features automatic instant matching as you type with support for Serbian diacritic normalization (e.g., searching `vezbe` or `vežbe` works identically).
- **Resources (`/resources`)**: Browse the curated catalog of original documentation, articles, and book chapters. Filter by topic, phase, week, or provider (MDN, CS50, The Odin Project, Full Stack Open).

### 8. Dark Mode & Customization

- Go to **Settings** (`/settings`) from the top navigation.
- Choose your preferred interface theme:
  - 🌓 **System**: Automatically matches your operating system's light or dark mode.
  - ☀️ **Light**: Clean, high-contrast light theme.
  - 🌙 **Dark**: Calibrated high-contrast dark theme designed for comfortable long-duration coding.
- Set your local timezone to ensure activity timestamps and scorecard review dates match your clock.

---

## Operations & Data Safety

The platform includes built-in CLI tools to protect and manage your learning data.

### Creating a Verified Backup

You can take a complete, verified snapshot of your database at any time—even while the app is actively running:

```bash
npm run backup
```

This creates a timestamped bundle inside `data/backups/backup-<timestamp>` containing:

- `learning.sqlite`: A standalone, self-consistent copy of your database.
- `manifest.json`: Cryptographic SHA-256 checksums and migration validation data.
- `source-manifest.json`: Verification hash of the immutable course curriculum.

### Restoring from Backup

If you move to a new computer or need to restore a previous backup, first **stop the server** (Ctrl+C), then run:

```bash
npm run restore -- --file data/backups/backup-<timestamp>
```

The restore command will:

1. Validate the backup integrity and checksums.
2. Prompt you to type `RESTORE` to confirm.
3. Automatically create a safety backup of your existing database before touching anything.
4. Atomically restore your database, revoke old sessions for security, and generate a fresh CSRF secret.

### Running Database Diagnostics

To verify that your database is 100% healthy, foreign keys are valid, and progress references are intact:

```bash
npm run db:diagnose
```

### Resetting a Forgotten Password

Because this app runs locally without third-party email providers, you can securely reset an account password directly from your terminal:

1. Stop the application (Ctrl+C).
2. Run:
   ```bash
   npm run password:reset
   ```
3. Enter your account email, type `RESET` to confirm, and type your new password.
4. Restart the server (`npm run dev`) and log in.

### Curriculum Upgrades

When a new version of the curriculum release is published, you can upgrade your enrolled progress seamlessly without losing completed work:

```bash
# Check what will change without modifying data:
npm run curriculum:upgrade -- --dry-run

# Execute the upgrade (takes an automatic safety backup first):
npm run curriculum:upgrade
```

---

## Testing & Quality Verification

The platform is backed by a comprehensive automated test suite guaranteeing accessibility, data integrity, and performance:

```bash
# 1. Run all unit and integration tests (364 tests across 34 suites)
npm test

# 2. Run static analysis and linting
npm run typecheck
npm run lint -- --max-warnings=0
npm run format:check

# 3. Run the automated Playwright E2E & Accessibility suite (107 tests across 8 suites)
npx playwright test --reporter=list
```

### Quality Highlights

- ✅ **107/107 Playwright E2E tests passing** across 5 viewports (Desktop to 320px mobile).
- ✅ **0 Axe accessibility violations** (`wcag2a`, `wcag2aa`, `wcag22aa`).
- ✅ **364/364 Vitest tests passing**.
- ✅ **Performance budgets satisfied**: sub-200ms search, sub-250ms saving.

---

## Configuration

Default settings work out of the box. If needed, you can customize configuration by creating a `.env.local` file:

```env
# Permitted origin (strictly prevents cross-origin requests)
APP_ORIGIN=http://127.0.0.1:3000

# Port to bind (must match the port in APP_ORIGIN)
PORT=3000

# Directory where your SQLite database and backups are stored (defaults to ./data)
APP_DATA_DIR=/path/to/custom/data
```

---

## Troubleshooting & FAQ

#### 1. "Port 3000 is already in use"

Another process is using port 3000. Either terminate the other process or set `PORT=3001` and `APP_ORIGIN=http://127.0.0.1:3001` in your `.env.local`.

#### 2. "Database is locked / operation lock exists"

If an unexpected shutdown occurred during maintenance, remove the stale lock file:

```bash
rm -f data/.local-operation.lock data/.setup.lock
```

#### 3. "My browser says Connection Refused"

Make sure you navigate to **`http://127.0.0.1:3000`** (using the explicit IP address `127.0.0.1`, not `localhost`), as the local security policy enforces exact origin matching.

#### 4. "Can I use this offline?"

**Yes!** All curriculum text, lessons, exercises, search indexes, account logins, and progress tracking work completely offline without an internet connection. Only external links to third-party articles (e.g. external MDN or Wikipedia pages) require internet connectivity.

---

## License & Credits

- Platform codebase: Open-source local learning architecture.
- Curriculum content: 26-Week Software Engineer Training Manual (`se-26w-v1`).
- Offline password blocklist provided by Django under BSD License.
- Third-party dependency notices and license details are documented in [`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md).
