// WebAudio 合成音效：不加音频文件，全部实时合成
let ctx = null;
let master = null;

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.45;
  master.connect(ctx.destination);
}

function noiseBuffer(dur) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// 摇柄 + 蛋碰撞：一连串随机频率的短促噪声
export function playRattle(dur = 1.6) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const count = Math.floor(dur / 0.07);
  for (let i = 0; i < count; i++) {
    const t = t0 + i * 0.07 + Math.random() * 0.02;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 1800;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12 + Math.random() * 0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.07);
  }
}

// 出蛋口「咔哒」
export function playClick() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 1300;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.08);
}

// 开蛋「啵」
export function playPop() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(320, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.11);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.16);

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.03);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.15, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  src.connect(g2).connect(master);
  src.start(t);
}

// 出卡风铃
export function playChime() {
  if (!ctx) return;
  const notes = [659.25, 880];
  notes.forEach((f, i) => {
    const t = ctx.currentTime + i * 0.13;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 1);
  });
}
