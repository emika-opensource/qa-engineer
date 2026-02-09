// Demo: Emika API Tests
// This file demonstrates API testing patterns for the QA Engineer AI Employee

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.API_URL || 'https://api.emika.ai';

test.describe('Emika API — Health & Auth', () => {

    test('GET / — API root should respond', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/`);
        expect(res.status()).toBeLessThan(500);
    });

    test('GET /docs — Swagger docs should be accessible', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/docs`);
        expect(res.status()).toBe(200);
    });

    test('POST /users/login — invalid credentials returns 401', async ({ request }) => {
        const res = await request.post(`${BASE_URL}/users/login`, {
            data: { email: 'nonexistent@test.com', password: 'wrongpassword' }
        });
        expect(res.status()).toBe(401);
    });

    test('GET /users/me — unauthenticated returns 401 or 403', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/users/me`);
        expect([401, 403]).toContain(res.status());
    });

    test('GET /inspiration/providers — public endpoint returns list', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/inspiration/providers?limit=10`);
        expect(res.ok()).toBeTruthy();
        const data = await res.json();
        expect(Array.isArray(data)).toBeTruthy();
    });

    test('POST /users/signup — missing fields returns 422', async ({ request }) => {
        const res = await request.post(`${BASE_URL}/users/signup`, {
            data: {}
        });
        expect(res.status()).toBe(422);
    });
});

test.describe('Emika API — Input Validation', () => {

    test('POST /users/login — empty body returns 422', async ({ request }) => {
        const res = await request.post(`${BASE_URL}/users/login`, {
            data: {}
        });
        expect(res.status()).toBe(422);
    });

    test('POST /users/forgot-password — invalid email format', async ({ request }) => {
        const res = await request.post(`${BASE_URL}/users/forgot-password`, {
            data: { email: 'not-an-email' }
        });
        // Should either 422 (validation) or 404 (not found) — not 500
        expect(res.status()).toBeLessThan(500);
    });

    test('GET /admin/stats — unauthenticated returns 401/403', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/admin/stats`);
        expect([401, 403]).toContain(res.status());
    });
});
