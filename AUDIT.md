# QA Engineer — AUDIT.md

**Date:** 2026-02-11  
**Auditor:** AI Subagent  
**Focus:** Time-to-first-value improvements

---

## 1. First-Run Experience

**Verdict: Decent but passive — the dashboard waits for user action with no guidance.**

When a new user opens the dashboard for the first time, they see:

- An empty dashboard with stat cards all showing `0` and `—`
- An empty chart with no data
- "No activity yet" in the activity feed
- A sidebar with 6 navigation items

**There is zero onboarding.** No welcome message, no "getting started" guide, no tooltip, no walkthrough. The user has to figure out the workflow (Projects → Test Cases → Test Files → Test Runs) entirely on their own or rely on the AI agent to explain it.

**Steps to first value:**
1. Open dashboard (sees empty state)
2. Navigate to Projects → Click "+ New Project" → Fill form → Save
3. Navigate to Test Files → Click "+ New Test File" → Fill form → Creates file
4. Open code editor → Write or modify test code → Save
5. Click Run → Switch to Test Runs → See result

That's **5-7 clicks minimum** before seeing any test result, and the user needs to understand the project→file→run workflow already. The demo test file (`emika-api.spec.js`) exists on disk but **is not registered in the dashboard database**, so it's invisible to the UI. This is a major missed opportunity.

**The AI agent is supposed to do the onboarding** per SKILL.md, but the dashboard itself provides no affordance for this.

---

## 2. UI/UX Issues

### Good
- Clean, dark-themed design with proper visual hierarchy
- Responsive layout with mobile sidebar collapse
- Code editor with syntax highlighting, line numbers, keyboard shortcuts (Tab, Ctrl+S)
- Run detail view with parsed test results, progress bars, output tabs
- PIN protection feature is well-implemented
- Activity feed merges runs + file creation into a timeline
- Chart with multiple time period options (24h/7d/30d/90d)

### Problems

1. **Empty states are unhelpful.** Every empty state just says "No X yet" — none suggest what to do next or have a CTA button. The dashboard empty state is the worst: 6 stat cards all showing zero with no direction.

2. **"Run All Tests" button on Test Runs page always runs `type: 'api'`** — hardcoded. Should run ALL tests or at least let the user pick. This is misleading.

3. **No save confirmation.** Saving a test file (`saveCodeFile`) has no success/error feedback — the user clicks Save and nothing visible happens. Same for all other save operations.

4. **No loading states.** API calls show no spinner, no skeleton, no indication that something is happening. `loadAll()` fires 5 parallel requests every time you switch views.

5. **Chart defaults to "24h" period** but the `chartPeriod` is initialized to `'7d'` in code while the HTML has "24h" button marked as `active`. This is a mismatch — the chart renders with 7d data but the 24h button appears selected.

6. **Resources view has inconsistent type values.** The filter dropdown offers "Credentials/API Info/Docs/Other" but the API uses `credentials/api/docs/other`. The resource type picker also uses `credentials` but the tag class `tag-credentials` doesn't match the CSS which defines `tag-api` twice (once for test types, once for resource types — collision).

7. **No way to edit a project** from the UI. There's an edit API endpoint but no edit button or modal for projects.

8. **Test case steps stored as array but edited as textarea.** The conversion (split by newline) works but there's no numbered-step UI or drag-to-reorder.

9. **`ansi-to-html` dependency is installed but never used.** The run output formatting is done manually with regex.

10. **PIN is sent in plaintext from GET /api/config** — anyone inspecting network traffic sees the PIN. The `checkPinLock` function also compares the PIN client-side, meaning the PIN is exposed to the browser.

---

## 3. Feature Completeness

### Fully Implemented
- Projects CRUD
- Test Cases CRUD with filtering
- Test Files CRUD with code editor and disk sync
- Test Runs execution and result parsing (Playwright + Node test runner)
- Resources CRUD with type categories
- PIN lock/unlock
- Dashboard stats and chart
- Activity feed
- Run detail with results/output tabs

### Missing/Stubbed
- **No test case ↔ test file linking in UI.** The `testFileId` field exists on test cases but there's no UI to associate them. Test cases and test files are disconnected in the dashboard.
- **No import/export.** Can't import existing test suites or export data.
- **No notifications.** Failed tests produce no alerts — the user must check the dashboard.
- **No search.** Can't search test cases, files, or runs.
- **No bulk operations.** Can't select multiple items to delete/run.
- **No test file editing** (rename, move between projects).
- **Tags on test cases** — the field exists in the API but there's no UI for adding/viewing tags.

### TODOs/Placeholders
- The sample unit test (`tests/unit/sample.test.js`) tests `2+2=4` — it's a placeholder, not useful.
- The demo API test file targets `https://api.emika.ai` which is hardcoded/specific to one product. Not useful for generic QA users.

---

## 4. Error Handling

**Weak across the board.**

- **API client (`this.api()`):** Silently returns `null` on any error — no logging, no user notification. A network failure or 500 error is indistinguishable from "no data."
- **Test run errors:** If the spawn process fails, it's caught and status set to "error" — this works.
- **Missing `try/catch` on server routes** — if `loadDb()` returns malformed data or `fs.writeFile` fails, Express will return a 500 but the error isn't structured.
- **No request validation middleware** — server.js does minimal validation (just checks `name` or `title` required). No type checking, no sanitization of `req.body.command` in test runs (see security issue below).
- **Empty states exist** for all list views — this is good.
- **No loading/pending states** — when data is loading or a run is starting, the UI shows no indicator.

---

## 5. Code Quality

### Bugs
1. **Chart period mismatch:** `this.chartPeriod = '7d'` in init but HTML has `24h` as the active button class.
2. **`loadAll()` called twice on startup:** Once in `renderCurrentView()` and `renderCurrentView` is called from `startApp()`, but `startApp` also calls `loadAll()` — wait, actually `startApp` calls `loadAll()` then `renderCurrentView()` which calls `loadAll()` again. Six wasted API calls on every startup.
3. **Test run list capped at 100** (`db.testRuns.splice(100)`) but this isn't communicated to the user.

### Security Issues
1. **Command injection in test runs.** `POST /api/test-runs` accepts a `command` field that gets passed directly to `sh -c`. Any user with dashboard access can run arbitrary shell commands: `curl -X POST /api/test-runs -d '{"command":"rm -rf /"}'`. **This is critical.**
2. **PIN exposed in plaintext** via `GET /api/config` — see above.
3. **No authentication on any API endpoint.** The PIN only protects the frontend — the API is completely open. Anyone can `curl` all data.
4. **File paths from user input** — `req.body.filename` is used to construct file paths without sanitization. A filename like `../../etc/passwd` could cause path traversal.

### Anti-patterns
- **Entire DB loaded/saved on every request.** JSON file is read and written atomically, but under concurrent requests this causes race conditions (read-modify-write without locks).
- **`renderCurrentView()` reloads ALL data** (5 API calls) on every view switch — excessive.
- **1275 lines in a single `app.js`** — no modules, no separation. Not a problem for this scale but makes maintenance harder.

### Missing
- No tests for the dashboard itself (server.js has no test coverage)
- No error logging on the server
- No request rate limiting

---

## 6. BOOTSTRAP.md Quality

**Verdict: Good enough but too focused on AI-agent consumption, not human-readable.**

- Clear 5-step boot process
- Key paths section is useful
- Mentions the demo test file — good
- **Missing:** No mention of security caveats, no troubleshooting steps, no "what if port 3000 is taken" guidance
- **Problem:** Says "Run demo test to show the user how things work" but the demo test isn't registered in the dashboard DB, so running it via CLI won't update the dashboard UI. The agent needs to register it first via the API or run it through `POST /api/test-runs`.
- **Length:** Appropriate — not too long, not too short.

---

## 7. SKILL.md Quality

**Verdict: Comprehensive and well-structured. Best file in the repo.**

- Clear onboarding script for the AI to follow
- Complete API reference with examples
- Test pattern templates for API/UI/Unit
- Workflow steps are logical
- Resources section well-documented
- Proactive behavior guidelines

**Issues:**
- References `process.env.API_URL` in test templates but doesn't explain how to set it
- The "Cron Schedule" section describes behaviors but there's no actual cron implementation — this is aspirational/dependent on the hosting platform
- No guidance on handling the command injection risk when running custom commands
- No mention of the PIN security limitations

---

## 8. Specific Improvements (Ranked by Impact)

### Critical (Security)

1. **Sanitize or remove the `command` field from `POST /api/test-runs`.** Either whitelist allowed commands (only `npx playwright test` and `node --test` with validated paths) or remove custom command support entirely. This is a remote code execution vulnerability.

2. **Don't expose PIN via GET /api/config.** Return a boolean `pinEnabled: true/false` instead. Move PIN verification server-side with a `POST /api/verify-pin` endpoint.

3. **Sanitize filenames** in `POST /api/test-files` — reject paths containing `..`, `/`, or other traversal characters.

### High Impact (Time-to-First-Value)

4. **Add a first-run welcome screen / onboarding wizard.** When `projects.length === 0 && testFiles.length === 0`, show a card: "Welcome! I'm your QA Dashboard. Your AI QA Engineer will create projects and tests here. You can also create them manually:" with buttons for "Create Project" and "Run Demo Tests."

5. **Pre-register the demo test file in the DB on first boot.** In `ensureDataDir()`, if the DB is freshly created, also register `tests/api/emika-api.spec.js` as a test file so users see content immediately.

6. **Add a "Quick Run" button on the dashboard** that runs all tests with one click — no navigation needed.

7. **Show toast/snackbar notifications** for save, delete, run-start, and error events. Currently the UI is completely silent on all operations.

8. **Fix the double `loadAll()` on startup.** Remove the `loadAll()` call inside `renderCurrentView()` — the caller should load data once, then render.

### Medium Impact (UX Polish)

9. **Fix the chart period mismatch.** Either initialize `chartPeriod = '24h'` or set the 7d button as active in HTML.

10. **Make "Run All Tests" actually run all tests** — not just API type. Use `POST /api/test-runs { "command": "npx playwright test --reporter=list" }` or add a dedicated run-all endpoint.

11. **Add loading spinners** for API calls — at minimum a top-bar progress indicator.

12. **Add project edit functionality** — edit button in the project list that opens the project modal pre-filled.

13. **Link test cases to test files** in the UI — when viewing a test case, show which file implements it and vice versa.

14. **Add search** — a global search bar or per-section search that filters by name/title.

15. **Remove the unused `ansi-to-html` dependency** from package.json.

### Low Impact (Nice to Have)

16. **Add keyboard shortcuts** — `N` for new item in current view, `R` for run, `/` for search.

17. **Add test file rename/move** functionality.

18. **Add bulk select/delete** for test cases and files.

19. **Add a "last edited" indicator** on test files to show which were recently modified.

20. **Add server-side error logging** — write errors to a log file or stderr with timestamps.

21. **Consider SQLite** instead of JSON file for data storage — eliminates race condition risk under concurrent writes.

---

## Summary

The QA Engineer image is **functionally solid** — it has a complete dashboard with real test execution, a polished dark UI, and a well-written SKILL.md that gives the AI agent clear guidance. The code quality is reasonable for a single-developer project.

**Biggest blockers to time-to-first-value:**
1. Empty first-run experience with no onboarding
2. Demo content exists on disk but isn't visible in the dashboard
3. No feedback on any user action (silent saves, silent errors)
4. Command injection vulnerability must be fixed before any public deployment

**If I could only fix 3 things:** Pre-register demo content (#5), add the welcome screen (#4), and fix the command injection (#1). That alone would cut time-to-first-value from "confused at empty dashboard" to "sees tests, clicks Run, gets results in 10 seconds."

---

## Fixes Applied

**Date:** 2026-02-11

### Critical (Security)

1. **✅ Command injection fixed.** Removed the `command` field from `POST /api/test-runs`. All commands are now built server-side from validated `fileId`, `projectId`, or `type` parameters. Added `type: 'all'` to run all test types safely.

2. **✅ PIN no longer exposed in plaintext.** `GET /api/config` now returns only `pinEnabled: true/false`. Added `POST /api/verify-pin` for server-side verification. PINs are hashed with SHA-256 before storage. Legacy plaintext PINs are auto-migrated on first verify. Client uses `sessionStorage` instead of `localStorage` with the actual PIN.

3. **✅ Filename sanitization added.** `sanitizeFilename()` strips path traversal (`..`, `/`) and dangerous characters from user-supplied filenames in `POST /api/test-files`.

### High Impact (Time-to-First-Value)

4. **✅ First-run welcome screen added.** When projects, files, and runs are all empty, the dashboard shows a friendly onboarding card with "Create a Project" and "Browse Test Files" buttons.

5. **✅ Demo content pre-registered on first boot.** `ensureDataDir()` now seeds the DB with: a Demo Project, the existing `emika-api.spec.js` registered as a test file, a `sample.test.js` unit test file, a demo test case, and a "Getting Started" resource doc. Users see content immediately.

6. **✅ Toast notifications added.** All save, delete, create, and run-start operations now show toast feedback. API errors also show toasts for non-GET requests. Silent operations are no longer silent.

7. **✅ Double `loadAll()` on startup fixed.** `renderCurrentView()` now accepts a `skipLoad` parameter. `startApp()` calls `loadAll()` once, then `renderCurrentView(true)` to skip the redundant second load.

### Medium Impact (UX Polish)

8. **✅ Chart period mismatch fixed.** `this.chartPeriod` now initializes to `'24h'` matching the HTML active button.

9. **✅ "Run All Tests" fixed.** The button now sends `{ type: 'all' }` which runs both Playwright and Node test runner across all test directories.

10. **✅ Project edit functionality added.** Edit button added to project list. `openProjectModal()` now accepts a project object to pre-fill the form. `saveProject()` uses PUT for edits, POST for new.

11. **✅ API error handling improved.** `api()` method now checks `res.ok`, logs errors to console, parses error messages from response body, and shows toast notifications for failures.

### Cleanup

12. **✅ Removed unused `ansi-to-html` dependency** from package.json.
