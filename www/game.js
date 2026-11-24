'use strict';
/* ===== STICK FURY - game logic part 1: session, damage, enemies ===== */
let state = 'menu', G = null, buttons = [], toastT = 0, toastMsg = '';
let shopFrom = 'menu';

function toast(m) { toastMsg = m; toastT = 1.8; }

function genBG(th, LW) {
  const mk = (span, wMin, wMax, hMin, hMax) => {
    const a = []; let x = -40;
    while (x < span) { const w = rnd(wMin, wMax); a.push({ x, w, h: rnd(hMin, hMax), s: Math.random() }); x += w * rnd(0.7, 1.1); }
    return a;
  };
  const stars = [];
  for (let i = 0; i < 70; i++) stars.push({ x: rnd(0, W), y: rnd(0, GROUND - 120), r: rnd(0.6, 1.8) });
  return { far: mk(LW * 0.2 + W + 200, 60, 140, 80, 230), near: mk(LW * 0.5 + W + 200, 80, 170, 60, 180), stars };
}
function newPlayer() {
  const maxhp = 100 + save.upg.hp * 20;
  const ammo = {};
  WEAPONS.forEach(w => { if (w.type === 'gun') ammo[w.id] = w.mag; });
  let wi = wIndex(save.equip);
  if (!save.owned.includes(WEAPONS[wi].id)) wi = wIndex('pistol');
  return { x: 200, y: GROUND, vx: 0, vy: 0, face: 1, hp: maxhp, maxhp, en: 0, ground: true, jumps: 2, atkT: 0, atkDur: 0.3, hitDone: true,
    anim: 0, inv: 0, hurtT: 0, kbv: 0, combo: 0, comboT: 0, wi, ammo, reloadT: 0, dead: false };
}
function startLevel(n) {
  const def = levelDef(n);
  G = { n, def, p: newPlayer(), enemies: [], bullets: [], parts: [], texts: [], drops: [], allies: [], corpses: [], rings: [],
    spawned: 0, killed: 0, spT: 1, cam: 0, shake: 0, t: 0, hitstop: 0, boss: null, bossDone: false, earned: 0,
    msgT: 2.4, msg: def.boss >= 0 ? 'LEVEL ' + n + ' - BOSS' : 'LEVEL ' + n, clear: false, clearT: 0, deadT: 0,
    bg: genBG(THEMES[def.th], def.LW), tipT: n === 1 ? 7 : 0 };
  for (let i = 0; i < save.upg.ally; i++) G.allies.push({ x: 150 - i * 40, y: GROUND, face: 1, hp: 90, maxhp: 90, cd: 0, anim: 0, flash: 0, mv: 0, dead: false });
  pressed = {};
  go('play');
}

function addText(x, y, s, col) { G.texts.push({ x, y, s: String(s), col: col || '#fff', life: 0.8 }); }
function spark(x, y, n, col, spd) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 6.28), s = rnd(40, spd || 240);
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rnd(0.2, 0.45), max: 0.45, col, sz: rnd(2, 4), g: 500 });
  }
}
function closestEnemy(o, maxD) {
  let best = null, bd = maxD;
  for (const e of G.enemies) { if (e.dead) continue; const d = Math.abs(e.x - o.x); if (d < bd) { bd = d; best = e; } }
  return best;
}
function nearestTarget(e) {
  const p = G.p; let best = p.dead ? null : p, bd = p.dead ? 1e9 : Math.abs(p.x - e.x) - 80;
  for (const a of G.allies) { if (a.dead) continue; const d = Math.abs(a.x - e.x); if (d < bd) { bd = d; best = a; } }
  return best || p;
}

function hurtPlayer(dmg, fromX) {
  const p = G.p;
  if (p.inv > 0 || p.dead) return;
  p.hp -= dmg; p.inv = 0.7; p.hurtT = 0.18; p.kbv = sign(p.x - fromX) * 280; p.combo = 0;
  G.shake = Math.max(G.shake, 8); sfx('hurt');
  addText(p.x, p.y - 80, Math.round(dmg), '#ff5a5a');
  spark(p.x, p.y - 35, 6, '#ff5a5a', 200);
  if (p.hp <= 0) { p.hp = 0; p.dead = true; p.vy = -300; G.deadT = 1.4; sfx('die'); }
}
function hurtAlly(a, dmg) {
  if (a.dead) return;
  a.hp -= dmg; a.flash = 0.12;
  if (a.hp <= 0) { a.dead = true; G.corpses.push({ x: a.x, y: a.y, face: 1, sc: 1, col: '#4aa3ff', t: 0 }); }
}
function hitTarget(t, dmg, fromX) { if (t === G.p) hurtPlayer(dmg, fromX); else hurtAlly(t, dmg); }
function hurtEnemy(e, dmg, kb) {
  if (e.dead) return;
  e.hp -= dmg; e.flash = 0.1;
  const res = e.boss ? 0.04 : (e.t.kbRes !== undefined ? e.t.kbRes : 1);
  e.kb += kb * res;
  if (!e.boss) { e.stun = Math.max(e.stun, e.t.kbRes !== undefined ? 0.08 : 0.2); e.wind = 0; }
  addText(e.x + rnd(-8, 8), e.y - e.h * e.sc - 8, Math.round(dmg), '#fff');
  spark(e.x, e.y - 30 * e.sc, 3, '#fff', 200);
  G.p.en = Math.min(100, G.p.en + dmg * 0.06);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true; G.killed++;
  const p = G.p; p.combo++; p.comboT = 2.2;
  G.corpses.push({ x: e.x, y: e.y, face: e.face, sc: e.sc, col: e.col, t: 0, boss: e.boss });
  spark(e.x, e.y - 30 * e.sc, 10, e.col, 300);
  const mult = 1 + Math.floor(p.combo / 15) * 0.25;
  const val = Math.max(1, Math.round(e.coin * (1 + G.n * 0.12) * mult));
  G.drops.push({ x: e.x, y: e.y - 24, vx: rnd(-80, 80), vy: -280, t: 'coin', v: val, life: 14 });
  if (Math.random() < 0.09) G.drops.push({ x: e.x, y: e.y - 24, vx: rnd(-60, 60), vy: -300, t: 'hp', v: 0, life: 14 });
  p.en = Math.min(100, p.en + e.en);
  if (e.boss) {
    G.bossDone = true; G.boss = null; G.hitstop = 0.4; G.shake = 18; sfx('boom');
    for (let i = 0; i < 12; i++) G.drops.push({ x: e.x, y: e.y - 40, vx: rnd(-200, 200), vy: rnd(-450, -200), t: 'coin', v: Math.round(e.coin / 12) + 1, life: 20 });
    G.rings.push({ x: e.x, y: e.y - 40, r: 0, max: 260, t: 0, life: 0.5, col: '#fff' });
  } else sfx('hit');
}
function explode(x, y, r, dmg, from) {
  sfx('boom'); G.shake = Math.max(G.shake, 12);
  for (let i = 0; i < 26; i++) {
    const a = rnd(0, 6.28), s = rnd(80, 420);
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: rnd(0.3, 0.7), max: 0.7, col: Math.random() < 0.5 ? '#ffb43a' : '#ff5a2a', sz: rnd(3, 7), g: 400 });
  }
  G.rings.push({ x, y, r: 0, max: r, t: 0, life: 0.35, col: '#ffd27a' });
  if (from === 'e') {
    const p = G.p;
    if (!p.dead && Math.hypot(p.x - x, p.y - 30 - y) < r) hurtPlayer(dmg, x);
    for (const a of G.allies) if (!a.dead && Math.hypot(a.x - x, a.y - 30 - y) < r) hurtAlly(a, dmg);
  } else {
    for (const e of G.enemies.slice()) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - 30 - y);
      if (d < r + e.w) hurtEnemy(e, dmg * (1 - Math.min(d / r, 1) * 0.5), sign(e.x - x) * 420);
    }
  }
}

function addEnemy(type, x) {
  const t = ET[type], d = G.def;
  const hp = t.hp * d.hs;
  G.enemies.push({ type, t, x, y: GROUND, vy: 0, mv: 0, kb: 0, face: 1, hp, maxhp: hp, sc: t.sc, w: t.w, h: t.h, col: t.col,
    flash: 0, cd: rnd(0.3, t.cd), wind: 0, anim: rnd(0, 6), dmg: t.dmg * d.ds, coin: t.coin, en: t.en, stun: 0, dead: false, boss: false, jt: rnd(0.5, 2), hitAir: false, air: false });
}
function spawnBoss() {
  const b = BOSSES[G.def.boss], d = G.def;
  const hp = b.hp * (1 + (G.n - 4) * 0.07);
  const x = G.p.x < d.LW / 2 ? Math.min(d.LW + 40, G.cam + W + 60) : Math.max(-40, G.cam - 60);
  G.boss = { type: 'boss', t: { range: 50 }, bk: G.def.boss, name: b.name, x, y: GROUND, vy: 0, mv: 0, kb: 0, face: -1, hp, maxhp: hp, sc: b.sc, w: 16, h: 56, col: b.col,
    flash: 0, cd: 1, wind: 0, anim: 0, dmg: b.dmg * d.ds, coin: 150, en: 0, stun: 0, dead: false, boss: true,
    st: 'idle', stT: 1.2, fd: 1, hitFlag: false, air: false, shots: 0, shotT: 0, enr: false };
  G.enemies.push(G.boss);
  G.msg = b.name; G.msgT = 2.6; sfx('boss'); G.shake = 10;
}
function enemyShoot(e, tgt, spd, col, spread) {
  const sx = e.x + e.face * 20 * e.sc, sy = e.y - 38 * e.sc;
  const dx = tgt.x - sx, dy = (tgt.y - 36) - sy;
  const a = Math.atan2(dy, dx) + (spread ? rnd(-spread, spread) : 0);
  G.bullets.push({ x: sx, y: sy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg: e.dmg, life: 2.2, from: 'e', col, pierce: 0, hit: [] });
}
function bossPick(e) {
  const k = e.bk;
  const opts = k === 0 ? ['charge', 'slam'] : k === 1 ? ['burst', 'charge', 'burst'] : ['charge', 'slam', 'burst', 'summon'];
  e.st = 'tele_' + opts[(Math.random() * opts.length) | 0];
  e.stT = e.enr ? 0.35 : 0.6; e.mv = 0; e.fd = e.face; e.hitFlag = false;
}
function bossEnd(e) { e.st = 'idle'; e.stT = rnd(0.8, 1.4) * (e.enr ? 0.6 : 1); e.mv = 0; }
function updBoss(e, dt, tgt) {
  const dx = tgt.x - e.x, dist = Math.abs(dx);
  if (!e.enr && e.hp < e.maxhp * 0.5) { e.enr = true; G.msg = 'ENRAGED!'; G.msgT = 1.5; G.shake = 10; }
  e.stT -= dt;
  const touch = () => {
    if (!e.hitFlag && Math.abs(tgt.x - e.x) < 46 * e.sc && Math.abs(tgt.y - e.y) < 60) { e.hitFlag = true; hitTarget(tgt, e.dmg, e.x); }
  };
  if (e.st === 'idle') {
    e.face = sign(dx);
    e.mv = dist > 150 ? sign(dx) * (e.enr ? 95 : 70) : 0;
    if (e.stT <= 0) bossPick(e);
  } else if (e.st.startsWith('tele_')) {
    e.mv = 0; e.face = sign(dx); e.fd = e.face;
    if (e.stT <= 0) {
      const a = e.st.slice(5);
      if (a === 'charge') { e.st = 'charge'; e.stT = 0.85; e.hitFlag = false; }
      else if (a === 'slam') { e.st = 'slam'; e.vy = -820; e.y = GROUND - 1; e.air = true; e.mv = sign(dx) * Math.min(dist, 300) * 0.9; e.stT = 3; }
      else if (a === 'burst') { e.st = 'burst'; e.shots = e.enr ? 8 : 5; e.shotT = 0; e.stT = 3; }
      else { e.st = 'summon'; e.stT = 0.7; for (let i = -1; i <= 1; i++) addEnemy('walker', clamp(e.x + i * 110, -40, G.def.LW + 40)); sfx('boss'); }
    }
  } else if (e.st === 'charge') {
    e.mv = e.fd * (e.enr ? 560 : 460); touch();
    if (e.stT <= 0 || e.x < -30 || e.x > G.def.LW + 30) bossEnd(e);
  } else if (e.st === 'slam') {
    if (e.air) e.mv *= Math.pow(0.5, dt); else bossEnd(e);
  } else if (e.st === 'burst') {
    e.mv = 0; e.face = sign(dx); e.shotT -= dt;
    if (e.shots > 0 && e.shotT <= 0) { enemyShoot(e, tgt, 430, '#ffb03a', 0.12); e.shots--; e.shotT = e.enr ? 0.09 : 0.13; sfx('shoot'); }
    if (e.shots <= 0 && e.shotT < -0.4) bossEnd(e);
  } else if (e.st === 'summon') {
    e.mv = 0; if (e.stT <= 0) bossEnd(e);
  }
}
function onSlam(e) {
  G.shake = 16; sfx('boom'); spark(e.x, e.y, 14, '#ccc', 300);
  for (const d of [-1, 1]) G.bullets.push({ x: e.x + d * 30, y: GROUND - 16, vx: d * 340, vy: 0, dmg: e.dmg * 0.8, life: 2.4, from: 'e', kind: 'wave', col: e.col, pierce: 0, hit: [] });
  const p = G.p;
  if (Math.abs(p.x - e.x) < 70 * e.sc && p.y > GROUND - 40) hurtPlayer(e.dmg * 0.8, e.x);
}
function updEnemy(e, dt) {
  const t = e.t, tgt = nearestTarget(e);
  e.flash = Math.max(0, e.flash - dt);
  e.vy += 1500 * dt; e.y += e.vy * dt;
  if (e.y >= GROUND) { e.y = GROUND; if (e.vy > 0 && e.air) { e.air = false; onSlam(e); } e.vy = 0; e.hitAir = false; }
  const dx = tgt.x - e.x, dist = Math.abs(dx);
  const onG = e.y >= GROUND - 1;
  if (e.boss) updBoss(e, dt, tgt);
  else if (e.stun > 0) { e.stun -= dt; e.mv = 0; }
  else if (t.ranged) {
    e.face = sign(dx);
    e.mv = dist < 210 ? -sign(dx) * t.spd : dist > 360 ? sign(dx) * t.spd : 0;
    e.cd -= dt;
    if (e.cd <= 0 && dist < 560) { enemyShoot(e, tgt, 330, '#c58cff', 0.05); e.cd = t.cd * rnd(0.8, 1.3); }
  } else if (t.bomber) {
    e.face = sign(dx); e.mv = sign(dx) * t.spd;
    if (dist < 38 && Math.abs(tgt.y - e.y) < 60) { e.dead = true; explode(e.x, e.y - 20, 95, e.dmg, 'e'); G.killed++; G.corpses.push({ x: e.x, y: e.y, face: e.face, sc: e.sc, col: e.col, t: 0 }); }
  } else {
    e.face = sign(dx);
    if (t.jumper && !onG) {
      if (!e.hitAir && dist < 32 && Math.abs(tgt.y - e.y) < 70) { e.hitAir = true; hitTarget(tgt, e.dmg, e.x); }
    } else if (e.wind > 0) {
      e.wind -= dt; e.mv = 0;
      if (e.wind <= 0 && dist < t.range * e.sc + 30 && Math.abs(tgt.y - e.y) < 60) hitTarget(tgt, e.dmg, e.x);
    } else if (dist > t.range * e.sc * 0.8) {
      e.mv = sign(dx) * t.spd;
      if (t.jumper) { e.jt -= dt; if (e.jt <= 0 && dist > 100 && dist < 330) { e.vy = -640; e.mv = sign(dx) * 330; e.jt = rnd(1.6, 2.8); } }
    } else {
      e.mv = 0; e.cd -= dt;
      if (e.cd <= 0) { e.wind = 0.35; e.cd = t.cd * rnd(0.9, 1.3); }
    }
  }
  e.x += (e.mv + e.kb) * dt; e.kb *= Math.pow(0.004, dt);
  e.x = clamp(e.x, -60, G.def.LW + 60);
  e.anim += dt * Math.abs(e.mv) / 26;
  for (const o of G.enemies) {
    if (o === e || o.dead || o.boss !== e.boss) continue;
    const d = e.x - o.x;
    if (Math.abs(d) < 18 && Math.abs(e.y - o.y) < 30) e.x += (d === 0 ? (Math.random() < 0.5 ? 1 : -1) : sign(d)) * 40 * dt;
  }
}
