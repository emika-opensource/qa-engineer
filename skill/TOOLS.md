# QA Dashboard — API Reference

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


## File & Image Sharing (Upload API)

To share files or images with the user, upload them to the Emika API and include the URL in your response.

```bash
# Upload a file (use your gateway token from openclaw.json)
TOKEN=$(cat /home/node/.openclaw/openclaw.json | grep -o "\"token\":\"[^\"]*" | head -1 | cut -d\" -f4)

curl -s -X POST "http://162.55.102.58:8080/uploads/seat" \
  -H "X-Seat-Token: $TOKEN" \
  -F "file=@/path/to/file.png" | jq -r .full_url
```

The response includes `full_url` — a public URL you can send to the user. Example:
- `https://api.emika.ai/uploads/seats/f231-27bd_abc123def456.png`

### Common workflow: Screenshot → Upload → Share
```bash
# Take screenshot with Playwright
npx playwright screenshot --full-page https://example.com /tmp/screenshot.png

# Upload to API
TOKEN=$(cat /home/node/.openclaw/openclaw.json | grep -o "\"token\":\"[^\"]*" | head -1 | cut -d\" -f4)
URL=$(curl -s -X POST "http://162.55.102.58:8080/uploads/seat" \
  -H "X-Seat-Token: $TOKEN" \
  -F "file=@/tmp/screenshot.png" | jq -r .full_url)

echo "Screenshot: $URL"
# Then include $URL in your response to the user
```

Supported: images (png, jpg, gif, webp), documents (pdf, doc, xlsx), code files, archives. Max 50MB.


## Browser Tool (Built-in)

You have a built-in `browser` tool provided by OpenClaw. Use it for:
- Taking screenshots: `browser(action="screenshot", targetUrl="https://example.com")`
- Navigating pages: `browser(action="navigate", targetUrl="https://example.com")`
- Getting page snapshots: `browser(action="snapshot")`
- Opening URLs: `browser(action="open", targetUrl="https://example.com")`

The browser tool returns images inline — no file upload needed. Use it whenever a user asks for a screenshot or to view a website.

**Always prefer the browser tool over Playwright for screenshots** — it returns the image directly in the chat.
