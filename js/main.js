// 交互编排：摇动 → 掉蛋 → 开蛋 → 出卡 → 我来解愿（还愿闭环）
import { GashaponMachine } from './machine.js';
import { Gacha } from './gacha.js';
import { initAudio, playRattle, playClick, playPop, playChime } from './audio.js';
import { loadSolutions, saveSolution, getSolution, solvedCount } from './solutions.js';

const $ = (s) => document.querySelector(s);
const canvasBox = $('#scene');
const shakeBtn = $('#shakeBtn');
const counterChip = $('#counter');
const solvedChip = $('#solvedChip');
const cardOverlay = $('#cardOverlay');
const cardEl = cardOverlay.querySelector('.card');
const cardBadge = $('#cardBadge');
const cardText = $('#cardText');
const cardMeta = $('#cardMeta');
const cardNo = $('#cardNo');
const solutionBox = $('#solutionBox');
const solutionText = $('#solutionText');
const solutionAuthor = $('#solutionAuthor');
const nextBtn = $('#nextBtn');
const wishBtn = $('#wishBtn');
const closeBtn = $('#cardClose');
const skipType = $('#skipType');
const solvePanel = $('#solvePanel');
const solveInput = $('#solveInput');
const solveName = $('#solveName');
const solveSubmit = $('#solveSubmit');
const solveCancel = $('#solveCancel');
const emptyOverlay = $('#emptyOverlay');
const emptyStats = $('#emptyStats');
const wallList = $('#wallList');
const resetBtn = $('#resetBtn');
const toast = $('#toast');

const gacha = new Gacha();
const machine = new GashaponMachine(canvasBox);

let busy = false;
let typingTimer = null;
let lastItem = null;

function updateCounter() {
  counterChip.textContent = `剩余扭蛋 ${gacha.remaining}`;
}

function updateSolvedChip() {
  const n = solvedCount();
  solvedChip.textContent = `已还愿 ${n}`;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

// 打字机效果（可点击跳过）
function typewriter(el, text) {
  clearInterval(typingTimer);
  el.textContent = '';
  let i = 0;
  const step = text.length > 80 ? 18 : 30;
  typingTimer = setInterval(() => {
    el.textContent = text.slice(0, ++i);
    if (i >= text.length) {
      clearInterval(typingTimer);
      skipType.classList.remove('show');
    }
  }, step);
  if (text.length > 40) skipType.classList.add('show');
}

// 展示已解案例区
function showSolutionBox(sol) {
  solutionText.textContent = sol.solution;
  const time = new Date(sol.time).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  solutionAuthor.textContent = `—— ${sol.author} · ${time}`;
  solutionBox.classList.add('show');
}

function hideSolutionBox() {
  solutionBox.classList.remove('show');
}

function showCard(item) {
  lastItem = item;
  const golden = !!item.solution;

  cardNo.textContent = `第 ${item.index}/${gacha.total} 颗`;
  cardMeta.textContent = `来自 ${item.class}同学 · 匿名`;
  cardEl.classList.toggle('gold', golden);
  cardBadge.classList.toggle('gold', golden);
  cardBadge.textContent = golden ? '已解案例' : '心愿卡';

  typewriter(cardText, item.problem);
  if (golden) {
    showSolutionBox(item.solution);
    wishBtn.textContent = '已被解愿 ✓';
    wishBtn.classList.add('done');
  } else {
    hideSolutionBox();
    wishBtn.textContent = '我来解愿';
    wishBtn.classList.remove('done');
  }
  cardOverlay.classList.add('show');
  playChime();
}

function hideCard() {
  cardOverlay.classList.remove('show');
  skipType.classList.remove('show');
  closeSolvePanel();
}

async function pull() {
  if (busy) return;
  const item = gacha.draw();
  if (!item) {
    showEmptyState();
    return;
  }
  item.solution = getSolution(item.id);
  busy = true;
  hideCard();
  shakeBtn.classList.add('disabled');
  updateCounter();

  initAudio();
  playRattle();
  await machine.shake();
  playClick();
  await machine.dropEgg(!!item.solution, gacha.remaining);
  playPop();
  const openP = machine.openEgg();
  setTimeout(() => showCard(item), 260);
  await openP;

  busy = false;
  shakeBtn.classList.remove('disabled');
}

function next() {
  hideCard();
  machine.resetForNext();
  setTimeout(() => { if (!busy) shakeBtn.classList.add('pulse'); }, 500);
  setTimeout(() => shakeBtn.classList.remove('pulse'), 2600);
}

// ---------- 解愿面板 ----------
function openSolvePanel() {
  if (!lastItem || getSolution(lastItem.id)) return;
  solveInput.value = '';
  solveName.value = '';
  solvePanel.classList.add('show');
  setTimeout(() => solveInput.focus(), 300);
}

function closeSolvePanel() {
  solvePanel.classList.remove('show');
}

function submitSolution() {
  const text = solveInput.value.trim();
  if (!text) {
    showToast('先写点办法，再回投哦');
    return;
  }
  if (!lastItem) return;
  saveSolution(lastItem.id, { solution: text, author: solveName.value });
  const sol = getSolution(lastItem.id);
  lastItem.solution = sol;
  closeSolvePanel();
  // 卡片立刻切换为已解案例态
  cardEl.classList.add('gold');
  cardBadge.classList.add('gold');
  cardBadge.textContent = '已解案例';
  showSolutionBox(sol);
  wishBtn.textContent = '已被解愿 ✓';
  wishBtn.classList.add('done');
  updateSolvedChip();
  showToast('还愿成功！你的办法已变成金蛋回投扭蛋机');
}

// ---------- 抽空结算 + 还愿墙 ----------
function showEmptyState() {
  const n = solvedCount();
  const total = gacha.total;
  emptyStats.innerHTML = `${total} 颗烦恼都被领走了。<br>其中 <b style="color:var(--yellow)">${n}</b> 颗已被解愿${n ? '，办法也回到了扭蛋机里。' : '。'}`;
  // 还愿墙
  const sols = loadSolutions();
  const poolById = Object.fromEntries(gacha.pool.map((p) => [p.id, p]));
  wallList.innerHTML = '';
  const entries = Object.entries(sols)
    .map(([id, sol]) => ({ problem: poolById[id], sol }))
    .filter((e) => e.problem)
    .sort((a, b) => b.sol.time - a.sol.time);
  if (entries.length) {
    const wallTitle = document.createElement('div');
    wallTitle.className = 'wall-q';
    wallTitle.style.margin = '0 0 10px';
    wallTitle.textContent = `—— 还愿墙 · ${entries.length} 条 ——`;
    wallList.appendChild(wallTitle);
    for (const e of entries.slice(0, 20)) {
      const item = document.createElement('div');
      item.className = 'wall-item';
      const q = document.createElement('div');
      q.className = 'wall-q';
      q.textContent = e.problem.problem.length > 40
        ? e.problem.problem.slice(0, 40) + '…' : e.problem.problem;
      const s = document.createElement('div');
      s.className = 'wall-s';
      s.textContent = `${e.sol.solution}（${e.sol.author}）`;
      item.append(q, s);
      wallList.appendChild(item);
    }
  }
  emptyOverlay.classList.add('show');
}

// 事件
shakeBtn.addEventListener('click', pull);
nextBtn.addEventListener('click', next);
closeBtn.addEventListener('click', next);
cardOverlay.addEventListener('click', (e) => {
  if (e.target === cardOverlay && !solvePanel.classList.contains('show')) next();
});
wishBtn.addEventListener('click', openSolvePanel);
solveSubmit.addEventListener('click', submitSolution);
solveCancel.addEventListener('click', closeSolvePanel);
resetBtn.addEventListener('click', () => {
  gacha.reset();
  updateCounter();
  emptyOverlay.classList.remove('show');
  showToast('扭蛋机已补满，继续开扭！');
});
skipType.addEventListener('click', () => {
  clearInterval(typingTimer);
  if (lastItem) cardText.textContent = lastItem.problem;
  skipType.classList.remove('show');
});

// 空格键摇动
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !cardOverlay.classList.contains('show')
      && !emptyOverlay.classList.contains('show')) {
    e.preventDefault();
    pull();
  }
});

// 手机摇一摇
let lastAcc = 9.8;
let shakeCooldown = 0;
window.addEventListener('devicemotion', (e) => {
  const a = e.accelerationIncludingGravity;
  if (!a) return;
  const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  const now = Date.now();
  if (Math.abs(mag - lastAcc) > 12 && now > shakeCooldown
      && !cardOverlay.classList.contains('show') && !busy) {
    shakeCooldown = now + 3000;
    pull();
  }
  lastAcc = mag;
});

// 调试句柄（控制台可用）
window.__app = { machine, gacha, pull };

// 启动：加载数据
async function boot() {
  try {
    const res = await fetch('./data/problems.json');
    const data = await res.json();
    gacha.init(data);
    updateCounter();
    updateSolvedChip();
  } catch (err) {
    showToast('数据加载失败，请检查 data/problems.json');
    console.error(err);
  }
}
boot();
