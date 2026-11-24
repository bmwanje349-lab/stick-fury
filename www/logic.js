'use strict';
/* ===== STICK FURY - game logic part 2: player, world, ui state, events ===== */
function swapWeapon() {
  const p = G.p;
  for (let i = 1; i <= WEAPONS.length; i++) {
    const j = (p.wi + i) % WEAPONS.length;
    if (save.owned.includes(WEAPONS[j].id)) { p.wi = j; break; }
  }
  p.reloadT = 0; p.atkT = 0; p.hitDone = true;
  save.equip = WEAPONS[p.wi].id; sfx('click');
  G.msg = WEAPONS[p.wi].name; G.msgT = 0.8;
}
function startReload(p, w) { if (p.reloadT <= 0) { p.reloadT = w.reload; sfx('reload'); } }
function playerFire(p, w) {
  p.atkT = p.atkDur = w.rate; p.ammo[w.id]--;
  const dm = 1 + 0.08 * save.upg.dmg, n = w.pellets || 1;
  for (let i = 0; i < n; i++) {
    const ang = (Math.random() - 0.5) * 2 * (w.spread || 0);
    G.bullets.push({ x: p.x + p.face * (w.len + 14), y: p.y - 44, vx: Math.cos(ang) * p.face * w.speed, vy: Math.sin(ang) * w.speed,
      dmg: w.dmg * dm, life: w.life, from: 'p', pierce: w.pierce || 0, rocket: !!w.rocket, col: w.col, hit: [] });
  }
  spark(p.x + p.face * (w.len + 16), p.y - 44, 3, '#ffe27a', 160);
  G.shake = Math.max(G.shake, w.rocket ? 5 : w.pellets ? 3 : 1);
  p.vx -= p.face * (w.pellets ? 90 : 25);
  sfx(w.snd);
  if (p.ammo[w.id] <= 0) startReload(p, w);
}
function doMelee(p, w) {
  const dm = 1 + 0.08 * save.upg.dmg;
  const boost = 1 + Math.min(p.combo, 30) * 0.01;
  let hit = false;
  for (const e of G.enemies.slice()) {
    if (e.dead) continue;
    const dx = (e.x - p.x) * p.face;
    if (dx > -12 && dx < w.range + e.w * e.sc && Math.abs(e.y - p.y) < 70) { hurtEnemy(e, w.dmg * dm * boost, p.face * w.kb); hit = true; }
  }
  if (hit) { sfx(w.id === 'fist' ? 'punch' : 'hit'); G.hitstop = 0.05; G.shake = Math.max(G.shake, 3); }
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    if (b.from === 'e' && b.kind !== 'wave' && (b.x - p.x) * p.face > -10 && (b.x - p.x) * p.face < w.range + 20 && Math.abs(b.y - (p.y - 40)) < 50) { spark(b.x, b.y, 4, '#fff', 200); G.bullets.splice(i, 1); }
  }
}
function rage() {
  const p = G.p, dm = 1 + 0.08 * save.upg.dmg;
  p.en = 0; p.inv = 1.0; sfx('rage'); G.shake = 16; G.hitstop = 0.15;
  G.rings.push({ x: p.x, y: p.y - 30, r: 0, max: 320, t: 0, life: 0.5, col: '#7df' });
  G.rings.push({ x: p.x, y: p.y - 30, r: 0, max: 220, t: 0, life: 0.35, col: '#fff' });
  spark(p.x, p.y - 30, 30, '#7df', 500);
  for (const e of G.enemies.slice()) if (!e.dead && Math.abs(e.x - p.x) < 320) hurtEnemy(e, 170 * dm, sign(e.x - p.x) * 500);
  G.bullets = G.bullets.filter(b => b.from !== 'e');
}
function updPlayer(dt) {
  const p = G.p, w = WEAPONS[p.wi];
  p.inv = Math.max(0, p.inv - dt); p.comboT -= dt; if (p.comboT <= 0) p.combo = 0;
  if (p.dead) { p.vy += 1500 * dt; p.y = Math.min(GROUND, p.y + p.vy * dt); return; }
  p.hurtT = Math.max(0, p.hurtT - dt);
  if (pressed.swap) swapWeapon();
  if (pressed.special && p.en >= 100) rage();
  const mx = inp.right - inp.left, spd = 235 * (1 + 0.04 * save.upg.spd);
  if (p.hurtT > 0) { p.vx = p.kbv; p.kbv *= Math.pow(0.01, dt); }
  else {
    const slow = (p.atkT > 0 && w.type === 'melee') ? 0.6 : (p.reloadT > 0 ? 0.85 : 1);
    p.vx += (mx * spd * slow - p.vx) * Math.min(1, dt * 16);
  }
  if (mx !== 0 && p.atkT <= 0 && !inp.atk) p.face = mx;
  if (pressed.jump && p.jumps > 0 && p.hurtT <= 0) { p.vy = p.jumps === 2 ? -570 : -520; p.jumps--; p.ground = false; sfx('jump'); spark(p.x, p.y, 4, '#ccc', 120); }
  p.x = clamp(p.x + p.vx * dt, 20, G.def.LW - 20);
  p.vy += 1500 * dt; p.y += p.vy * dt;
  if (p.y >= GROUND) { p.y = GROUND; p.vy = 0; p.ground = true; p.jumps = 2; } else p.ground = false;
  p.anim += dt * Math.abs(p.vx) / 27;
  if (p.atkT > 0) p.atkT -= dt;
  if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) { p.reloadT = 0; if (w.type === 'gun') p.ammo[w.id] = w.mag; } }
  if (inp.atk && p.atkT <= 0 && p.hurtT <= 0 && !(w.type === 'gun' && p.reloadT > 0)) {
    const tg = closestEnemy(p, 420); if (tg) p.face = sign(tg.x - p.x);
    if (w.type === 'melee') { p.atkT = p.atkDur = w.rate; p.hitDone = false; sfx('swing'); }
    else if (p.ammo[w.id] <= 0) startReload(p, w);
    else playerFire(p, w);
  }
  if (!p.hitDone && p.atkT <= p.atkDur * 0.55) { p.hitDone = true; doMelee(p, w); }
}
function updAllies(dt) {
  const p = G.p;
  G.allies.forEach((a, i) => {
    if (a.dead) return;
    a.flash = Math.max(0, a.flash - dt); a.cd -= dt;
    const want = p.x - p.face * (70 + i * 50), dxw = want - a.x;
    a.mv = Math.abs(dxw) > 14 ? sign(dxw) * 210 : 0;
    if (Math.abs(a.x - p.x) > 700) a.x = want;
    const tg = closestEnemy(a, 480);
    if (tg) {
      a.face = sign(tg.x - a.x);
      if (a.cd <= 0) {
        a.cd = 0.4;
        G.bullets.push({ x: a.x + a.face * 24, y: a.y - 44, vx: a.face * 900, vy: rnd(-20, 20), dmg: 14 * (1 + 0.08 * save.upg.dmg), life: 0.6, from: 'a', pierce: 0, col: '#8cf', hit: [] });
        sfx('shoot');
      }
      if (Math.abs(tg.x - a.x) < 150) a.mv *= 0.3;
    } else if (a.mv) a.face = sign(a.mv);
    a.x = clamp(a.x + a.mv * dt, 20, G.def.LW - 20);
    a.anim += dt * Math.abs(a.mv) / 27;
  });
}

function updBullets(dt) {
  const p = G.p;
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let kill = b.life <= 0 || b.x < -100 || b.x > G.def.LW + 100;
    if (!kill && b.from !== 'e') {
      for (const e of G.enemies) {
        if (e.dead || b.hit.includes(e)) continue;
        if (Math.abs(b.x - e.x) < e.w * e.sc + 6 && b.y > e.y - e.h * e.sc - 8 && b.y < e.y + 6) {
          if (b.rocket) { explode(b.x, b.y, 115, b.dmg, 'p'); kill = true; break; }
          b.hit.push(e); hurtEnemy(e, b.dmg, sign(b.vx) * 120);
          if (b.pierce > 0) b.pierce--; else { kill = true; break; }
        }
      }
      if (!kill && b.rocket && b.y > GROUND) { explode(b.x, GROUND - 5, 115, b.dmg, 'p'); kill = true; }
    } else if (!kill) {
      if (b.kind === 'wave') {
        if (!p.dead && Math.abs(b.x - p.x) < 24 && p.y > GROUND - 34) { hurtPlayer(b.dmg, b.x); kill = true; }
        for (const a of G.allies) if (!a.dead && Math.abs(b.x - a.x) < 24) { hurtAlly(a, b.dmg); kill = true; }
      } else {
        if (!p.dead && Math.abs(b.x - p.x) < 16 && b.y > p.y - 66 && b.y < p.y) { hurtPlayer(b.dmg, b.x); kill = true; }
        else for (const a of G.allies) if (!a.dead && Math.abs(b.x - a.x) < 16 && b.y > a.y - 66 && b.y < a.y) { hurtAlly(a, b.dmg); kill = true; break; }
        if (b.y > GROUND + 4) kill = true;
      }
    }
    if (kill) G.bullets.splice(i, 1);
  }
}
function updDrops(dt) {
  const p = G.p;
  for (let i = G.drops.length - 1; i >= 0; i--) {
    const d = G.drops[i];
    d.life -= dt;
    d.vy += 1100 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
    if (d.y > GROUND - 8) { d.y = GROUND - 8; d.vy *= -0.35; d.vx *= 0.8; if (Math.abs(d.vy) < 40) d.vy = 0; }
    const dx = p.x - d.x, dy = (p.y - 30) - d.y, dist = Math.max(1, Math.hypot(dx, dy));
    if (!p.dead && d.t === 'coin' && dist < 150) { d.x += dx / dist * 520 * dt; d.y += dy / dist * 520 * dt; d.vy = 0; }
    if (!p.dead && dist < 34) {
      if (d.t === 'coin') { save.coins += d.v; G.earned += d.v; if (G.t - lastCoinSfx > 0.07 || G.t < lastCoinSfx) { sfx('coin'); lastCoinSfx = G.t; } addText(d.x, d.y - 10, '+' + d.v, '#ffd23f'); }
      else { p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.3); addText(p.x, p.y - 85, '+HP', '#6f6'); sfx('coin'); }
      G.drops.splice(i, 1); continue;
    }
    if (d.life <= 0) G.drops.splice(i, 1);
  }
}
function updFx(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) { const q = G.parts[i]; q.life -= dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.life <= 0) G.parts.splice(i, 1); }
  for (let i = G.texts.length - 1; i >= 0; i--) { const q = G.texts[i]; q.life -= dt; q.y -= 40 * dt; if (q.life <= 0) G.texts.splice(i, 1); }
  for (let i = G.rings.length - 1; i >= 0; i--) { const q = G.rings[i]; q.t += dt; q.r = q.max * Math.min(1, q.t / q.life); if (q.t >= q.life) G.rings.splice(i, 1); }
  for (let i = G.corpses.length - 1; i >= 0; i--) { const q = G.corpses[i]; q.t += dt; if (q.t > 1.1) G.corpses.splice(i, 1); }
  if (G.parts.length > 400) G.parts.splice(0, G.parts.length - 400);
}
function step(rdt) {
  if (!G) return;
  let dt = rdt;
  if (G.hitstop > 0) { G.hitstop -= rdt; dt = rdt * 0.12; }
  G.t += dt;
  if (G.msgT > 0) G.msgT -= dt;
  if (G.tipT > 0) G.tipT -= dt;
  const d = G.def;
  updPlayer(dt); updAllies(dt);
  G.spT -= dt;
  if (!G.p.dead) {
    if (G.spawned < d.count && G.spT <= 0 && G.enemies.length < d.cap) {
      G.spT = d.interval * rnd(0.7, 1.3);
      const type = d.pool[(Math.random() * d.pool.length) | 0];
      addEnemy(type, clamp(Math.random() < 0.5 ? G.cam - 50 : G.cam + W + 50, -40, d.LW + 40));
      G.spawned++;
    }
    if (G.spawned >= d.count && d.boss >= 0 && !G.boss && !G.bossDone && G.enemies.length === 0) spawnBoss();
  }
  for (const e of G.enemies.slice()) if (!e.dead) updEnemy(e, dt);
  G.enemies = G.enemies.filter(e => !e.dead);
  updBullets(dt); updDrops(dt); updFx(dt);
  const p = G.p;
  const target = clamp(p.x - W * 0.42 + p.face * 70, 0, d.LW - W);
  G.cam += (target - G.cam) * Math.min(1, dt * 5);
  G.shake = Math.max(0, G.shake - dt * 40);
  if (!G.clear && !p.dead && G.spawned >= d.count && G.enemies.length === 0 && (d.boss < 0 || G.bossDone)) { G.clear = true; G.clearT = 1.4; }
  if (G.clear) { G.clearT -= rdt; if (G.clearT <= 0) { completeLevel(); return; } }
  if (p.dead) { G.deadT -= rdt; if (G.deadT <= 0) { persist(); go('dead'); return; } }
  music(rdt, !!G.boss);
  pressed = {};
}
function completeLevel() {
  const bonus = 100 + G.n * 40;
  save.coins += bonus; G.bonus = bonus; G.earned += bonus;
  if (G.n >= save.unlocked) save.unlocked = G.n + 1;
  const r = G.p.hp / G.p.maxhp, st = r > 0.66 ? 3 : r > 0.33 ? 2 : 1;
  G.stars = st; save.stars[G.n] = Math.max(save.stars[G.n] || 0, st);
  persist(); sfx('win'); go('clear');
}

/* ---------- ui state ---------- */
function btn(x, y, w, h, label, fn, o) { buttons.push(Object.assign({ x, y, w, h, label, fn }, o || {})); }
function go(s) {
  state = s; buttons = [];
  const touch = document.getElementById('touch');
  if (touch) touch.classList.toggle('hide', s !== 'play');
  for (const k in inp) inp[k] = 0;
  document.querySelectorAll('#touch button').forEach(b => b.classList.remove('on'));
  const cx = W / 2 - 110;
  if (s === 'menu') {
    btn(cx, 250, 220, 54, 'PLAY  L' + save.unlocked, () => { tryFullscreen(); startLevel(save.unlocked); }, { fs: 24 });
    btn(cx, 314, 220, 50, 'LEVELS', () => go('levels'));
    btn(cx, 372, 220, 50, 'SHOP', () => { shopFrom = 'menu'; go('shop'); });
    btn(W - 120, H - 54, 104, 40, muted ? 'SOUND OFF' : 'SOUND ON', () => { muted = !muted; save.muted = muted; persist(); go('menu'); }, { fs: 14 });
  } else if (s === 'levels') {
    const bw = 200, bh = 84, gx = 16, x0 = (W - 4 * bw - 3 * gx) / 2;
    for (let i = 0; i < 12; i++) {
      const n = i + 1, x = x0 + (i % 4) * (bw + gx), y = 120 + ((i / 4) | 0) * (bh + gx);
      btn(x, y, bw, bh, 'LEVEL ' + n, () => startLevel(n), { off: n > save.unlocked, lvl: n });
    }
    btn(20, H - 58, 120, 42, 'BACK', () => go('menu'), { fs: 18 });
  } else if (s === 'shop') {
    let y = 104;
    WEAPONS.forEach(w => {
      btn(30, y, 440, 40, w.name, () => {
        if (save.owned.includes(w.id)) { save.equip = w.id; persist(); toast(w.name + ' equipped'); go('shop'); }
        else if (save.coins >= w.price) { save.coins -= w.price; save.owned.push(w.id); save.equip = w.id; persist(); sfx('buy'); toast(w.name + ' bought!'); go('shop'); }
        else toast('Not enough coins');
      }, { shopW: w });
      y += 46;
    });
    y = 104;
    UPG.forEach(u => {
      btn(500, y, 430, 56, u.name, () => {
        const lv = save.upg[u.k];
        if (lv >= u.max) { toast('Maxed out'); return; }
        const c = upgCost(u);
        if (save.coins >= c) { save.coins -= c; save.upg[u.k]++; persist(); sfx('buy'); toast(u.name + ' upgraded!'); go('shop'); }
        else toast('Not enough coins');
      }, { shopU: u });
      y += 64;
    });
    btn(20, H - 58, 120, 42, 'BACK', () => go(shopFrom === 'pause' && G ? 'pause' : 'menu'), { fs: 18 });
    btn(W - 240, H - 58, 220, 42, 'NEXT LEVEL', () => startLevel(save.unlocked), { fs: 18 });
  } else if (s === 'play') {
    btn(W - 58, 10, 48, 40, 'II', () => togglePause(), { fs: 20, hud: true });
  } else if (s === 'pause') {
    btn(cx, 200, 220, 52, 'RESUME', () => go('play'), { fs: 22 });
    btn(cx, 264, 220, 48, 'RESTART', () => startLevel(G.n));
    btn(cx, 322, 220, 48, 'SHOP', () => { shopFrom = 'pause'; go('shop'); });
    btn(cx, 380, 220, 48, 'MENU', () => { persist(); go('menu'); });
  } else if (s === 'clear') {
    btn(cx, 300, 220, 54, 'NEXT LEVEL', () => startLevel(G.n + 1), { fs: 22 });
    btn(cx, 364, 220, 46, 'SHOP', () => { shopFrom = 'menu'; go('shop'); });
    btn(cx, 418, 220, 46, 'MENU', () => go('menu'));
  } else if (s === 'dead') {
    btn(cx, 300, 220, 54, 'RETRY', () => startLevel(G.n), { fs: 22 });
    btn(cx, 364, 220, 46, 'SHOP', () => { shopFrom = 'menu'; go('shop'); });
    btn(cx, 418, 220, 46, 'MENU', () => go('menu'));
  }
}
function togglePause() {
  if (state === 'play') go('pause');
  else if (state === 'pause') go('play');
}
function tryFullscreen() {
  try { const el = document.documentElement; if (!document.fullscreenElement && el.requestFullscreen) { const r = el.requestFullscreen(); if (r && r.catch) r.catch(() => {}); } } catch (e) {}
}

addEventListener('keydown', e => {
  audioInit();
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { togglePause(); return; }
  const k = KM[e.key];
  if (k) { setK(k, 1); e.preventDefault(); }
});
addEventListener('keyup', e => { const k = KM[e.key]; if (k) setK(k, 0); });
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k;
  const dn = e => { e.preventDefault(); audioInit(); setK(k, 1); b.classList.add('on'); };
  const up = e => { e.preventDefault(); setK(k, 0); b.classList.remove('on'); };
  b.addEventListener('pointerdown', dn);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
  b.addEventListener('contextmenu', e => e.preventDefault());
});
cv.addEventListener('pointerdown', e => {
  audioInit();
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
  for (const b of buttons) {
    if (!b.off && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { sfx('click'); b.fn(); break; }
  }
});
addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden) { persist(); if (state === 'play') go('pause'); } });
addEventListener('pagehide', persist);
