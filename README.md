# QA Engineer — Emika AI Employee

QA Dashboard and test automation workspace for the QA Engineer AI Employee.

## Features

- 📊 **QA Dashboard** — Dark-themed web UI for managing projects, test cases, test files, and run results
- 🔌 **API Tests** — Playwright request API for HTTP endpoint testing
- 🖥️ **UI Tests** — Playwright browser automation with Chromium
- ⚙️ **Unit Tests** — Node.js built-in test runner
- 💻 **Code Viewer** — Built-in editor with line numbers, syntax highlighting, and run button
- ▶️ **Test Runner** — Execute tests from the dashboard and see results in real-time
- 📁 **Projects** — Organize tests by project/application

## Quick Start

```bash
npm install
npx playwright install chromium
npm start
```

Dashboard runs at `http://localhost:3000`.

## Production (PM2)

```bash
pm2 start ecosystem.config.js
```

## Running Tests

```bash
# All API tests
npx playwright test tests/api/

# All UI tests
npx playwright test tests/ui/

# Unit tests
node --test tests/unit/

# Specific file
npx playwright test tests/api/emika-api.spec.js
```

## API

See `skill/TOOLS.md` for complete API documentation.

## Stack

- **Server**: Express.js
- **Test Framework**: Playwright + Node.js test runner
- **Frontend**: Vanilla JS, Space Grotesk font, dark theme
- **Data**: JSON file storage
- **Process Manager**: PM2
