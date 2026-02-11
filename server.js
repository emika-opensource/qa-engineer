const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const TESTS_DIR = process.env.TESTS_DIR || path.join(__dirname, 'tests');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Security: Sanitize file paths ──
function sanitizeFilename(filename) {
    // Strip path traversal and dangerous characters
    return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
}

// ── Helpers ──

async function ensureDataDir() {
    await fs.ensureDir(DATA_DIR);
    await fs.ensureDir(PROJECTS_DIR);
    await fs.ensureDir(TESTS_DIR);
    await fs.ensureDir(path.join(TESTS_DIR, 'api'));
    await fs.ensureDir(path.join(TESTS_DIR, 'ui'));
    await fs.ensureDir(path.join(TESTS_DIR, 'unit'));
    const dbFile = path.join(DATA_DIR, 'db.json');
    if (!(await fs.pathExists(dbFile))) {
        // First boot — seed demo content
        const demoProjectId = uuidv4();
        const demoFileId = uuidv4();
        const demoUnitFileId = uuidv4();
        const demoTestCaseId = uuidv4();

        const apiTestPath = path.join(TESTS_DIR, 'api', 'emika-api.spec.js');
        const unitTestPath = path.join(TESTS_DIR, 'unit', 'sample.test.js');

        // Ensure demo test files exist on disk
        if (!(await fs.pathExists(apiTestPath))) {
            await fs.writeFile(apiTestPath, `const { test, expect } = require('@playwright/test');\n\nconst BASE_URL = process.env.API_URL || 'https://api.emika.ai';\n\ntest.describe('Emika API Tests', () => {\n  test('GET /health returns 200', async ({ request }) => {\n    const res = await request.get(\`\${BASE_URL}/health\`);\n    expect(res.ok()).toBeTruthy();\n  });\n});\n`, 'utf-8');
        }
        if (!(await fs.pathExists(unitTestPath))) {
            await fs.writeFile(unitTestPath, `const { describe, it } = require('node:test');\nconst assert = require('node:assert');\n\ndescribe('Sample Unit Tests', () => {\n  it('basic arithmetic works', () => {\n    assert.strictEqual(2 + 2, 4);\n  });\n\n  it('string concatenation works', () => {\n    assert.strictEqual('hello' + ' ' + 'world', 'hello world');\n  });\n});\n`, 'utf-8');
        }

        const apiContent = await fs.readFile(apiTestPath, 'utf-8');
        const unitContent = await fs.readFile(unitTestPath, 'utf-8');

        const db = {
            projects: [{
                id: demoProjectId,
                name: 'Demo Project',
                description: 'Sample project to demonstrate the QA Dashboard. Feel free to edit or delete.',
                baseUrl: 'https://api.emika.ai',
                type: 'mixed',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }],
            testCases: [{
                id: demoTestCaseId,
                projectId: demoProjectId,
                title: 'Health endpoint returns 200',
                description: 'Verify the API health check endpoint is reachable',
                type: 'api',
                priority: 'high',
                status: 'automated',
                steps: ['Send GET request to /health', 'Verify response status is 200', 'Verify response body indicates OK'],
                expectedResult: 'API returns 200 OK with healthy status',
                tags: ['smoke', 'api'],
                automated: true,
                testFileId: demoFileId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastResult: null
            }],
            testRuns: [],
            testFiles: [{
                id: demoFileId,
                projectId: demoProjectId,
                filename: 'emika-api.spec.js',
                filePath: apiTestPath,
                type: 'api',
                language: 'javascript',
                description: 'API smoke tests for the Emika backend',
                content: apiContent,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }, {
                id: demoUnitFileId,
                projectId: demoProjectId,
                filename: 'sample.test.js',
                filePath: unitTestPath,
                type: 'unit',
                language: 'javascript',
                description: 'Sample unit tests demonstrating Node test runner',
                content: unitContent,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }],
            resources: [{
                id: uuidv4(),
                name: 'Getting Started',
                type: 'docs',
                projectId: null,
                entries: [],
                content: 'Welcome to QA Dashboard!\n\n1. Create a Project to organize your tests\n2. Add Test Files with your test code\n3. Click Run to execute tests and see results\n4. Use Test Cases to document what you\'re testing\n5. Store credentials and docs in Resources\n\nYour AI QA Engineer can also create and run tests for you automatically.',
                tags: ['onboarding'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }],
            _firstRun: true
        };
        await fs.writeJson(dbFile, db, { spaces: 2 });
    } else {
        // Migrate: add resources array if missing
        const db = await fs.readJson(dbFile);
        let changed = false;
        if (!db.resources) { db.resources = []; changed = true; }
        if (changed) await fs.writeJson(dbFile, db, { spaces: 2 });
    }
}

async function loadDb() {
    try { return await fs.readJson(path.join(DATA_DIR, 'db.json')); }
    catch { return { projects: [], testCases: [], testRuns: [], testFiles: [] }; }
}

async function saveDb(db) {
    await fs.writeJson(path.join(DATA_DIR, 'db.json'), db, { spaces: 2 });
}

// ── Projects API ──

app.get('/api/projects', async (req, res) => {
    const db = await loadDb();
    res.json(db.projects);
});

app.get('/api/projects/:id', async (req, res) => {
    const db = await loadDb();
    const p = db.projects.find(x => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Project not found' });
    // Attach counts
    p.testCaseCount = db.testCases.filter(t => t.projectId === p.id).length;
    p.testFileCount = db.testFiles.filter(t => t.projectId === p.id).length;
    p.lastRunCount = db.testRuns.filter(t => t.projectId === p.id).length;
    res.json(p);
});

app.post('/api/projects', async (req, res) => {
    const db = await loadDb();
    const project = {
        id: uuidv4(),
        name: req.body.name,
        description: req.body.description || '',
        baseUrl: req.body.baseUrl || '',
        type: req.body.type || 'mixed', // api, ui, unit, mixed
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    if (!project.name) return res.status(400).json({ error: 'Name required' });
    db.projects.push(project);
    await saveDb(db);
    // Create project test directory
    await fs.ensureDir(path.join(TESTS_DIR, 'projects', project.id));
    res.status(201).json(project);
});

app.put('/api/projects/:id', async (req, res) => {
    const db = await loadDb();
    const idx = db.projects.findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Project not found' });
    db.projects[idx] = { ...db.projects[idx], ...req.body, updatedAt: new Date().toISOString() };
    await saveDb(db);
    res.json(db.projects[idx]);
});

app.delete('/api/projects/:id', async (req, res) => {
    const db = await loadDb();
    db.projects = db.projects.filter(x => x.id !== req.params.id);
    db.testCases = db.testCases.filter(x => x.projectId !== req.params.id);
    db.testFiles = db.testFiles.filter(x => x.projectId !== req.params.id);
    db.testRuns = db.testRuns.filter(x => x.projectId !== req.params.id);
    await saveDb(db);
    res.json({ message: 'Deleted' });
});

// ── Test Cases API ──

app.get('/api/test-cases', async (req, res) => {
    const db = await loadDb();
    let cases = db.testCases;
    if (req.query.projectId) cases = cases.filter(c => c.projectId === req.query.projectId);
    if (req.query.type) cases = cases.filter(c => c.type === req.query.type);
    if (req.query.status) cases = cases.filter(c => c.status === req.query.status);
    res.json(cases);
});

app.get('/api/test-cases/:id', async (req, res) => {
    const db = await loadDb();
    const tc = db.testCases.find(x => x.id === req.params.id);
    if (!tc) return res.status(404).json({ error: 'Test case not found' });
    res.json(tc);
});

app.post('/api/test-cases', async (req, res) => {
    const db = await loadDb();
    const tc = {
        id: uuidv4(),
        projectId: req.body.projectId || null,
        title: req.body.title,
        description: req.body.description || '',
        type: req.body.type || 'api', // api, ui, unit
        priority: req.body.priority || 'medium', // low, medium, high, critical
        status: req.body.status || 'draft', // draft, ready, automated, deprecated
        steps: req.body.steps || [],
        expectedResult: req.body.expectedResult || '',
        tags: req.body.tags || [],
        automated: req.body.automated || false,
        testFileId: req.body.testFileId || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastResult: null // pass, fail, skip, null
    };
    if (!tc.title) return res.status(400).json({ error: 'Title required' });
    db.testCases.push(tc);
    await saveDb(db);
    res.status(201).json(tc);
});

app.put('/api/test-cases/:id', async (req, res) => {
    const db = await loadDb();
    const idx = db.testCases.findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Test case not found' });
    db.testCases[idx] = { ...db.testCases[idx], ...req.body, updatedAt: new Date().toISOString() };
    await saveDb(db);
    res.json(db.testCases[idx]);
});

app.delete('/api/test-cases/:id', async (req, res) => {
    const db = await loadDb();
    db.testCases = db.testCases.filter(x => x.id !== req.params.id);
    await saveDb(db);
    res.json({ message: 'Deleted' });
});

// ── Test Files API (code) ──

app.get('/api/test-files', async (req, res) => {
    const db = await loadDb();
    let files = db.testFiles;
    if (req.query.projectId) files = files.filter(f => f.projectId === req.query.projectId);
    if (req.query.type) files = files.filter(f => f.type === req.query.type);
    // Don't send full content in list view
    res.json(files.map(f => ({ ...f, content: undefined, contentPreview: (f.content || '').slice(0, 200) })));
});

app.get('/api/test-files/:id', async (req, res) => {
    const db = await loadDb();
    const f = db.testFiles.find(x => x.id === req.params.id);
    if (!f) return res.status(404).json({ error: 'Test file not found' });
    // Also read from disk if path exists
    if (f.filePath && await fs.pathExists(f.filePath)) {
        f.content = await fs.readFile(f.filePath, 'utf-8');
    }
    res.json(f);
});

app.post('/api/test-files', async (req, res) => {
    const db = await loadDb();
    const id = uuidv4();
    const type = req.body.type || 'api';
    const filename = sanitizeFilename(req.body.filename || `test_${id.slice(0, 8)}.spec.js`);
    const projectId = req.body.projectId || null;

    // Determine file path
    let dir = path.join(TESTS_DIR, type);
    if (projectId) {
        dir = path.join(TESTS_DIR, 'projects', projectId);
        await fs.ensureDir(dir);
    }
    const filePath = path.join(dir, filename);

    const content = req.body.content || `// ${filename}\n// Type: ${type}\n\n`;

    // Write to disk
    await fs.writeFile(filePath, content, 'utf-8');

    const tf = {
        id,
        projectId,
        filename,
        filePath,
        type,
        language: req.body.language || 'javascript',
        description: req.body.description || '',
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    db.testFiles.push(tf);
    await saveDb(db);
    res.status(201).json(tf);
});

app.put('/api/test-files/:id', async (req, res) => {
    const db = await loadDb();
    const idx = db.testFiles.findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Test file not found' });

    const f = db.testFiles[idx];
    if (req.body.content !== undefined) {
        f.content = req.body.content;
        // Write to disk
        if (f.filePath) {
            await fs.ensureDir(path.dirname(f.filePath));
            await fs.writeFile(f.filePath, req.body.content, 'utf-8');
        }
    }
    db.testFiles[idx] = { ...f, ...req.body, updatedAt: new Date().toISOString() };
    await saveDb(db);
    res.json(db.testFiles[idx]);
});

app.delete('/api/test-files/:id', async (req, res) => {
    const db = await loadDb();
    const f = db.testFiles.find(x => x.id === req.params.id);
    if (f && f.filePath && await fs.pathExists(f.filePath)) {
        await fs.remove(f.filePath);
    }
    db.testFiles = db.testFiles.filter(x => x.id !== req.params.id);
    await saveDb(db);
    res.json({ message: 'Deleted' });
});

// ── Test Runs API ──

app.get('/api/test-runs', async (req, res) => {
    const db = await loadDb();
    let runs = db.testRuns;
    if (req.query.projectId) runs = runs.filter(r => r.projectId === req.query.projectId);
    // Return without full output to save bandwidth, but include enough for test parsing
    res.json(runs.map(r => ({ ...r, output: undefined, outputPreview: (r.output || '').slice(0, 2000) })));
});

app.get('/api/test-runs/:id', async (req, res) => {
    const db = await loadDb();
    const run = db.testRuns.find(x => x.id === req.params.id);
    if (!run) return res.status(404).json({ error: 'Test run not found' });
    res.json(run);
});

// Run tests
app.post('/api/test-runs', async (req, res) => {
    const db = await loadDb();
    const runId = uuidv4();
    const fileId = req.body.fileId;
    const projectId = req.body.projectId || null;
    const type = req.body.type || 'api'; // api, ui, unit, all
    // SECURITY: command field removed — commands are built server-side only

    let cmd;
    let targetPath;

    if (type === 'all') {
        // Run all test types
        cmd = `npx playwright test "${TESTS_DIR}" --reporter=list 2>&1; node --test "${path.join(TESTS_DIR, 'unit')}" 2>&1 || true`;
    } else if (fileId) {
        // Run specific file
        const f = db.testFiles.find(x => x.id === fileId);
        if (!f) return res.status(404).json({ error: 'Test file not found' });
        targetPath = f.filePath;
        if (f.type === 'unit') {
            cmd = `node --test "${f.filePath}"`;
        } else {
            cmd = `npx playwright test "${f.filePath}" --reporter=list`;
        }
    } else if (projectId) {
        // Run all tests for a project
        const projDir = path.join(TESTS_DIR, 'projects', projectId);
        if (await fs.pathExists(projDir)) {
            cmd = `npx playwright test "${projDir}" --reporter=list`;
        } else {
            cmd = `echo "No test files found for project"`;
        }
    } else {
        // Run by type
        const typeDir = path.join(TESTS_DIR, type);
        if (type === 'unit') {
            cmd = `node --test "${typeDir}/"`;
        } else {
            cmd = `npx playwright test "${typeDir}/" --reporter=list`;
        }
    }

    const run = {
        id: runId,
        projectId,
        fileId: fileId || null,
        type,
        command: cmd,
        status: 'running',
        output: '',
        results: { total: 0, passed: 0, failed: 0, skipped: 0 },
        startedAt: new Date().toISOString(),
        completedAt: null,
        duration: null
    };

    db.testRuns.unshift(run);
    if (db.testRuns.length > 100) db.testRuns.splice(100);
    await saveDb(db);

    res.status(201).json(run);

    // Run async
    const startTime = Date.now();
    try {
        const proc = spawn('sh', ['-c', cmd], {
            cwd: __dirname,
            timeout: 120000,
            env: { ...process.env, FORCE_COLOR: '0', CI: '1' }
        });

        let output = '';
        proc.stdout.on('data', (d) => { output += d.toString(); });
        proc.stderr.on('data', (d) => { output += d.toString(); });

        proc.on('close', async (code) => {
            const db2 = await loadDb();
            const r = db2.testRuns.find(x => x.id === runId);
            if (!r) return;

            r.output = output;
            r.status = code === 0 ? 'passed' : 'failed';
            r.completedAt = new Date().toISOString();
            r.duration = Date.now() - startTime;
            r.results = parseTestResults(output);

            await saveDb(db2);
        });
    } catch (err) {
        const db2 = await loadDb();
        const r = db2.testRuns.find(x => x.id === runId);
        if (r) {
            r.output = err.message;
            r.status = 'error';
            r.completedAt = new Date().toISOString();
            r.duration = Date.now() - startTime;
            await saveDb(db2);
        }
    }
});

function parseTestResults(output) {
    const results = { total: 0, passed: 0, failed: 0, skipped: 0 };

    // Playwright format: "X passed", "X failed", "X skipped"
    const passedMatch = output.match(/(\d+) passed/);
    const failedMatch = output.match(/(\d+) failed/);
    const skippedMatch = output.match(/(\d+) skipped/);

    if (passedMatch) results.passed = parseInt(passedMatch[1]);
    if (failedMatch) results.failed = parseInt(failedMatch[1]);
    if (skippedMatch) results.skipped = parseInt(skippedMatch[1]);
    results.total = results.passed + results.failed + results.skipped;

    // Node test runner format
    if (results.total === 0) {
        const nodePass = output.match(/# pass (\d+)/);
        const nodeFail = output.match(/# fail (\d+)/);
        if (nodePass) results.passed = parseInt(nodePass[1]);
        if (nodeFail) results.failed = parseInt(nodeFail[1]);
        results.total = results.passed + results.failed;
    }

    return results;
}

// ── Resources API ──

app.get('/api/resources', async (req, res) => {
    const db = await loadDb();
    let resources = db.resources || [];
    if (req.query.type) resources = resources.filter(r => r.type === req.query.type);
    if (req.query.projectId) resources = resources.filter(r => r.projectId === req.query.projectId);
    if (req.query.tag) resources = resources.filter(r => (r.tags || []).includes(req.query.tag));
    res.json(resources);
});

app.get('/api/resources/:id', async (req, res) => {
    const db = await loadDb();
    const r = (db.resources || []).find(x => x.id === req.params.id);
    if (!r) return res.status(404).json({ error: 'Resource not found' });
    res.json(r);
});

app.post('/api/resources', async (req, res) => {
    const db = await loadDb();
    if (!db.resources) db.resources = [];
    const resource = {
        id: uuidv4(),
        name: req.body.name,
        type: req.body.type || 'note', // credential, endpoint, doc, env, note
        projectId: req.body.projectId || null,
        entries: req.body.entries || [], // [{key, value}]
        content: req.body.content || '',
        tags: req.body.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    if (!resource.name) return res.status(400).json({ error: 'Name required' });
    db.resources.push(resource);
    await saveDb(db);
    res.status(201).json(resource);
});

app.put('/api/resources/:id', async (req, res) => {
    const db = await loadDb();
    if (!db.resources) db.resources = [];
    const idx = db.resources.findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Resource not found' });
    db.resources[idx] = { ...db.resources[idx], ...req.body, updatedAt: new Date().toISOString() };
    await saveDb(db);
    res.json(db.resources[idx]);
});

app.delete('/api/resources/:id', async (req, res) => {
    const db = await loadDb();
    if (!db.resources) db.resources = [];
    db.resources = db.resources.filter(x => x.id !== req.params.id);
    await saveDb(db);
    res.json({ message: 'Deleted' });
});

// ── Stats ──

app.get('/api/stats', async (req, res) => {
    const db = await loadDb();
    const projectId = req.query.projectId;
    let cases = db.testCases;
    let files = db.testFiles;
    let runs = db.testRuns;

    if (projectId) {
        cases = cases.filter(c => c.projectId === projectId);
        files = files.filter(f => f.projectId === projectId);
        runs = runs.filter(r => r.projectId === projectId);
    }

    const lastRun = runs[0];
    res.json({
        projects: db.projects.length,
        testCases: { total: cases.length, byType: countBy(cases, 'type'), byStatus: countBy(cases, 'status'), byPriority: countBy(cases, 'priority') },
        testFiles: { total: files.length, byType: countBy(files, 'type') },
        testRuns: { total: runs.length, passed: runs.filter(r => r.status === 'passed').length, failed: runs.filter(r => r.status === 'failed').length },
        lastRun: lastRun ? { id: lastRun.id, status: lastRun.status, completedAt: lastRun.completedAt, results: lastRun.results } : null
    });
});

function countBy(arr, key) {
    return arr.reduce((acc, item) => { acc[item[key]] = (acc[item[key]] || 0) + 1; return acc; }, {});
}

// ── Config API (PIN, settings) ──

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

async function loadConfig() {
    try { return await fs.readJson(CONFIG_FILE); }
    catch { return {}; }
}

async function saveConfig(config) {
    await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
}

app.get('/api/config', async (req, res) => {
    const config = await loadConfig();
    // SECURITY: Never expose PIN in plaintext — return only whether it's set
    const { pin, pinHash, ...safeConfig } = config;
    safeConfig.pinEnabled = !!(pin || pinHash);
    res.json(safeConfig);
});

// Server-side PIN verification
app.post('/api/verify-pin', async (req, res) => {
    const config = await loadConfig();
    const entered = req.body.pin;
    if (!entered || typeof entered !== 'string') return res.status(400).json({ error: 'PIN required' });

    const storedHash = config.pinHash;
    const storedPin = config.pin; // legacy support

    // Check hashed pin first, then legacy plaintext
    const enteredHash = crypto.createHash('sha256').update(entered).digest('hex');
    if (storedHash && enteredHash === storedHash) {
        return res.json({ success: true });
    }
    if (storedPin && entered === storedPin) {
        // Migrate legacy pin to hash
        config.pinHash = enteredHash;
        delete config.pin;
        await saveConfig(config);
        return res.json({ success: true });
    }
    res.status(401).json({ success: false, error: 'Wrong PIN' });
});

app.put('/api/config', async (req, res) => {
    const config = await loadConfig();
    const { pin, ...otherFields } = req.body;

    // Handle PIN update
    if (pin !== undefined) {
        if (pin === null) {
            // Disable PIN
            delete config.pin;
            delete config.pinHash;
        } else {
            // Set new PIN — store only hash
            config.pinHash = crypto.createHash('sha256').update(pin).digest('hex');
            delete config.pin; // remove any legacy plaintext
        }
    }

    Object.assign(config, otherFields);
    // Clean null values
    for (const k of Object.keys(config)) {
        if (config[k] === null) delete config[k];
    }
    await saveConfig(config);
    // Return safe config
    const { pin: _p, pinHash: _h, ...safeConfig } = config;
    safeConfig.pinEnabled = !!config.pinHash;
    res.json(safeConfig);
});

// ── Health ──

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Static files + SPA fallback (AFTER API routes)
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
    await ensureDataDir();
    app.listen(PORT, () => console.log(`🧪 QA Dashboard on port ${PORT}`));
}

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
start();
