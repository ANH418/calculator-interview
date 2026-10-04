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

// 5. 对数 log10
/**
 * 常用对数 log10
 * @param {number} x 输入数字
 * @returns {number|string} 以10为底的对数，x<=0 返回非法输入
 */
function log10(x) {
    if (x <= 0) {
        return "非法输入";
    }
    const res = Math.log10(x);
    return Number(res.toPrecision(10));
}

// 6. 10的x次方
/**
 * 10的x次方
 * @param {number} x 指数
 * @returns {number} 10^x计算结果
 */
function pow10(x) {
    const res = Math.pow(10, x);
    return Number(res.toPrecision(10));
}

// 计算状态
const INITIAL = '0';
const ERROR_TEXT = '错误';

let text = INITIAL;
let acc = null;
let pendingOp = null;
let waiting = false;

function show() {
    displayMain.textContent = text;
}

function showSub(line) {
    displaySub.textContent = line || '';
}

function isError() {
    return text === ERROR_TEXT;
}

function clearState() {
    acc = null;
    pendingOp = null;
    waiting = false;
}

// 运算符映射
const OPERATORS = {
    '+': add,
    '-': (a, b) => a - b,
    '×': (a, b) => a * b,
    '÷': (a, b) => a / b,
};

function formatResult(n) {
    if (!Number.isFinite(n)) {
        return ERROR_TEXT;
    }
    if (Number.isInteger(n)) {
        return String(n);
    }
    return String(Number(n.toPrecision(12)));
}
