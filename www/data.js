'use strict';
/* ===== STICK FURY - data, audio, input, save ===== */
const W = 960, H = 540, GROUND = 450;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let K = 1;
function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  cv.style.width = Math.floor(W * s) + 'px';
  cv.style.height = Math.floor(H * s) + 'px';
  K = Math.max(1, Math.min(1.6, s * (window.devicePixelRatio || 1)));
  cv.width = Math.round(W * K);
  cv.height = Math.round(H * K);
}
addEventListener('resize', fit);
fit();

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sign = v => (v < 0 ? -1 : 1);
const isTouch = ('ontouchstart' in window) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);

/* ---------- audio (all synthesized, no files) ---------- */
let AC = null, NB = null, muted = false;
function audioInit() {
  try {
    if (!AC) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      AC = new C();
      const len = AC.sampleRate >> 1;
      NB = AC.createBuffer(1, len, AC.sampleRate);
      const d = NB.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) {}
}
function tone(f, d, type, vol, slide) {
  if (!AC || muted) return;
  try {
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(vol || 0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + d);
    o.connect(g); g.connect(AC.destination);
    o.start(t); o.stop(t + d + 0.02);
  } catch (e) {}
}
function noise(d, vol, fq) {
  if (!AC || muted || !NB) return;
  try {
    const t = AC.currentTime, s = AC.createBufferSource(), g = AC.createGain(), f = AC.createBiquadFilter();
    s.buffer = NB; f.type = 'lowpass'; f.frequency.value = fq || 2000;
    g.gain.setValueAtTime(vol || 0.1, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + d);
    s.connect(f); f.connect(g); g.connect(AC.destination);
    s.start(t); s.stop(t + d + 0.02);
  } catch (e) {}
}
const SFX = {
  shoot: () => { noise(0.08, 0.09, 3500); tone(180, 0.08, 'sawtooth', 0.05, -100); },
  heavy: () => { noise(0.2, 0.16, 1500); tone(90, 0.2, 'sawtooth', 0.08, -50); },
  punch: () => { noise(0.07, 0.1, 900); tone(140, 0.07, 'square', 0.05, -60); },
  swing: () => { noise(0.09, 0.05, 5000); },
  hit: () => { tone(220, 0.06, 'square', 0.04, -120); },
  boom: () => { noise(0.5, 0.25, 700); tone(70, 0.4, 'sawtooth', 0.12, -40); },
  coin: () => { tone(880, 0.07, 'square', 0.035); setTimeout(() => tone(1320, 0.09, 'square', 0.035), 55); },
  hurt: () => { tone(160, 0.18, 'sawtooth', 0.08, -100); },
  jump: () => { tone(300, 0.12, 'square', 0.03, 300); },
  rage: () => { noise(0.6, 0.2, 1200); tone(60, 0.6, 'sawtooth', 0.12, 200); },
  reload: () => { tone(500, 0.04, 'square', 0.04); setTimeout(() => tone(700, 0.04, 'square', 0.04), 220); },
  die: () => { tone(200, 0.3, 'square', 0.05, -150); },
  click: () => { tone(600, 0.04, 'square', 0.03); },
  buy: () => { tone(660, 0.07, 'square', 0.04); setTimeout(() => tone(990, 0.12, 'square', 0.04), 70); },
  win: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'square', 0.05), i * 120)); },
  boss: () => { tone(80, 0.8, 'sawtooth', 0.12, -30); noise(0.6, 0.1, 400); },
};
let lastCoinSfx = 0;
function sfx(n) { try { SFX[n](); } catch (e) {} }
let mStep = 0, mT = 0;
const BASS = [55, 55, 82, 55, 65, 65, 98, 65, 73, 73, 110, 73, 65, 65, 98, 82];
function music(dt, boss) {
  mT -= dt;
  if (mT <= 0) {
    mT = boss ? 0.15 : 0.2;
    if (AC && !muted) {
      const n = BASS[mStep % 16];
      tone(n, 0.18, 'triangle', 0.045);
      if (mStep % 4 === 0) noise(0.05, 0.035, 300);
      if (mStep % 2 === 1) noise(0.03, 0.012, 6000);
      if (boss && mStep % 8 === 4) tone(n * 4, 0.1, 'square', 0.015);
    }
    mStep++;
  }
}

/* ---------- save ---------- */
const SAVE_KEY = 'stickfury_save_v1';
let save = { coins: 0, owned: ['fist', 'pistol'], equip: 'pistol', upg: { hp: 0, dmg: 0, spd: 0, ally: 0 }, unlocked: 1, stars: {}, muted: false };
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s === 'object') {
      save = Object.assign(save, s);
      save.upg = Object.assign({ hp: 0, dmg: 0, spd: 0, ally: 0 }, s.upg || {});
      if (!Array.isArray(save.owned)) save.owned = ['fist', 'pistol'];
      if (!save.stars) save.stars = {};
    }
  } catch (e) {}
  muted = !!save.muted;
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

/* ---------- content ---------- */
const WEAPONS = [
  { id: 'fist', name: 'Fists', type: 'melee', dmg: 12, rate: 0.26, range: 58, len: 0, col: '#fff', lw: 4, kb: 160, price: 0, snd: 'punch' },
  { id: 'bat', name: 'Spiked Bat', type: 'melee', dmg: 26, rate: 0.38, range: 84, len: 30, col: '#a9743a', lw: 6, kb: 300, price: 300, snd: 'swing' },
  { id: 'katana', name: 'Katana', type: 'melee', dmg: 38, rate: 0.28, range: 106, len: 42, col: '#e3ecf5', lw: 3.5, kb: 200, price: 900, snd: 'swing' },
  { id: 'pistol', name: 'Pistol', type: 'gun', dmg: 20, rate: 0.26, mag: 12, reload: 0.9, spread: 0.03, speed: 950, life: 0.7, len: 13, th: 5, price: 0, col: '#ffe27a', snd: 'shoot' },
  { id: 'smg', name: 'SMG', type: 'gun', dmg: 12, rate: 0.075, mag: 30, reload: 1.3, spread: 0.09, speed: 1000, life: 0.6, len: 20, th: 6, price: 700, col: '#ffd24a', snd: 'shoot' },
  { id: 'shotgun', name: 'Shotgun', type: 'gun', dmg: 13, pellets: 7, rate: 0.75, mag: 6, reload: 1.7, spread: 0.22, speed: 900, life: 0.32, len: 28, th: 5, price: 1200, col: '#ffb03a', snd: 'heavy' },
  { id: 'rifle', name: 'Sniper Rifle', type: 'gun', dmg: 70, rate: 0.55, mag: 7, reload: 1.6, spread: 0.005, speed: 1800, life: 0.8, pierce: 3, len: 34, th: 4, price: 1800, col: '#9ff', snd: 'heavy' },
  { id: 'rocket', name: 'Rocket Launcher', type: 'gun', dmg: 110, rate: 1.0, mag: 3, reload: 2.1, spread: 0.02, speed: 620, life: 1.4, rocket: true, len: 30, th: 9, price: 3200, col: '#ff7a3a', snd: 'heavy' },
  { id: 'minigun', name: 'Minigun', type: 'gun', dmg: 10, rate: 0.045, mag: 120, reload: 3, spread: 0.14, speed: 1000, life: 0.55, len: 26, th: 9, price: 5200, col: '#ffe27a', snd: 'shoot' },
];
const wIndex = id => Math.max(0, WEAPONS.findIndex(w => w.id === id));
const UPG = [
  { k: 'hp', name: 'Max Health', desc: '+20 HP', base: 150, max: 10 },
  { k: 'dmg', name: 'Damage', desc: '+8% damage', base: 200, max: 10 },
  { k: 'spd', name: 'Speed', desc: '+4% move speed', base: 120, max: 8 },
  { k: 'ally', name: 'Stick Ally', desc: 'Gunner buddy', base: 1500, max: 3 },
];
const upgCost = u => u.base * (save.upg[u.k] + 1);

const ET = {
  walker: { hp: 45, spd: 62, dmg: 9, w: 14, h: 56, sc: 1, col: '#6fd68a', range: 34, cd: 1.0, coin: 4, en: 6 },
  runner: { hp: 30, spd: 155, dmg: 7, w: 13, h: 56, sc: 0.95, col: '#f5a742', range: 32, cd: 0.8, coin: 5, en: 6 },
  brute: { hp: 260, spd: 50, dmg: 24, w: 18, h: 56, sc: 1.5, col: '#d65f5f', range: 44, cd: 1.6, coin: 18, en: 14, kbRes: 0.25 },
  spitter: { hp: 40, spd: 58, dmg: 10, w: 14, h: 56, sc: 1, col: '#b583e8', range: 0, cd: 2.0, coin: 8, en: 8, ranged: true },
  bomber: { hp: 34, spd: 125, dmg: 34, w: 14, h: 56, sc: 1, col: '#ff5a5a', range: 40, cd: 1, coin: 8, en: 8, bomber: true },
  ninja: { hp: 55, spd: 115, dmg: 14, w: 13, h: 56, sc: 1, col: '#8a93a6', range: 36, cd: 1.1, coin: 10, en: 8, jumper: true },
};
const BOSSES = [
  { name: 'THE CRUSHER', hp: 1500, col: '#e0524d', sc: 1.9, dmg: 28 },
  { name: 'GUNSLINGER', hp: 1800, col: '#e6b422', sc: 1.6, dmg: 14 },
  { name: 'THE OVERLORD', hp: 3300, col: '#a04bd6', sc: 2.1, dmg: 34 },
];
const THEMES = [
  { n: 'Downtown', sky: ['#6fb1e8', '#cfe9ff'], far: '#8ab0d0', near: '#5f7f9e', ground: '#4a4f57', line: '#e8d44d', sun: '#fff3b0', dark: false, shape: 'bld' },
  { n: 'Dusk Alley', sky: ['#2b1b4d', '#ff9a6b'], far: '#4a2f6b', near: '#2f1d4a', ground: '#2a2433', line: '#f2a65a', sun: '#ffd7a0', dark: true, shape: 'bld' },
  { n: 'Midnight', sky: ['#050a1f', '#1b2a5a'], far: '#1a2650', near: '#0f1838', ground: '#15192b', line: '#4aa3ff', sun: '#e8f0ff', dark: true, shape: 'bld', stars: true, win: true },
  { n: 'Desert', sky: ['#f6b25c', '#fde4a8'], far: '#d99b5b', near: '#b87a3f', ground: '#a8763a', line: '#7a4f1f', sun: '#ffffff', dark: false, shape: 'mnt' },
  { n: 'Inferno', sky: ['#1a0505', '#7a1d0a'], far: '#4a1208', near: '#2a0a04', ground: '#2b1410', line: '#ff6a1a', sun: '#ff9a3a', dark: true, shape: 'mnt' },
  { n: 'Frostbite', sky: ['#8fb7d6', '#e8f4ff'], far: '#b8d4e8', near: '#8fb0c8', ground: '#d8e6f0', line: '#7fa4c0', sun: '#ffffff', dark: false, shape: 'mnt' },
  { n: 'Neon City', sky: ['#0a0220', '#3b0a5e'], far: '#2a0f55', near: '#190a3a', ground: '#120726', line: '#ff2bd6', sun: '#27f5ff', dark: true, shape: 'bld', stars: true, win: true },
];
function levelDef(n) {
  const pool = ['walker'];
  if (n >= 2) pool.push('runner', 'walker');
  if (n >= 3) pool.push('spitter');
  if (n >= 4) pool.push('brute');
  if (n >= 5) pool.push('bomber');
  if (n >= 7) pool.push('ninja', 'ninja');
  const boss = n % 4 === 0 ? (((n / 4) - 1) % 3) : -1;
  return {
    n, th: (n - 1) % THEMES.length, boss, pool,
    count: 12 + n * 4, cap: Math.min(4 + ((n / 2) | 0), 11),
    hs: 1 + (n - 1) * 0.16, ds: 1 + (n - 1) * 0.07,
    LW: 2600 + Math.min(n, 10) * 100, interval: Math.max(0.55, 1.7 - n * 0.06),
  };
}

/* ---------- input ---------- */
const inp = { left: 0, right: 0, jump: 0, atk: 0, swap: 0, special: 0 };
let pressed = {};
function setK(k, v) { if (v && !inp[k]) pressed[k] = true; inp[k] = v ? 1 : 0; }
const KM = {
  ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump',
  j: 'atk', J: 'atk', z: 'atk', Z: 'atk', k: 'atk', K: 'atk', x: 'atk', X: 'atk',
  q: 'swap', Q: 'swap', e: 'swap', E: 'swap',
  l: 'special', L: 'special', Shift: 'special', r: 'special', R: 'special',
};
