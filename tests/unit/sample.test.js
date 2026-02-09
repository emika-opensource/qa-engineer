const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('Sample Unit Tests', () => {
    it('basic math works', () => {
        assert.strictEqual(2 + 2, 4);
    });

    it('string concatenation', () => {
        assert.strictEqual('hello' + ' ' + 'world', 'hello world');
    });

    it('array includes', () => {
        const arr = ['api', 'ui', 'unit'];
        assert.ok(arr.includes('api'));
        assert.ok(!arr.includes('integration'));
    });

    it('object equality', () => {
        const result = { status: 'passed', count: 3 };
        assert.deepStrictEqual(result, { status: 'passed', count: 3 });
    });
});
