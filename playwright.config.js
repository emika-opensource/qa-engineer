const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 30000,
    retries: 0,
    reporter: [['list'], ['json', { outputFile: 'data/last-results.json' }]],
    use: {
        baseURL: process.env.API_URL || 'https://api.emika.ai',
        extraHTTPHeaders: {
            'Accept': 'application/json',
        },
    },
    projects: [
        { name: 'api', testDir: './tests/api' },
        { name: 'ui', testDir: './tests/ui', use: { browserName: 'chromium', headless: true } },
    ],
});
