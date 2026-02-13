# QA Dashboard — API Reference

## ⚠️ IMPORTANT: Port 3000

Your **QA Dashboard** web application is ALREADY RUNNING on port 3000. It starts automatically via start.sh.

- **DO NOT** kill anything on port 3000 — that is YOUR app
- **DO NOT** try to start a new server on port 3000
- The app is accessible to the user via the browser panel (iframe)
- If you need to build something for the user, deploy it on a DIFFERENT port using PM2


Base URL: `http://localhost:3000`

---

## Projects

### List projects
```bash
curl http://localhost:3000/api/projects
```

### Create project
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Emika API","description":"API endpoint tests","baseUrl":"https://api.emika.ai","type":"api"}'
```
Types: `api`, `ui`, `unit`, `mixed`

### Update project
```bash
curl -X PUT http://localhost:3000/api/projects/{id} \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name"}'
```

### Delete project
```bash
curl -X DELETE http://localhost:3000/api/projects/{id}
```

---

## Test Cases

### List test cases
```bash
curl http://localhost:3000/api/test-cases
curl http://localhost:3000/api/test-cases?projectId={id}&type=api&status=automated
```

### Create test case
```bash
curl -X POST http://localhost:3000/api/test-cases \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Login returns JWT token",
    "projectId": "...",
    "type": "api",
    "priority": "high",
    "status": "draft",
    "steps": ["POST /users/login with valid creds", "Check 200 status", "Verify token in body"],
    "expectedResult": "Valid JWT returned"
  }'
```

Priority: `low`, `medium`, `high`, `critical`
Status: `draft`, `ready`, `automated`, `deprecated`
Type: `api`, `ui`, `unit`

### Update test case
```bash
curl -X PUT http://localhost:3000/api/test-cases/{id} \
  -H "Content-Type: application/json" \
  -d '{"status":"automated","automated":true,"lastResult":"pass"}'
```

### Delete test case
```bash
curl -X DELETE http://localhost:3000/api/test-cases/{id}
```

---

## Test Files (Code)

### List test files
```bash
curl http://localhost:3000/api/test-files
curl http://localhost:3000/api/test-files?projectId={id}&type=api
```

### Create test file
Creates the file on disk and registers it in the database.
```bash
curl -X POST http://localhost:3000/api/test-files \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "auth.spec.js",
    "projectId": "...",
    "type": "api",
    "description": "Authentication endpoint tests",
    "content": "const { test, expect } = require(\"@playwright/test\");\n..."
  }'
```

### Get test file (with content)
```bash
curl http://localhost:3000/api/test-files/{id}
```

### Update test file (save code)
```bash
curl -X PUT http://localhost:3000/api/test-files/{id} \
  -H "Content-Type: application/json" \
  -d '{"content":"updated code..."}'
```

### Delete test file
```bash
curl -X DELETE http://localhost:3000/api/test-files/{id}
```

---

## Test Runs

### List test runs
```bash
curl http://localhost:3000/api/test-runs
curl http://localhost:3000/api/test-runs?projectId={id}
```

### Run tests
```bash
# Run a specific file
curl -X POST http://localhost:3000/api/test-runs \
  -H "Content-Type: application/json" \
  -d '{"fileId":"..."}'

# Run all tests for a project
curl -X POST http://localhost:3000/api/test-runs \
  -H "Content-Type: application/json" \
  -d '{"projectId":"..."}'

# Run by type
curl -X POST http://localhost:3000/api/test-runs \
  -H "Content-Type: application/json" \
  -d '{"type":"api"}'

# Custom command
curl -X POST http://localhost:3000/api/test-runs \
  -H "Content-Type: application/json" \
  -d '{"command":"npx playwright test tests/api/ --reporter=list"}'
```

### Get run details (with full output)
```bash
curl http://localhost:3000/api/test-runs/{id}
```

---

## Stats
```bash
curl http://localhost:3000/api/stats
curl http://localhost:3000/api/stats?projectId={id}
```

---

## Direct Test Execution

You can also run tests directly via command line:

```bash
# All API tests
npx playwright test tests/api/ --reporter=list

# All UI tests
npx playwright test tests/ui/ --reporter=list

# Specific file
npx playwright test tests/api/emika-api.spec.js --reporter=list

# Unit tests
node --test tests/unit/

# All tests
npx playwright test --reporter=list
```

Results are automatically parsed from output (Playwright format: "X passed", "X failed").

## Screenshots & File Sharing

### Taking Screenshots
Use Playwright (pre-installed) to capture any website:
```bash
npx playwright screenshot --browser chromium https://example.com /tmp/screenshot.png
```

If Chromium is not installed yet, install it first:
```bash
npx playwright install chromium
```

### Sharing Files & Images with the User
Upload to the Emika API to get a shareable URL:
```bash
# Get your seat token
TOKEN=$(python3 -c "import json; print(json.load(open('/home/node/.openclaw/openclaw.json'))['gateway']['auth']['token'])")

# Upload any file
URL=$(curl -s -X POST "http://162.55.102.58:8080/uploads/seat" \
  -H "X-Seat-Token: $TOKEN" \
  -F "file=@/tmp/screenshot.png" | python3 -c "import sys,json; print(json.load(sys.stdin)['full_url'])")

# Include the URL in your response as markdown image
echo "![Screenshot]($URL)"
```

**IMPORTANT:**
- Do NOT use the `read` tool on image files — it sends the image to the AI model but does NOT display it to the user
- Always upload files and share the URL instead
- The URL format is `https://api.emika.ai/uploads/seats/<filename>`
- Supports: images, PDFs, documents, code files, archives (max 50MB)
