# CalliLens V1.6 Entry Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a product-style entry page that lets users choose between a future upload flow and stored calligraphy works before entering the current guided observation demo.

**Architecture:** Keep the app static and browser-only for V1.6. Add `data/works.json` as a small work index, then let `web/app.js` switch between entry, stored works, upload placeholder, and existing viewer states without adding a backend.

**Tech Stack:** Static HTML, CSS, browser JavaScript, existing `annotation.json` data, localStorage.

---

### Task 1: Add Work Index

**Files:**
- Create: `data/works.json`

- [ ] **Step 1: Add a static work index**

Create `data/works.json` with `defaultWorkId`, a `works` array, and entries for `work_003` and `work_001`.

- [ ] **Step 2: Validate JSON**

Run:

```powershell
python -m json.tool data/works.json > $null
```

Expected: no output and exit code `0`.

### Task 2: Add Entry Markup

**Files:**
- Modify: `web/index.html`

- [ ] **Step 1: Add an entry section before the existing app shell**

Add `section.entryScreen` with title, intro copy, primary action buttons, stored works panel, and upload placeholder panel.

- [ ] **Step 2: Keep the existing viewer markup**

Do not remove current viewer, guide panel, first impression, probe, or reflection markup. The new entry screen should hide/show the existing app shell.

### Task 3: Wire Entry State

**Files:**
- Modify: `web/app.js`

- [ ] **Step 1: Load `data/works.json`**

Add a `WORKS_URL` constant and fetch the work index during boot.

- [ ] **Step 2: Add route/state helpers**

Support these states:

- Entry: default `/web/`
- Stored works: clicking `浏览已存作品`
- Upload placeholder: clicking `上传个性化书法作品`
- Demo: clicking a stored work or opening `/web/?work=work_003&view=demo`

- [ ] **Step 3: Render work cards**

Use `data/works.json` to render stored work cards. Each card sets the selected work and loads `../data/<workId>/annotation.json`.

- [ ] **Step 4: Preserve existing demo behavior**

After a work is selected, existing functions such as `renderImage`, `renderGuideList`, `renderOverlay`, `renderReflectionPanel`, and `loadAnalysisCanvases` should continue to run.

### Task 4: Style Entry Page

**Files:**
- Modify: `web/styles.css`

- [ ] **Step 1: Add entry layout**

Style the entry page as a calm calligraphy learning interface with a first viewport title and a second section containing the two actions.

- [ ] **Step 2: Add card and placeholder styles**

Style stored work cards and upload placeholder panels so they are scannable and do not look like a marketing landing page.

- [ ] **Step 3: Preserve mobile layout**

Ensure the entry screen and existing demo do not overlap at mobile widths.

### Task 5: Verify

**Files:**
- Test: `web/app.js`
- Test: `data/works.json`
- Test: `data/work_003/annotation.json`

- [ ] **Step 1: Static checks**

Run:

```powershell
node --check web/app.js
python -m json.tool data/works.json > $null
python -m json.tool data/work_003/annotation.json > $null
```

- [ ] **Step 2: Local server check**

Run:

```powershell
.\start-demo.ps1
```

Open:

```text
http://localhost:5173/web/
```

Expected:

- Entry page appears by default.
- `浏览已存作品` shows work cards.
- `进入导览` opens the existing demo.
- `/web/?work=work_003&view=demo` opens the demo directly.
- Upload entry shows a placeholder explanation.

### Task 6: Commit

**Files:**
- Add: `docs/CALLILENS_V1_6_TASKBOOK.md`
- Add: `docs/superpowers/plans/2026-07-08-calliLens-v1-6-entry-flow.md`
- Add: `data/works.json`
- Modify: `web/index.html`
- Modify: `web/app.js`
- Modify: `web/styles.css`

- [ ] **Step 1: Review status**

Run:

```powershell
git status --short
```

- [ ] **Step 2: Commit**

Run:

```powershell
git add docs/CALLILENS_V1_6_TASKBOOK.md docs/superpowers/plans/2026-07-08-calliLens-v1-6-entry-flow.md data/works.json web/index.html web/app.js web/styles.css
git commit -m "Add CalliLens V1.6 entry flow"
```
