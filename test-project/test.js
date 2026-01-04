// 簡單測試檔案
const { add, subtract, multiply, divide } = require('./src/broken.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (e) {
        console.log(`✗ ${name}: ${e.message}`);
        failed++;
    }
}

function assertEqual(actual, expected) {
    if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
    }
}

// 測試
test('add(2, 3) = 5', () => assertEqual(add(2, 3), 5));
test('subtract(5, 3) = 2', () => assertEqual(subtract(5, 3), 2));
test('multiply(4, 3) = 12', () => assertEqual(multiply(4, 3), 12));
test('divide(10, 2) = 5', () => assertEqual(divide(10, 2), 5));
test('divide by zero throws', () => {
    try {
        divide(10, 0);
        throw new Error('Should have thrown');
    } catch (e) {
        if (!e.message.includes('zero')) throw e;
    }
});

console.log(`\n結果: ${passed} passed, ${failed} failed`);

if (failed > 0) {
    process.exit(1);
}
