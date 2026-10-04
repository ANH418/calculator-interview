const displayMain = document.getElementById('display-main');
const displaySub = document.getElementById('display-sub');
const keyboard = document.getElementById('keyboard');

// 获取历史记录列表容器
const historyList = document.getElementById('history-list');

// 获取历史记录面板（只用来挂「清空」按钮，DOM 结构不改）
const historyPanel = document.getElementById('history-panel');

/**
 * 加法：把两个数相加。
 * @param {number} a 加数
 * @param {number} b 被加数
 * @returns {number} 两数之和
 */
function add(a, b) {
    return a + b;
}

// 2. 减法
function subtract(a, b) {
    return a - b;
}

// 3. 乘法
function multiply(a, b) {
    return a * b;
}

// 4. 除法
function divide(a, b) {
    if (b === 0) {
        return ERROR_TEXT;
    }
    return a / b;
}
