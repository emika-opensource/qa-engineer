const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { execSync, spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const TESTS_DIR = process.env.TESTS_DIR || path.join(__dirname, 'tests');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
        await fs.writeJson(dbFile, {
            projects: [],
            testCases: [],
            testRuns: [],
            testFiles: []
        }, { spaces: 2 });
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
    const filename = req.body.filename || `test_${id.slice(0, 8)}.spec.js`;
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
    const type = req.body.type || 'api'; // api, ui, unit, file, custom
    const command = req.body.command; // custom command

    let cmd;
    let targetPath;

    if (command) {
        // Custom command
        cmd = command;
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
