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

/**
 * 常用对数 log10
 * @param {number} x 输入数字
 * @returns {number|string} 以10为底的对数，x≤0返回非法输入
 */
function log10(x) {
  if (x <= 0) {
    return "非法输入";
  }
  const res = Math.log10(x);
  return Number(res.toPrecision(10));
}

/**
 * 10的x次方
 * @param {number} x 指数
 * @returns {number} 10^x计算结果
 */
function pow10(x) {
  const res = Math.pow(10, x);
  return Number(res.toPrecision(10));
}


// ---------------------------------------------------------------
// 计算状态
// ---------------------------------------------------------------
const INITIAL = '0';
const ERROR_TEXT = '错误';

let text = INITIAL;
let acc = null;
let pendingOp = null;
let waiting = false;
let memory = 0;

// 连算（连按 = 重复上次运算）：记住上一次求值的运算符与右操作数
let lastOp = null;
let lastRight = null;
let canRepeat = false;

// ---------------------------------------------------------------
// 主显示区字号自适应：位数多到装不下就逐像素缩小，缩到下限为止（#124）
// ---------------------------------------------------------------
const DISPLAY_FONT_BASE = parseFloat(getComputedStyle(displayMain).fontSize) || 32;
const DISPLAY_FONT_MIN = 14; // 最小字号：再长也不小于它，超出部分交给横向滚动

/** 先回到基准字号；装不下就逐像素缩小，直到不再溢出或触到最小字号。 */
function fitDisplayFont() {
  displayMain.style.fontSize = '';
  if (displayMain.scrollWidth <= displayMain.clientWidth) {
    return; // 装得下，保持样式表里的基准字号
  }
  for (let size = DISPLAY_FONT_BASE - 1; size >= DISPLAY_FONT_MIN; size -= 1) {
    displayMain.style.fontSize = `${size}px`;
    if (displayMain.scrollWidth <= displayMain.clientWidth) {
      return;
    }
  }
}

function show() {
  displayMain.textContent = text;
  fitDisplayFont();
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

// ---------------------------------------------------------------
// 运算符
// ---------------------------------------------------------------
const OPERATORS = {
  '+': add,
  '−': (a, b) => a - b,
  '×': (a, b) => a * b,
  '÷': (a, b) => a / b,
  'xʸ': (a, b) => Math.pow(a, b), // 任意次幂 xʸ
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

// [FIX] applyPending：acc 保存原始数值结果（保留精度），仅用 formatResult 做显示判断
function applyPending() {
  const right = Number(text);
  const result = OPERATORS[pendingOp](acc, right);
  const shown = formatResult(result);

  if (shown === ERROR_TEXT) {
    text = ERROR_TEXT;
    clearState();
    showSub('');
    show();
    return false;
  }

  acc = result;          // 保留原始数值，不截断精度
  return true;
}

// ---------------------------------------------------------------
// 按键行为
// ---------------------------------------------------------------
function inputDigit(digit) {
  if (isError()) {
    text = INITIAL;
  }
  canRepeat = false; // 开始新一轮数字输入，连算资格作废
  if (waiting) {
    text = digit;
    waiting = false;
  } else {
    text = text === INITIAL ? digit : text + digit;
  }
  show();
}

function inputDecimal() {
  if (isError()) {
    text = INITIAL;
  }
  canRepeat = false;
  if (waiting) {
    text = `${INITIAL}.`;
    waiting = false;
  } else if (!text.includes('.')) {
    text = text === INITIAL ? `${INITIAL}.` : `${text}.`;
  }
  show();
}

// [FIX] inputOperator：acc 保存原始数值，显示用 formatResult
function inputOperator(op) {
  if (isError()) {
    return;
  }
  canRepeat = false; // 选定新的运算符，旧的连算作废

  if (pendingOp !== null) {
    if (waiting) {
      pendingOp = op;
      showSub(`${formatResult(acc)} ${op}`);
      return;
    }
    if (!applyPending()) {
      return;
    }
    text = formatResult(acc);   // 仅显示格式化，acc 本身保持原始精度
    show();
  } else {
    acc = Number(text);
  }

  pendingOp = op;
  waiting = true;
  showSub(`${formatResult(acc)} ${op}`);
}

// [FIX] inputEquals：历史行用 formatResult(acc) 显示，不影响内部精度
function inputEquals() {
  if (isError()) {
    return;
  }

  if (pendingOp === null) {
    // 连算：没有新的待算运算时，若上次求值可重复，
    // 就复用那次的运算符和右操作数，对当前结果再算一次
    if (!canRepeat) {
      return;
    }
    acc = Number(text);
    pendingOp = lastOp;
    text = formatResult(lastRight);
  }

  const line = `${formatResult(acc)} ${pendingOp} ${text} =`;

  if (!applyPending()) {
    canRepeat = false; // 求值失败（如除零）进入错误态，连算资格作废
    return;
  }

  // 记住本次的运算符和右操作数，供下一次按 = 连算
  lastOp = pendingOp;
  lastRight = Number(text);
  canRepeat = true;

  text = formatResult(acc);

  recordHistory(line, text);

  clearState();
  parenStack.length = 0; // 未闭合的括号随本次求值一并作废
  waiting = true;
  showSub(line);
  show();
}

function inputBackspace() {
  if (isError()) {
    return;
  }
  // π 整体删除：当前显示的就是 π 的值时，一次退格全删
  if (text === PI_TEXT) {
    text = INITIAL;
    waiting = false;
    show();
    return;
  }
  if (waiting) {
    return;
  }

  text = text.slice(0, -1) || INITIAL;
  show();
}

function inputClearEntry() {
  text = INITIAL;
  waiting = false;
  canRepeat = false;

  if (pendingOp === null) {
    acc = null;
    showSub('');
  } else {
    showSub(`${formatResult(acc)} ${pendingOp}`);
  }

  show();
}

function inputSqrt() {
  if (isError()) {
    return;
  }
  canRepeat = false;

  const value = Number(text);
  if (value < 0) {
    text = ERROR_TEXT;
    clearState();
    showSub('');
    show();
    return;
  }

  text = formatResult(Math.sqrt(value));
  show();
}

/** 百分号键：加减时按左操作数的百分之几计算，乘除时直接转成小数。 */
function inputPercent() {
  if (isError()) {
    return;
  }
  canRepeat = false;

  const value = Number(text);
  const isPercentOfLeft = pendingOp === '+' || pendingOp === '−';
  let result;

  if (acc !== null && isPercentOfLeft) {
    result = acc * value / 100;
  } else {
    result = value / 100;
  }

  text = formatResult(result);

  if (text === ERROR_TEXT) {
    clearState();
    showSub('');
  }

  show();
}

/** 平方键：对当前显示的数求平方。 */
function inputSquare() {
  if (isError()) {
    return;
  }
  canRepeat = false;

  const value = Number(text);
  const result = formatResult(value * value);

  if (result === ERROR_TEXT) {
    text = ERROR_TEXT;
    clearState();
    showSub('');
    show();
    return;
  }

  text = result;
  show();
}

/** 倒数键：对当前显示的数求倒数。 */
function inputReciprocal() {
  if (isError()) {
    return;
  }
  canRepeat = false;

  const value = Number(text);
  text = formatResult(1 / value);

  if (text === ERROR_TEXT) {
    clearState();
    showSub('');
  }

  show();
}

/** π 键：输入圆周率的近似值。 */
const PI_TEXT = formatResult(Math.PI);

function inputPi() {
  if (isError()) {
    text = INITIAL;
  }
  text = PI_TEXT;
  waiting = true;
  show();
}

// ---------------------------------------------------------------
// 新增：常用对数 log10 键
// 复用已有的 log10() 函数，一元运算行为与 √ 一致。
// ---------------------------------------------------------------
function inputLog10() {
  if (isError()) {
    return;
  }
  canRepeat = false; // 一元运算改变了当前数，连算资格作废

  const value = Number(text);
  if (!Number.isFinite(value)) {
    return;
  }

  const result = log10(value);

  // log10 对 x≤0 返回字符串「非法输入」，统一落到错误态
  if (typeof result === 'string') {
    text = ERROR_TEXT;
    clearState();
    showSub('');
    show();
    return;
  }

  text = formatResult(result);
  show();
}

// ---------------------------------------------------------------
// 新增：10 的 x 次方键
// 复用已有的 pow10() 函数；溢出交给 formatResult 判为错误。
// ---------------------------------------------------------------
function inputPow10() {
  if (isError()) {
    return;
  }
  canRepeat = false;

  const value = Number(text);
  if (!Number.isFinite(value)) {
    return;
  }

  const shown = formatResult(pow10(value));

  if (shown === ERROR_TEXT) {
    text = ERROR_TEXT;
    clearState();
    showSub('');
    show();
    return;
  }

  text = shown;
  show();
}

// ---------------------------------------------------------------
// 三角函数与角度模式（DEG/RAD）
// ---------------------------------------------------------------
let useDegrees = true; // 默认角度制 DEG

function toggleAngleMode() {
  useDegrees = !useDegrees;
  if (pendingOp === null) {
    showSub(useDegrees ? '角度制 DEG' : '弧度制 RAD');
  }
}

function inputTrig(name) {
  if (isError()) {
    return;
  }
  canRepeat = false;

  const value = Number(text);
  if (!Number.isFinite(value)) {
    return;
  }

  const angle = useDegrees ? (value * Math.PI) / 180 : value;

  if (name === 'tan' && Math.abs(Math.cos(angle)) < 1e-10) {
    text = ERROR_TEXT;
    clearState();
    showSub('');
    show();
    return;
  }

  let result = Math[name](angle);

  if (Math.abs(result) < 1e-12) {
    result = 0;
  }

  text = formatResult(result);

  if (text === ERROR_TEXT) {
    clearState();
    showSub('');
  }

  show();
}

// ---------------------------------------------------------------
// 括号：用栈暂存外层上下文，按下 ) 时把括号内的算式求值
// ---------------------------------------------------------------
const parenStack = [];

function inputLParen() {
  if (isError()) {
    return;
  }
  const expectingOperand = waiting || (pendingOp === null && text === INITIAL);
  if (!expectingOperand) {
    return;
  }

  parenStack.push({ acc, pendingOp });
  acc = null;
  pendingOp = null;
  text = INITIAL;
  waiting = false;
  canRepeat = false;
  show();
}

// [FIX] inputRParen：括号求值后，内层结果必须写回 text，
// 否则外层 applyPending 读到的是括号内的最后一个操作数而非计算结果
function inputRParen() {
  if (isError() || parenStack.length === 0) {
    return;
  }

  let innerValue;
  if (pendingOp !== null && !waiting) {
    if (!applyPending()) {
      parenStack.length = 0;
      return;
    }
    innerValue = acc;                       // 内层运算的原始数值结果
  } else {
    innerValue = Number(text);              // 括号内没有待算运算，直接取当前值
  }

  const outer = parenStack.pop();

  acc = outer.acc;
  pendingOp = outer.pendingOp;
  text = formatResult(innerValue);          // 关键修复：用内层结果覆盖显示值
  waiting = outer.pendingOp !== null;
  canRepeat = false;
  show();
}

/** ± 键：切换当前显示数字的正负；0（含 0.0）保持不变。 */
function inputPlusMinus() {
  if (isError()) {
    return;
  }
  canRepeat = false;

  const value = Number(text);
  if (value === 0) {
    return;
  }

  if (text.startsWith('-')) {
    text = text.slice(1);
  } else {
    text = `-${text}`;
  }
  show();
}

/** C 键：全部清零。 */
function inputClear() {
  text = INITIAL;
  clearState();
  parenStack.length = 0;
  lastOp = null;
  lastRight = null;
  canRepeat = false;
  showSub('');
  show();
}

function inputCopy() {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    showSub('复制失败');
    return;
  }

  navigator.clipboard.writeText(text)
    .then(() => showSub('已复制'))
    .catch(() => showSub('复制失败'));
}

function inputMemoryAdd() {
  if (isError()) {
    return;
  }
  const value = Number(text);
  if (!Number.isFinite(value)) {
    return;
  }
  memory = memory + value;
  waiting = true;
}

function inputMemorySubtract() {
  if (isError()) {
    return;
  }
  const value = Number(text);
  if (!Number.isFinite(value)) {
    return;
  }
  memory = memory - value;
  waiting = true;
}

function inputMemoryRecall() {
  if (isError()) {
    return;
  }
  text = formatResult(memory);
  waiting = true;
  show();
}

function inputMemoryClear() {
  memory = 0;
}

// ---------------------------------------------------------------
// 键盘渲染
// ---------------------------------------------------------------
const LAYOUT = [
  ['7', 'digit'], ['8', 'digit'], ['9', 'digit'], ['C', 'clear'],
  ['4', 'digit'], ['5', 'digit'], ['6', 'digit'], ['÷', 'operator'],
  ['1', 'digit'], ['2', 'digit'], ['3', 'digit'], ['×', 'operator'],
  ['0', 'digit'], ['−', 'operator'], ['+', 'operator'], ['=', 'equals'],
  ['.', 'decimal'], ['⌫', 'backspace'], ['CE', 'clearEntry'], ['√', 'sqrt'],
  ['x²', 'square'],
  ['1/x', 'reciprocal'],
  ['π', 'pi'],
  ['(', 'lparen'], [')', 'rparen'],
  ['复制', 'copy'],
  ['MC', 'mc'], ['MR', 'mr'], ['M+', 'mplus'], ['M−', 'mminus'],
  ['%', 'percent'],
  ['sin', 'trig'], ['cos', 'trig'], ['tan', 'trig'],
  ['log', 'log10'], ['10ˣ', 'pow10'],   // 新增：常用对数 / 10 的 x 次方
  ['DEG', 'angleMode'],
  ['xʸ', 'operator'],
  ['±', 'plusMinus'],
];

const KEY_CLASS = {
  digit: 'key--normal',
  operator: 'key--action',
  clear: 'key--danger',
  equals: 'key--success',
  decimal: 'key--normal',
  backspace: 'key--action',
  clearEntry: 'key--danger',
  sqrt: 'key--action',
  square: 'key--action',
  percent: 'key--action',
  plusMinus: 'key--action',
  reciprocal: 'key--action',
  pi: 'key--action',
  lparen: 'key--action',
  rparen: 'key--action',
  copy: 'key--action',
  mc: 'key--action',
  mr: 'key--action',
  mplus: 'key--action',
  mminus: 'key--action',
  trig: 'key--action',
  angleMode: 'key--action',
  log10: 'key--action',  // 新增
  pow10: 'key--action',  // 新增
};

LAYOUT.forEach(([label, kind]) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `key ${KEY_CLASS[kind]}`;
  button.textContent = label;
  button.addEventListener('click', () => {
    if (kind === 'digit') {
      inputDigit(label);
    } else if (kind === 'operator') {
      inputOperator(label);
    } else if (kind === 'decimal') {
      inputDecimal();
    } else if (kind === 'clear') {
      inputClear();
    } else if (kind === 'backspace') {
      inputBackspace();
    } else if (kind === 'clearEntry') {
      inputClearEntry();
    } else if (kind === 'sqrt') {
      inputSqrt();
    } else if (kind === 'square') {
      inputSquare();
    } else if (kind === 'reciprocal') {
      inputReciprocal();
    } else if (kind === 'percent') {
      inputPercent();
    } else if (kind === 'pi') {
      inputPi();
    } else if (kind === 'plusMinus') {
      inputPlusMinus();
    } else if (kind === 'copy') {
      inputCopy();
    } else if (kind === 'mc') {
      inputMemoryClear();
    } else if (kind === 'mr') {
      inputMemoryRecall();
    } else if (kind === 'mplus') {
      inputMemoryAdd();
    } else if (kind === 'mminus') {
      inputMemorySubtract();
    } else if (kind === 'trig') {
      inputTrig(label);
    } else if (kind === 'log10') {
      inputLog10();
    } else if (kind === 'pow10') {
      inputPow10();
    } else if (kind === 'angleMode') {
      toggleAngleMode();
      button.textContent = useDegrees ? 'DEG' : 'RAD';
    } else if (kind === 'lparen') {
      inputLParen();
    } else if (kind === 'rparen') {
      inputRParen();
    } else {
      inputEquals();
    }
  });
  keyboard.appendChild(button);
});

// =========================================
// 物理键盘输入监听
// =========================================
document.addEventListener('keydown', (e) => {
  if (e.key >= '0' && e.key <= '9') {
    inputDigit(e.key);
  } else if (e.key === '.') {
    inputDecimal();
  } else if (e.key === '+') {
    inputOperator('+');
  } else if (e.key === '-') {
    inputOperator('−');
  } else if (e.key === '*') {
    inputOperator('×');
  } else if (e.key === '/') {
    inputOperator('÷');
  } else if (e.key === 'Enter' || e.key === '=') {
    inputEquals();
  } else if (e.key === 'Backspace') {
    inputBackspace();
  } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
    inputClear();
  } else {
    return;
  }
  e.preventDefault();
});

// =========================================
// 历史记录增强（持久化 / 点击回填 / 清空）
// =========================================
const HISTORY_KEY = 'calculator-history';
const HISTORY_MAX = 20;

let history = [];

function isHistoryItem(item) {
  return Boolean(item) && typeof item.line === 'string' && typeof item.result === 'string';
}

function loadHistory() {
  try {
    const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    history = Array.isArray(arr) ? arr.filter(isHistoryItem) : [];
  } catch (e) {
    history = [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    // 静默降级：本次不持久化而已
  }
}

function recordHistory(line, result) {
  history.unshift({ line, result });
  if (history.length > HISTORY_MAX) {
    history.length = HISTORY_MAX;
  }
  saveHistory();
  renderHistory();
}

function refillFromHistory(item) {
  text = item.result;
  clearState();
  canRepeat = false;
  waiting = true;
  showSub('');
  show();
}

function clearHistory() {
  history = [];
  saveHistory();
  renderHistory();
}

function renderHistory() {
  if (!historyList) {
    return;
  }

  historyList.innerHTML = '';

  if (history.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = '暂无记录';
    historyList.appendChild(empty);
    return;
  }

  history.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.textContent = `${item.line} ${item.result}`;
    li.title = '点击把结果填回主屏';
    li.addEventListener('click', () => refillFromHistory(item));
    historyList.appendChild(li);
  });

  historyList.scrollTop = 0;
}

// 「清空」按钮挂在标题右侧：标题与按钮包一层，index.html 不动
if (historyPanel && historyList) {
  const title = historyPanel.querySelector('h3');
  const head = document.createElement('div');
  head.className = 'history-panel__head';
  historyPanel.insertBefore(head, historyPanel.firstChild);
  if (title) {
    head.appendChild(title);
  }

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'history-clear';
  clearButton.textContent = '清空';
  clearButton.addEventListener('click', clearHistory);
  head.appendChild(clearButton);
}

// 初始化
loadHistory();
renderHistory();
show();
