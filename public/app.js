// QA Dashboard App

class QADashboard {
    constructor() {
        this.projects = [];
        this.testCases = [];
        this.testFiles = [];
        this.testRuns = [];
        this.currentView = 'dashboard';
        this.editingFileId = null;
        this.editingTcId = null;
        this.init();
    }

    async init() {
        this.setupNav();
        this.setupModals();
        this.setupCodeViewer();
        this.setupRunDetail();
        await this.loadAll();
        this.renderCurrentView();
    }

    // ── Navigation ──

    setupNav() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchView(btn.dataset.view);
            });
        });
    }

    switchView(view) {
        this.currentView = view;
        document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
        document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
        document.getElementById('code-viewer').style.display = 'none';
        document.getElementById('run-detail').style.display = 'none';
        this.renderCurrentView();
    }

    async renderCurrentView() {
        await this.loadAll();
        switch (this.currentView) {
            case 'dashboard': this.renderDashboard(); break;
            case 'projects': this.renderProjects(); break;
            case 'test-cases': this.renderTestCases(); break;
            case 'test-files': this.renderTestFiles(); break;
            case 'test-runs': this.renderTestRuns(); break;
        }
        this.renderSidebarStats();
    }

    // ── Data ──

    async loadAll() {
        const [projects, testCases, testFiles, testRuns] = await Promise.all([
            this.api('GET', '/api/projects'),
            this.api('GET', '/api/test-cases'),
            this.api('GET', '/api/test-files'),
            this.api('GET', '/api/test-runs')
        ]);
        this.projects = projects || [];
        this.testCases = testCases || [];
        this.testFiles = testFiles || [];
        this.testRuns = testRuns || [];
    }

    async api(method, url, body) {
        try {
            const opts = { method, headers: { 'Content-Type': 'application/json' } };
            if (body) opts.body = JSON.stringify(body);
            const r = await fetch(url, opts);
            return r.ok ? await r.json() : null;
        } catch { return null; }
    }

    // ── Dashboard ──

    renderDashboard() {
        const grid = document.getElementById('dashboard-grid');
        const totalRuns = this.testRuns.length;
        const passedRuns = this.testRuns.filter(r => r.status === 'passed').length;
        const failedRuns = this.testRuns.filter(r => r.status === 'failed').length;
        const lastRun = this.testRuns[0];
        const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;

        grid.innerHTML = `
            <div class="stat-card">
                <div class="stat-card-label">Projects</div>
                <div class="stat-card-value">${this.projects.length}</div>
                <div class="stat-card-sub">${this.projects.filter(p => p.type === 'api').length} API · ${this.projects.filter(p => p.type === 'ui').length} UI · ${this.projects.filter(p => p.type === 'mixed').length} Mixed</div>
            </div>
            <div class="stat-card blue">
                <div class="stat-card-label">Test Cases</div>
                <div class="stat-card-value">${this.testCases.length}</div>
                <div class="stat-card-sub">${this.testCases.filter(t => t.status === 'automated').length} automated · ${this.testCases.filter(t => t.status === 'draft').length} draft</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-label">Test Files</div>
                <div class="stat-card-value">${this.testFiles.length}</div>
                <div class="stat-card-sub">${this.testFiles.filter(f => f.type === 'api').length} API · ${this.testFiles.filter(f => f.type === 'ui').length} UI · ${this.testFiles.filter(f => f.type === 'unit').length} Unit</div>
            </div>
            <div class="stat-card ${passRate >= 80 ? 'green' : passRate >= 50 ? 'amber' : 'red'}">
                <div class="stat-card-label">Pass Rate</div>
                <div class="stat-card-value">${passRate}%</div>
                <div class="stat-card-sub">${passedRuns} passed · ${failedRuns} failed of ${totalRuns} runs</div>
            </div>
            <div class="stat-card ${lastRun?.status === 'passed' ? 'green' : lastRun?.status === 'failed' ? 'red' : ''}">
                <div class="stat-card-label">Last Run</div>
                <div class="stat-card-value">${lastRun ? this.statusIcon(lastRun.status) : '—'}</div>
                <div class="stat-card-sub">${lastRun ? this.timeAgo(lastRun.completedAt || lastRun.startedAt) + (lastRun.duration ? ` · ${(lastRun.duration / 1000).toFixed(1)}s` : '') : 'No runs yet'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-label">Total Test Runs</div>
                <div class="stat-card-value">${totalRuns}</div>
                <div class="stat-card-sub">Lifetime executions</div>
            </div>
        `;
    }

    renderSidebarStats() {
        const el = document.getElementById('sidebar-stats');
        const passed = this.testRuns.filter(r => r.status === 'passed').length;
        const failed = this.testRuns.filter(r => r.status === 'failed').length;
        el.innerHTML = `
            <span>${this.projects.length} projects · ${this.testFiles.length} files</span>
            <span style="color:var(--green)">${passed} passed</span>
            ${failed > 0 ? `<span style="color:var(--red)">${failed} failed</span>` : ''}
        `;
    }

    // ── Projects ──

    renderProjects() {
        const list = document.getElementById('projects-list');
        if (!this.projects.length) {
            list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📁</div><div class="empty-state-text">No projects yet. Create one to get started.</div></div>';
            return;
        }
        list.innerHTML = this.projects.map(p => {
            const cases = this.testCases.filter(t => t.projectId === p.id).length;
            const files = this.testFiles.filter(f => f.projectId === p.id).length;
            const runs = this.testRuns.filter(r => r.projectId === p.id);
            const lastRun = runs[0];
            return `
                <div class="list-item" data-project-id="${p.id}">
                    <div class="list-item-icon">${this.typeIcon(p.type)}</div>
                    <div class="list-item-body">
                        <div class="list-item-title">${this.esc(p.name)}</div>
                        <div class="list-item-sub">${this.esc(p.description || p.baseUrl || 'No description')}</div>
                    </div>
                    <div class="list-item-meta">
                        <span class="tag tag-${p.type}">${p.type.toUpperCase()}</span>
                        <span style="color:var(--text-dim);font-size:12px">${cases} cases · ${files} files</span>
                        ${lastRun ? `<span class="tag tag-${lastRun.status}">${lastRun.status}</span>` : ''}
                    </div>
                    <div class="list-item-actions">
                        <button class="btn btn-accent btn-sm run-project-btn" data-id="${p.id}" title="Run all tests">▶</button>
                        <button class="btn btn-danger btn-sm delete-project-btn" data-id="${p.id}" title="Delete">✕</button>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.run-project-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.runTests({ projectId: btn.dataset.id });
            });
        });

        list.querySelectorAll('.delete-project-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('Delete this project and all its tests?')) return;
                await this.api('DELETE', `/api/projects/${btn.dataset.id}`);
                await this.renderCurrentView();
            });
        });
    }

    // ── Test Cases ──

    renderTestCases() {
        const list = document.getElementById('test-cases-list');
        this.updateProjectSelects();

        let cases = [...this.testCases];
        const filterProject = document.getElementById('tc-filter-project').value;
        const filterType = document.getElementById('tc-filter-type').value;
        if (filterProject) cases = cases.filter(c => c.projectId === filterProject);
        if (filterType) cases = cases.filter(c => c.type === filterType);

        if (!cases.length) {
            list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No test cases yet.</div></div>';
            return;
        }

        list.innerHTML = cases.map(tc => {
            const proj = this.projects.find(p => p.id === tc.projectId);
            return `
                <div class="list-item" data-tc-id="${tc.id}">
                    <div class="list-item-icon"><span class="pri-dot ${tc.priority}"></span></div>
                    <div class="list-item-body">
                        <div class="list-item-title">${this.esc(tc.title)}</div>
                        <div class="list-item-sub">${proj ? this.esc(proj.name) + ' · ' : ''}${tc.steps?.length || 0} steps${tc.automated ? ' · ✅ Automated' : ''}</div>
                    </div>
                    <div class="list-item-meta">
                        <span class="tag tag-${tc.type}">${tc.type.toUpperCase()}</span>
                        <span class="tag tag-${tc.status}">${tc.status}</span>
                        ${tc.lastResult ? `<span class="tag tag-${tc.lastResult}">${tc.lastResult}</span>` : ''}
                    </div>
                    <div class="list-item-actions">
                        <button class="btn btn-ghost btn-sm edit-tc-btn" data-id="${tc.id}">Edit</button>
                        <button class="btn btn-danger btn-sm delete-tc-btn" data-id="${tc.id}">✕</button>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.edit-tc-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tc = this.testCases.find(t => t.id === btn.dataset.id);
                if (tc) this.openTestCaseModal(tc);
            });
        });

        list.querySelectorAll('.delete-tc-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('Delete this test case?')) return;
                await this.api('DELETE', `/api/test-cases/${btn.dataset.id}`);
                await this.renderCurrentView();
            });
        });
    }

    // ── Test Files ──

    renderTestFiles() {
        const list = document.getElementById('test-files-list');
        let files = [...this.testFiles];
        const filterType = document.getElementById('tf-filter-type').value;
        if (filterType) files = files.filter(f => f.type === filterType);

        if (!files.length) {
            list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💻</div><div class="empty-state-text">No test files yet.</div></div>';
            return;
        }

        list.innerHTML = files.map(f => {
            const proj = this.projects.find(p => p.id === f.projectId);
            return `
                <div class="list-item" data-file-id="${f.id}">
                    <div class="list-item-icon">📄</div>
                    <div class="list-item-body">
                        <div class="list-item-title">${this.esc(f.filename)}</div>
                        <div class="list-item-sub">${proj ? this.esc(proj.name) + ' · ' : ''}${this.esc(f.description || f.contentPreview || '')}</div>
                    </div>
                    <div class="list-item-meta">
                        <span class="tag tag-${f.type}">${f.type.toUpperCase()}</span>
                    </div>
                    <div class="list-item-actions">
                        <button class="btn btn-ghost btn-sm open-file-btn" data-id="${f.id}">Open</button>
                        <button class="btn btn-accent btn-sm run-file-btn" data-id="${f.id}">▶</button>
                        <button class="btn btn-danger btn-sm delete-file-btn" data-id="${f.id}">✕</button>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.open-file-btn, .list-item[data-file-id]').forEach(el => {
            const handler = async (e) => {
                if (e.target.closest('.run-file-btn, .delete-file-btn')) return;
                const id = el.dataset.id || el.dataset.fileId;
                await this.openCodeViewer(id);
            };
            el.addEventListener('click', handler);
        });

        list.querySelectorAll('.run-file-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.runTests({ fileId: btn.dataset.id });
            });
        });

        list.querySelectorAll('.delete-file-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('Delete this test file?')) return;
                await this.api('DELETE', `/api/test-files/${btn.dataset.id}`);
                await this.renderCurrentView();
            });
        });
    }

    // ── Test Runs ──

    renderTestRuns() {
        const list = document.getElementById('test-runs-list');
        if (!this.testRuns.length) {
            list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">▶️</div><div class="empty-state-text">No test runs yet. Run some tests to see results.</div></div>';
            return;
        }

        list.innerHTML = this.testRuns.map(r => {
            const file = this.testFiles.find(f => f.id === r.fileId);
            const proj = this.projects.find(p => p.id === r.projectId);
            const res = r.results || {};
            return `
                <div class="list-item" data-run-id="${r.id}">
                    <div class="list-item-icon">${this.statusIcon(r.status)}</div>
                    <div class="list-item-body">
                        <div class="list-item-title">${file ? this.esc(file.filename) : proj ? this.esc(proj.name) : r.type + ' tests'}</div>
                        <div class="list-item-sub">${res.total > 0 ? `${res.passed} passed · ${res.failed} failed${res.skipped ? ` · ${res.skipped} skipped` : ''}` : r.outputPreview || 'Running...'}</div>
                    </div>
                    <div class="list-item-meta">
                        <span class="tag tag-${r.status}">${r.status}</span>
                        ${r.duration ? `<span style="color:var(--text-dim);font-size:12px">${(r.duration / 1000).toFixed(1)}s</span>` : ''}
                        <span style="color:var(--text-dim);font-size:12px">${this.timeAgo(r.startedAt)}</span>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.list-item[data-run-id]').forEach(el => {
            el.addEventListener('click', () => this.openRunDetail(el.dataset.runId));
        });
    }

    async runTests(opts) {
        const run = await this.api('POST', '/api/test-runs', opts);
        if (run) {
            this.switchView('test-runs');
            // Poll for completion
            this.pollRun(run.id);
        }
    }

    async pollRun(runId) {
        const check = async () => {
            const run = await this.api('GET', `/api/test-runs/${runId}`);
            if (!run) return;
            if (run.status === 'running') {
                setTimeout(check, 2000);
            }
            if (this.currentView === 'test-runs') this.renderTestRuns();
        };
        setTimeout(check, 2000);
    }

    // ── Code Viewer ──

    setupCodeViewer() {
        document.getElementById('code-close-btn').addEventListener('click', () => {
            document.getElementById('code-viewer').style.display = 'none';
            this.editingFileId = null;
        });

        document.getElementById('code-save-btn').addEventListener('click', () => this.saveCodeFile());
        document.getElementById('code-run-btn').addEventListener('click', () => {
            if (this.editingFileId) this.runTests({ fileId: this.editingFileId });
        });

        const editor = document.getElementById('code-editor');
        editor.addEventListener('input', () => this.updateLineNumbers());
        editor.addEventListener('scroll', () => {
            document.getElementById('line-numbers').scrollTop = editor.scrollTop;
        });
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = editor.selectionStart;
                editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(editor.selectionEnd);
                editor.selectionStart = editor.selectionEnd = start + 2;
            }
            if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                this.saveCodeFile();
            }
        });
    }

    async openCodeViewer(fileId) {
        const file = await this.api('GET', `/api/test-files/${fileId}`);
        if (!file) return;
        this.editingFileId = fileId;
        document.getElementById('code-viewer-filename').textContent = file.filename;
        document.getElementById('code-viewer-type').textContent = file.type.toUpperCase();
        document.getElementById('code-editor').value = file.content || '';
        document.getElementById('code-viewer').style.display = 'flex';
        this.updateLineNumbers();
    }

    updateLineNumbers() {
        const editor = document.getElementById('code-editor');
        const lines = editor.value.split('\n').length;
        const nums = document.getElementById('line-numbers');
        nums.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
    }

    async saveCodeFile() {
        if (!this.editingFileId) return;
        const content = document.getElementById('code-editor').value;
        await this.api('PUT', `/api/test-files/${this.editingFileId}`, { content });
    }

    // ── Run Detail ──

    setupRunDetail() {
        document.getElementById('run-detail-close').addEventListener('click', () => {
            document.getElementById('run-detail').style.display = 'none';
        });

        document.getElementById('run-all-btn').addEventListener('click', () => {
            this.runTests({ type: 'api' });
        });
    }

    async openRunDetail(runId) {
        const run = await this.api('GET', `/api/test-runs/${runId}`);
        if (!run) return;
        document.getElementById('run-detail-status').innerHTML = `<span class="tag tag-${run.status}">${run.status.toUpperCase()}</span>`;
        document.getElementById('run-detail-info').textContent = run.command || '';
        const res = run.results || {};
        document.getElementById('run-detail-stats').innerHTML = `
            <div class="run-stat"><div class="run-stat-label">Total</div><div class="run-stat-value">${res.total}</div></div>
            <div class="run-stat"><div class="run-stat-label">Passed</div><div class="run-stat-value" style="color:var(--green)">${res.passed}</div></div>
            <div class="run-stat"><div class="run-stat-label">Failed</div><div class="run-stat-value" style="color:var(--red)">${res.failed}</div></div>
            <div class="run-stat"><div class="run-stat-label">Duration</div><div class="run-stat-value">${run.duration ? (run.duration / 1000).toFixed(1) + 's' : '—'}</div></div>
        `;
        document.getElementById('run-output').textContent = run.output || 'No output';
        document.getElementById('run-detail').style.display = 'flex';
    }

    // ── Modals ──

    setupModals() {
        // Project modal
        document.getElementById('add-project-btn').addEventListener('click', () => this.openProjectModal());
        document.getElementById('project-modal-close').addEventListener('click', () => this.closeModal('project-modal'));
        document.getElementById('project-cancel').addEventListener('click', () => this.closeModal('project-modal'));
        document.getElementById('project-save').addEventListener('click', () => this.saveProject());
        document.querySelectorAll('#project-type-picker .type-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#project-type-picker .type-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });

        // Test case modal
        document.getElementById('add-test-case-btn').addEventListener('click', () => this.openTestCaseModal());
        document.getElementById('tc-modal-close').addEventListener('click', () => this.closeModal('tc-modal'));
        document.getElementById('tc-cancel').addEventListener('click', () => this.closeModal('tc-modal'));
        document.getElementById('tc-save').addEventListener('click', () => this.saveTestCase());
        document.getElementById('tc-delete').addEventListener('click', () => this.deleteTestCase());
        document.querySelectorAll('#tc-priority-picker .priority-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#tc-priority-picker .priority-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });

        // Test file modal
        document.getElementById('add-test-file-btn').addEventListener('click', () => this.openTestFileModal());
        document.getElementById('tf-modal-close').addEventListener('click', () => this.closeModal('tf-modal'));
        document.getElementById('tf-cancel').addEventListener('click', () => this.closeModal('tf-modal'));
        document.getElementById('tf-save').addEventListener('click', () => this.saveTestFile());

        // Filter change listeners
        document.getElementById('tc-filter-project').addEventListener('change', () => this.renderTestCases());
        document.getElementById('tc-filter-type').addEventListener('change', () => this.renderTestCases());
        document.getElementById('tf-filter-type').addEventListener('change', () => this.renderTestFiles());

        // Close modals on backdrop click
        document.querySelectorAll('.modal').forEach(m => {
            m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('show'); });
        });

        // Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
                document.getElementById('code-viewer').style.display = 'none';
                document.getElementById('run-detail').style.display = 'none';
            }
        });
    }

    closeModal(id) { document.getElementById(id).classList.remove('show'); }

    openProjectModal() {
        document.getElementById('project-name').value = '';
        document.getElementById('project-desc').value = '';
        document.getElementById('project-url').value = '';
        document.querySelectorAll('#project-type-picker .type-option').forEach(b => b.classList.toggle('selected', b.dataset.value === 'mixed'));
        document.getElementById('project-modal').classList.add('show');
        document.getElementById('project-name').focus();
    }

    async saveProject() {
        const name = document.getElementById('project-name').value.trim();
        if (!name) return;
        const type = document.querySelector('#project-type-picker .type-option.selected')?.dataset.value || 'mixed';
        await this.api('POST', '/api/projects', {
            name,
            description: document.getElementById('project-desc').value.trim(),
            baseUrl: document.getElementById('project-url').value.trim(),
            type
        });
        this.closeModal('project-modal');
        await this.renderCurrentView();
    }

    openTestCaseModal(tc = null) {
        this.editingTcId = tc?.id || null;
        document.getElementById('tc-modal-title').textContent = tc ? 'Edit Test Case' : 'New Test Case';
        document.getElementById('tc-delete').style.display = tc ? 'block' : 'none';
        this.updateProjectSelects();

        if (tc) {
            document.getElementById('tc-title').value = tc.title;
            document.getElementById('tc-desc').value = tc.description || '';
            document.getElementById('tc-project').value = tc.projectId || '';
            document.getElementById('tc-type').value = tc.type || 'api';
            document.getElementById('tc-steps').value = (tc.steps || []).join('\n');
            document.getElementById('tc-expected').value = tc.expectedResult || '';
            document.querySelectorAll('#tc-priority-picker .priority-option').forEach(b => b.classList.toggle('selected', b.dataset.value === (tc.priority || 'medium')));
        } else {
            document.getElementById('tc-title').value = '';
            document.getElementById('tc-desc').value = '';
            document.getElementById('tc-steps').value = '';
            document.getElementById('tc-expected').value = '';
            document.querySelectorAll('#tc-priority-picker .priority-option').forEach(b => b.classList.toggle('selected', b.dataset.value === 'medium'));
        }
        document.getElementById('tc-modal').classList.add('show');
        document.getElementById('tc-title').focus();
    }

    async saveTestCase() {
        const title = document.getElementById('tc-title').value.trim();
        if (!title) return;
        const priority = document.querySelector('#tc-priority-picker .priority-option.selected')?.dataset.value || 'medium';
        const stepsText = document.getElementById('tc-steps').value.trim();
        const steps = stepsText ? stepsText.split('\n').filter(s => s.trim()) : [];

        const data = {
            title,
            description: document.getElementById('tc-desc').value.trim(),
            projectId: document.getElementById('tc-project').value || null,
            type: document.getElementById('tc-type').value,
            priority,
            steps,
            expectedResult: document.getElementById('tc-expected').value.trim()
        };

        if (this.editingTcId) {
            await this.api('PUT', `/api/test-cases/${this.editingTcId}`, data);
        } else {
            await this.api('POST', '/api/test-cases', data);
        }
        this.closeModal('tc-modal');
        this.editingTcId = null;
        await this.renderCurrentView();
    }

    async deleteTestCase() {
        if (!this.editingTcId || !confirm('Delete this test case?')) return;
        await this.api('DELETE', `/api/test-cases/${this.editingTcId}`);
        this.closeModal('tc-modal');
        this.editingTcId = null;
        await this.renderCurrentView();
    }

    openTestFileModal() {
        this.updateProjectSelects();
        document.getElementById('tf-filename').value = '';
        document.getElementById('tf-desc').value = '';
        document.getElementById('tf-modal').classList.add('show');
        document.getElementById('tf-filename').focus();
    }

    async saveTestFile() {
        const filename = document.getElementById('tf-filename').value.trim();
        if (!filename) return;
        const type = document.getElementById('tf-type').value;
        const projectId = document.getElementById('tf-project').value || null;

        // Generate template content
        let content;
        if (type === 'unit') {
            content = `const { describe, it } = require('node:test');\nconst assert = require('node:assert');\n\ndescribe('${filename.replace(/\.[^.]+$/, '')}', () => {\n  it('should work', () => {\n    assert.strictEqual(1 + 1, 2);\n  });\n});\n`;
        } else if (type === 'ui') {
            content = `const { test, expect } = require('@playwright/test');\n\ntest.describe('${filename.replace(/\.[^.]+$/, '')}', () => {\n  test('should load page', async ({ page }) => {\n    await page.goto('http://localhost:3000');\n    await expect(page).toHaveTitle(/QA Dashboard/);\n  });\n});\n`;
        } else {
            content = `const { test, expect } = require('@playwright/test');\n\nconst BASE_URL = process.env.API_URL || 'https://api.emika.ai';\n\ntest.describe('${filename.replace(/\.[^.]+$/, '')}', () => {\n  test('should return health check', async ({ request }) => {\n    const res = await request.get(\`\${BASE_URL}/health\`);\n    expect(res.ok()).toBeTruthy();\n  });\n});\n`;
        }

        const file = await this.api('POST', '/api/test-files', {
            filename,
            description: document.getElementById('tf-desc').value.trim(),
            projectId,
            type,
            content
        });

        this.closeModal('tf-modal');
        if (file) await this.openCodeViewer(file.id);
        await this.loadAll();
    }

    updateProjectSelects() {
        ['tc-project', 'tf-project', 'tc-filter-project'].forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const current = sel.value;
            const isFilter = id.includes('filter');
            sel.innerHTML = isFilter ? '<option value="">All Projects</option>' : '<option value="">No Project</option>';
            this.projects.forEach(p => {
                sel.innerHTML += `<option value="${p.id}">${this.esc(p.name)}</option>`;
            });
            sel.value = current;
        });
    }

    // ── Helpers ──

    esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

    typeIcon(type) {
        return { api: '🔌', ui: '🖥️', unit: '⚙️', mixed: '🔀' }[type] || '📁';
    }

    statusIcon(status) {
        return { passed: '✅', failed: '❌', running: '🔄', error: '⚠️' }[status] || '—';
    }

    timeAgo(dateStr) {
        if (!dateStr) return '';
        const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }
}

document.addEventListener('DOMContentLoaded', () => { window.qa = new QADashboard(); });
