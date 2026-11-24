// Headless smoke test: plays every level type with a bot and renders every screen.
const fs = require('fs'), path = require('path'), vm = require('vm');
const noop = () => {};
const ctxStub = new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : (k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : noop)),
  set: (t, k, v) => { t[k] = v; return true; },
});
const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, addEventListener: noop,
  getContext: () => ctxStub, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }), dataset: {}, width: 0, height: 0 });
global.window = global; global.innerWidth = 960; global.innerHeight = 540; global.devicePixelRatio = 1;
global.addEventListener = noop;
global.document = { getElementById: () => el(), querySelectorAll: () => [], documentElement: {}, addEventListener: noop, hidden: false };
const store = {};
global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } };
global.requestAnimationFrame = noop;
try { global.navigator = global.navigator || { maxTouchPoints: 0 }; } catch (e) {}

const dir = path.join(__dirname, '..', 'www');
const src = ['data.js', 'game.js', 'logic.js', 'render.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
vm.runInThisContext(src, { filename: 'stickfury-bundle.js' });
const S = window.__SF;

let problems = 0;
const fail = m => { problems++; console.log('PROBLEM:', m); };

// every screen renders
S.save.coins = 99999;
S.WEAPONS.forEach(w => { if (!S.save.owned.includes(w.id)) S.save.owned.push(w.id); });
for (const s of ['menu', 'levels', 'shop']) { S.go(s); S.render(); S.buttons.forEach(b => { try { if (!b.off) b.fn(); } catch (e) { fail('button ' + b.label + ' in ' + s + ': ' + e.message); } S.go(s); }); }
S.go('menu'); S.render();

function run(n, opts) {
  opts = opts || {};
  S.save.upg.ally = opts.ally || 0;
  S.startLevel(n);
  const G0 = S.G;
  let frames = 0, wsw = 0;
  const maxF = 60 * 420;
  while (S.state === 'play' && frames < maxF) {
    const G = S.G, p = G.p;
    if (!opts.mortal && p.hp < p.maxhp * 0.4) p.hp = p.maxhp;
    let tgt = null, bd = 1e9;
    for (const e of G.enemies) { const d = Math.abs(e.x - p.x); if (d < bd) { bd = d; tgt = e; } }
    const w = S.WEAPONS[p.wi];
    const want = w.type === 'melee' ? 60 : 220;
    let L = 0, R = 0;
    if (tgt) { if (bd > want) { if (tgt.x > p.x) R = 1; else L = 1; } else if (bd < want - 80) { if (tgt.x > p.x) L = 1; else R = 1; } }
    else { if (G.cam + 480 > p.x) R = 1; else L = 1; }
    S.setK('left', L); S.setK('right', R);
    S.setK('atk', bd < 450 ? 1 : 0);
    S.setK('jump', frames % 50 === 0 ? 1 : 0);
    S.setK('swap', (frames % 400 === 0 && opts.cycle) ? 1 : 0);
    S.setK('special', p.en >= 100 ? 1 : 0);
    S.step(1 / 60);
    if (frames % 10 === 0) S.render();
    if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.hp)) { fail('NaN player at level ' + n); break; }
    for (const e of G.enemies) if (!isFinite(e.x) || !isFinite(e.y) || !isFinite(e.hp)) { fail('NaN enemy ' + e.type + ' level ' + n); break; }
    frames++;
  }
  const res = S.state;
  const bossLvl = S.levelDef(n).boss >= 0;
  console.log('level', String(n).padStart(2), bossLvl ? '(boss)' : '      ', '->', res, 'frames', frames, 'killed', G0.killed + '/' + G0.def.count, 'coins+', G0.earned, 'bossDone', G0.bossDone);
  if (res === 'play') fail('level ' + n + ' did not finish in time');
  if (res === 'clear') { S.render(); }
  if (res === 'dead') { S.render(); }
  return res;
}

S.save.upg.hp = 3; S.save.upg.dmg = 5;
const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 16];
for (const n of levels) {
  S.save.equip = ['pistol', 'smg', 'shotgun', 'rifle', 'katana', 'bat', 'minigun', 'rocket'][n % 8];
  const r = run(n, { ally: n % 4, cycle: n % 2 === 0 });
  if (r !== 'clear') fail('bot did not clear level ' + n + ' (got ' + r + ')');
}
// pause, restart and dead flows
S.startLevel(2); S.go('pause'); S.render(); S.buttons.forEach(b => { if (b.label === 'RESUME') b.fn(); }); S.render();
S.startLevel(3); S.G.p.hp = 1; S.G.p.inv = 0; S.G.enemies.length = 0; S.G.p.dead = false;
const run2 = run(3, { mortal: true });
S.go('dead'); S.render(); S.go('clear'); S.render();
console.log(problems === 0 ? 'ALL OK' : problems + ' PROBLEM(S)');
process.exit(problems ? 1 : 0);
