// 這個檔案有故意的錯誤，用於測試迴圈

function add(a, b) {
    return a + b
}

function subtract(a, b) {
    return a - b  // 缺少分號
}

function multiply(a, b) {
    reutrn a * b  // 拼寫錯誤: reutrn
}

function divide(a, b) {
    if (b = 0) {  // 錯誤: 應該是 ===
        throw new Error('Cannot divide by zero')
    }
    return a / b
}

module.exports = { add, subtract, multiply, divide }
