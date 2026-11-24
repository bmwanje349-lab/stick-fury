'use strict';
/* ===== STICK FURY - rendering, main loop, boot ===== */
let T = 0;
function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function txt(s, x, y, size, col, align, weight) {
  ctx.font = (weight || 'bold') + ' ' + size + 'px system-ui,Arial,sans-serif';
  ctx.fillStyle = col || '#fff'; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}
function outlineTxt(s, x, y, size, col, align) {
  ctx.font = 'bold ' + size + 'px system-ui,Arial,sans-serif'; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, size / 7); ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y);
  ctx.fillStyle = col || '#fff'; ctx.fillText(s, x, y);
}

/* ---------- stickman ---------- */
function drawStick(x, y, face, sc, col, o) {
  o = o || {};
  const c = ctx;
  c.save(); c.translate(x, y); c.scale(face * sc, sc);
  if (o.blink) c.globalAlpha = 0.45;
  const stroke = o.flash > 0 ? '#fff' : col;
  c.strokeStyle = stroke; c.fillStyle = stroke; c.lineWidth = 4.2; c.lineCap = 'round'; c.lineJoin = 'round';
  const ph = Math.sin(o.t || 0), air = !!o.air;
  const fa = air ? [10, -6] : [ph * 14, 0], fb = air ? [-8, -2] : [-ph * 14, 0];
  if (o.scarf) {
    c.save(); c.strokeStyle = '#e8383d'; c.lineWidth = 3.4;
    c.beginPath(); c.moveTo(-2, -50);
    c.quadraticCurveTo(-14, -50 + Math.sin(T * 12) * 3, -24 - Math.abs(o.sp || 0) * 0.04, -46 + Math.sin(T * 10 + 1) * 5);
    c.stroke(); c.restore();
  }
  c.beginPath();
  c.moveTo(0, -27); c.quadraticCurveTo(fa[0] / 2 + 5, -14, fa[0], fa[1]);
  c.moveTo(0, -27); c.quadraticCurveTo(fb[0] / 2 + 5, -14, fb[0], fb[1]);
  c.moveTo(0, -27); c.lineTo(0, -49);
  c.stroke();
  c.beginPath(); c.arc(0, -58, 8.5, 0, 7); c.fill();
  if (o.boss) {
    c.beginPath(); c.moveTo(-6, -64); c.lineTo(-10, -76); c.moveTo(6, -64); c.lineTo(10, -76); c.stroke();
  }
  if (o.scarf) { c.save(); c.strokeStyle = '#e8383d'; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, -61); c.lineTo(8.5, -61); c.stroke(); c.restore(); }
  if (o.zombie) { c.fillStyle = '#ff2a2a'; c.fillRect(2, -60, 4, 3); }
  const sx = 0, sy = -46;
  const arm = (a, len) => { const hx = sx + Math.cos(a) * len, hy = sy + Math.sin(a) * len; c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke(); return [hx, hy]; };
  if (o.gun) {
    const rec = -3 * (o.atk || 0);
    const h = arm(-0.05, 22 + rec); arm(0.35, 18);
    c.fillStyle = '#222'; c.fillRect(h[0] - 2, h[1] - o.gun.th / 2 - 1, o.gun.len, o.gun.th);
    if (o.gun.id === 'minigun') { c.fillStyle = '#555'; c.fillRect(h[0] + 4, h[1] - 6, o.gun.len - 4, 3); c.fillRect(h[0] + 4, h[1] + 3, o.gun.len - 4, 3); }
    if ((o.atk || 0) > 0.6) { c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(h[0] + o.gun.len + 4, h[1], 5 + Math.random() * 3, 0, 7); c.fill(); }
  } else if (o.zombie) {
    const up = o.wind || 0, a = -0.05 - 1.6 * up;
    arm(a, 22); arm(a + 0.18, 20);
  } else {
    const wp = o.melee, L = wp ? wp.len : 0, sw = o.atk || 0;
    if (sw > 0) {
      const prog = 1 - sw;
      if (L === 0) { arm(-0.1, 14 + 18 * Math.sin(prog * Math.PI)); arm(0.9, 16); }
      else {
        const a = -2.1 + prog * 3.4, h = arm(a, 22);
        c.save(); c.strokeStyle = wp.col; c.lineWidth = wp.lw;
        c.beginPath(); c.moveTo(h[0], h[1]); c.lineTo(h[0] + Math.cos(a) * L, h[1] + Math.sin(a) * L); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 7;
        c.beginPath(); c.arc(sx, sy, 22 + L * 0.8, -2.1, a); c.stroke(); c.restore();
        arm(0.8, 16);
      }
    } else {
      const a1 = 0.9 + ph * 0.5, h = arm(a1, 20); arm(0.9 - ph * 0.5, 20);
      if (L > 0) { c.save(); c.strokeStyle = wp.col; c.lineWidth = wp.lw; c.beginPath(); c.moveTo(h[0], h[1]); c.lineTo(h[0] + Math.cos(a1 - 0.5) * L, h[1] + Math.sin(a1 - 0.5) * L); c.stroke(); c.restore(); }
    }
  }
  c.restore();
}
function drawPlayer() {
  const p = G.p, w = WEAPONS[p.wi], th = THEMES[G.def.th];
  const col = th.dark ? '#eeeeee' : '#111111';
  drawStick(p.x, p.y, p.face, 1, col, { t: p.anim, air: !p.ground, gun: w.type === 'gun' ? w : null, melee: w.type === 'melee' ? w : null,
    atk: p.atkT > 0 ? p.atkT / Math.max(0.01, p.atkDur) : 0, flash: p.hurtT > 0 ? 1 : 0, scarf: true, sp: p.vx,
    blink: p.inv > 0 && !p.dead && ((T * 20) | 0) % 2 === 0 });
}
function drawEnemy(e) {
  drawStick(e.x, e.y, e.face, e.sc, e.col, { t: e.anim, air: e.y < GROUND - 3, zombie: true, flash: e.flash > 0 ? 1 : 0,
    wind: e.wind > 0 ? 1 - e.wind / 0.35 : (e.st && e.st.startsWith('tele_') ? 1 : 0), boss: e.boss });
  if (e.boss && e.st && e.st.startsWith('tele_')) {
    ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(T * 30); outlineTxt('!', e.x, e.y - e.h * e.sc - 36, 30, '#ff4040'); ctx.restore();
  }
  if (!e.boss && e.hp < e.maxhp) {
    const bw = 34 * Math.max(1, e.sc * 0.8), bx = e.x - bw / 2, by = e.y - e.h * e.sc - 22;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
    ctx.fillStyle = '#e44'; ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxhp), 4);
  }
}

/* ---------- background ---------- */
function drawBG(th, bg, cam) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (th.stars) {
    ctx.fillStyle = '#fff';
    for (const s of bg.stars) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(T * 2 + s.x); ctx.fillRect(s.x, s.y, s.r, s.r); }
    ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = 0.9; ctx.fillStyle = th.sun; ctx.beginPath(); ctx.arc(720 - cam * 0.03, 110, 44, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  const layer = (arr, f, col, near) => {
    const off = cam * f; ctx.fillStyle = col;
    for (const b of arr) {
      const x = b.x - off;
      if (x > W || x + b.w < 0) continue;
      if (th.shape === 'mnt') {
        ctx.beginPath(); ctx.moveTo(x - b.w * 0.2, GROUND); ctx.lineTo(x + b.w / 2, GROUND - b.h * (near ? 0.9 : 1.2)); ctx.lineTo(x + b.w * 1.2, GROUND); ctx.closePath(); ctx.fill();
      } else {
        ctx.fillRect(x, GROUND - b.h, b.w, b.h);
        if (th.win && near) {
          ctx.fillStyle = th.n === 'Neon City' ? '#ff2bd6' : '#ffd86b';
          for (let wy = GROUND - b.h + 10; wy < GROUND - 14; wy += 18) for (let wx = x + 8; wx < x + b.w - 10; wx += 16) if (((wx * 7 + wy * 13 + b.s * 100) | 0) % 3 === 0) ctx.fillRect(wx, wy, 6, 8);
          ctx.fillStyle = col;
        }
      }
    }
  };
  layer(bg.far, 0.2, th.far, false); layer(bg.near, 0.5, th.near, true);
  ctx.fillStyle = th.ground; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = th.line; ctx.fillRect(0, GROUND, W, 3);
  const o = cam % 100;
  for (let x = -o; x < W; x += 100) ctx.fillRect(x, GROUND + 46, 44, 4);
}

/* ---------- world ---------- */
function drawWorld() {
  const th = THEMES[G.def.th];
  ctx.save();
  if (G.shake > 0) ctx.translate(rnd(-1, 1) * G.shake * 0.5, rnd(-1, 1) * G.shake * 0.5);
  drawBG(th, G.bg, G.cam);
  ctx.translate(-Math.round(G.cam), 0);
  for (const q of G.corpses) {
    const ang = Math.min(1.5, q.t * 6);
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - q.t / 1.1);
    ctx.translate(q.x - q.face * q.t * 40, q.y); ctx.rotate(-q.face * ang);
    drawStick(0, 0, q.face, q.sc, q.col, { zombie: true });
    ctx.restore();
  }
  for (const d of G.drops) {
    if (d.t === 'coin') {
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a77b00'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(d.x, d.y, Math.abs(Math.cos(T * 6 + d.x)) * 6 + 2, 7, 0, 0, 7); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = '#fff'; ctx.fillRect(d.x - 9, d.y - 9, 18, 18); ctx.fillStyle = '#e33'; ctx.fillRect(d.x - 2, d.y - 7, 4, 14); ctx.fillRect(d.x - 7, d.y - 2, 14, 4);
    }
  }
  for (const e of G.enemies) drawEnemy(e);
  const ac = th.dark ? '#7cf' : '#1f6fd0';
  for (const a of G.allies) {
    if (a.dead) continue;
    drawStick(a.x, a.y, a.face, 0.95, ac, { t: a.anim, gun: WEAPONS[wIndex('pistol')], flash: a.flash > 0 ? 1 : 0 });
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(a.x - 17, a.y - 78, 34, 5);
    ctx.fillStyle = '#4af'; ctx.fillRect(a.x - 16, a.y - 77, 32 * Math.max(0, a.hp / a.maxhp), 3);
  }
  drawPlayer();
  for (const b of G.bullets) {
    if (b.kind === 'wave') {
      ctx.fillStyle = b.col; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(b.x - Math.sign(b.vx) * 26, GROUND); ctx.lineTo(b.x, GROUND - 36); ctx.lineTo(b.x + Math.sign(b.vx) * 10, GROUND); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    } else if (b.from === 'e') {
      ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 7); ctx.fill();
    } else if (b.rocket) {
      ctx.fillStyle = '#ff7a3a'; ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,100,.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.05, b.y - b.vy * 0.05); ctx.stroke();
    } else {
      ctx.strokeStyle = b.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.025, b.y - b.vy * 0.025); ctx.stroke();
    }
  }
  for (const q of G.parts) { ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.col; ctx.fillRect(q.x, q.y, q.sz, q.sz); }
  ctx.globalAlpha = 1;
  for (const r of G.rings) { ctx.globalAlpha = Math.max(0, 1 - r.t / r.life); ctx.strokeStyle = r.col; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (const q of G.texts) { ctx.globalAlpha = Math.min(1, q.life * 2); outlineTxt(q.s, q.x, q.y, 16, q.col); }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ---------- HUD ---------- */
function bar(x, y, w, h, frac, col) {
  ctx.fillStyle = 'rgba(0,0,0,.6)'; roundRect(x - 2, y - 2, w + 4, h + 4, 5); ctx.fill();
  ctx.fillStyle = col; if (frac > 0) { roundRect(x, y, w * Math.min(1, frac), h, 4); ctx.fill(); }
}
function drawHUD() {
  const p = G.p, w = WEAPONS[p.wi];
  bar(16, 14, 220, 16, p.hp / p.maxhp, p.hp / p.maxhp > 0.3 ? '#e8423f' : '#ff9a2a');
  txt(Math.ceil(p.hp) + ' / ' + p.maxhp, 126, 22, 12, '#fff', 'center');
  bar(16, 38, 160, 10, p.en / 100, p.en >= 100 ? '#7df' : '#3a8fd0');
  if (p.en >= 100) txt('RAGE READY!', 186, 43, 12, '#7df');
  const ammo = w.type === 'gun' ? (p.reloadT > 0 ? 'RELOADING...' : p.ammo[w.id] + ' / ' + w.mag) : 'MELEE';
  outlineTxt(w.name + '   ' + ammo, 16, 66, 15, '#fff', 'left');
  outlineTxt('\u25CF ' + save.coins, W / 2, 20, 20, '#ffd23f');
  outlineTxt('LEVEL ' + G.n + '   ' + Math.min(G.killed, G.def.count) + ' / ' + G.def.count + (G.def.boss >= 0 ? ' + BOSS' : ''), W / 2, 44, 14, '#fff');
  if (p.combo >= 3) outlineTxt('x' + p.combo + ' COMBO', W - 130, 34, 20, '#ffb03a', 'right');
  if (G.boss) {
    const b = G.boss, bw = 420, bx = W / 2 - bw / 2;
    bar(bx, 70, bw, 14, b.hp / b.maxhp, b.enr ? '#ff3a3a' : '#d6a02a');
    outlineTxt(b.name, W / 2, 98, 14, '#fff');
  }
  if (G.msgT > 0) { ctx.globalAlpha = Math.min(1, G.msgT * 2); outlineTxt(G.msg, W / 2, 150, 40, '#fff'); ctx.globalAlpha = 1; }
  if (G.tipT > 0) outlineTxt(isTouch ? 'Move with the arrows. ATTACK shoots. RAGE needs a full blue bar.' : 'A/D move, W jump, J attack, Q swap, L rage', W / 2, H - 150, 16, '#fff');
  if (G.clear) outlineTxt('LEVEL CLEAR!', W / 2, 200, 48, '#ffd23f');
  const bx = document.getElementById('bx');
  if (bx) { const r = p.en >= 100; if (r !== drawHUD.r) { drawHUD.r = r; bx.classList.toggle('ready', r); } }
}

/* ---------- screens ---------- */
let menuBG = null;
function drawMenuBG() {
  if (!menuBG) menuBG = genBG(THEMES[0], 3000);
  drawBG(THEMES[0], menuBG, (T * 30) % 1400);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H);
}
function stars3(x, y, n, sz) {
  for (let i = 0; i < 3; i++) { ctx.fillStyle = i < n ? '#ffd23f' : 'rgba(255,255,255,.25)'; ctx.font = 'bold ' + sz + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('\u2605', x + (i - 1) * sz * 1.1, y); }
}
function drawButtons() {
  for (const b of buttons) {
    ctx.globalAlpha = b.off ? 0.4 : 1;
    roundRect(b.x, b.y, b.w, b.h, 10);
    let eq = false;
    if (b.shopW) eq = save.equip === b.shopW.id;
    ctx.fillStyle = b.hud ? 'rgba(0,0,0,.45)' : eq ? 'rgba(60,50,10,.9)' : 'rgba(18,22,38,.88)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = eq ? '#ffd23f' : b.hud ? 'rgba(255,255,255,.6)' : '#7a8bb8'; ctx.stroke();
    if (b.shopW) {
      const w = b.shopW, own = save.owned.includes(w.id);
      txt(w.name, b.x + 14, b.y + 14, 16, '#fff');
      txt('dmg ' + w.dmg + (w.pellets ? 'x' + w.pellets : '') + '  ' + (w.type === 'gun' ? 'mag ' + w.mag : 'melee'), b.x + 14, b.y + 30, 11, '#9aa6c8', 'left', 'normal');
      txt(eq ? 'EQUIPPED' : own ? 'OWNED' : '\u25CF ' + w.price, b.x + b.w - 14, b.y + b.h / 2, 16, eq ? '#ffd23f' : own ? '#7dd87d' : (save.coins >= w.price ? '#ffd23f' : '#d66'), 'right');
    } else if (b.shopU) {
      const u = b.shopU, lv = save.upg[u.k];
      txt(u.name + '  Lv ' + lv + '/' + u.max, b.x + 14, b.y + 18, 17, '#fff');
      txt(u.desc, b.x + 14, b.y + 40, 12, '#9aa6c8', 'left', 'normal');
      const c = upgCost(u);
      txt(lv >= u.max ? 'MAX' : '\u25CF ' + c, b.x + b.w - 14, b.y + b.h / 2, 18, lv >= u.max ? '#7dd87d' : (save.coins >= c ? '#ffd23f' : '#d66'), 'right');
    } else if (b.lvl) {
      const n = b.lvl, def = levelDef(n);
      txt(b.off ? '\uD83D\uDD12 LEVEL ' + n : 'LEVEL ' + n, b.x + b.w / 2, b.y + 24, 20, '#fff', 'center');
      txt(THEMES[def.th].n + (def.boss >= 0 ? '  -  BOSS' : ''), b.x + b.w / 2, b.y + 46, 12, def.boss >= 0 ? '#ff7a7a' : '#9aa6c8', 'center', 'normal');
      if (!b.off) stars3(b.x + b.w / 2, b.y + 68, save.stars[n] || 0, 16);
    } else txt(b.label, b.x + b.w / 2, b.y + b.h / 2, b.fs || 20, '#fff', 'center');
    ctx.globalAlpha = 1;
  }
}
function drawMenu() {
  drawMenuBG();
  outlineTxt('STICK FURY', W / 2, 108, 78, '#ffd23f');
  outlineTxt('RAGE OF THE STICKMEN', W / 2, 168, 24, '#fff');
  const rx = ((T * 150) % 1300) - 150;
  drawStick(rx, GROUND, 1, 1, '#111', { t: T * 9, gun: WEAPONS[wIndex('pistol')], scarf: true, sp: 150, atk: (T * 3) % 1 > 0.85 ? 1 : 0 });
  drawStick(rx - 120, GROUND, 1, 1, '#6fd68a', { t: T * 7, zombie: true });
  drawStick(rx - 200, GROUND, 1, 1.5, '#d65f5f', { t: T * 5, zombie: true });
  txt('\u25CF ' + save.coins, 20, 28, 20, '#ffd23f');
  drawButtons();
}
function drawPanelBG() { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H); }
function render() {
  ctx.setTransform(K, 0, 0, K, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (state === 'menu') drawMenu();
  else if (state === 'levels') { drawMenuBG(); outlineTxt('SELECT LEVEL', W / 2, 60, 40, '#ffd23f'); drawButtons(); }
  else if (state === 'shop') {
    drawMenuBG(); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H);
    outlineTxt('SHOP', W / 2, 44, 38, '#ffd23f'); outlineTxt('\u25CF ' + save.coins, W - 90, 44, 26, '#ffd23f');
    txt('WEAPONS (tap to buy / equip)', 30, 88, 14, '#cfd8ff'); txt('UPGRADES', 500, 88, 14, '#cfd8ff');
    drawButtons();
  } else if (G) {
    drawWorld();
    if (state === 'play') { drawHUD(); drawButtons(); }
    else if (state === 'pause') { drawPanelBG(); outlineTxt('PAUSED', W / 2, 140, 48, '#fff'); drawButtons(); }
    else if (state === 'clear') {
      drawPanelBG(); outlineTxt('LEVEL ' + G.n + ' CLEAR!', W / 2, 90, 50, '#ffd23f');
      stars3(W / 2, 160, G.stars || 1, 44);
      outlineTxt('Coins earned: ' + G.earned + '  (bonus ' + (G.bonus || 0) + ')', W / 2, 220, 22, '#fff');
      outlineTxt('Enemies defeated: ' + G.killed, W / 2, 252, 18, '#cfd8ff');
      drawButtons();
    } else if (state === 'dead') {
      drawPanelBG(); outlineTxt('YOU DIED', W / 2, 100, 56, '#ff5a5a');
      outlineTxt('Coins kept: ' + G.earned, W / 2, 170, 24, '#ffd23f');
      outlineTxt('Tip: buy upgrades and new weapons in the shop', W / 2, 220, 16, '#cfd8ff');
      drawButtons();
    }
  }
  if (toastT > 0) { ctx.globalAlpha = Math.min(1, toastT * 2); roundRect(W / 2 - 150, H - 100, 300, 38, 10); ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fill(); txt(toastMsg, W / 2, H - 81, 16, '#fff', 'center'); ctx.globalAlpha = 1; }
}

/* ---------- loop + boot ---------- */
let lastTs = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts; T += dt;
  if (toastT > 0) toastT -= dt;
  if (state === 'play') step(dt);
  render();
}
loadSave();
go('menu');
window.__SF = { setK, step, render, go, startLevel, inp, save, get G() { return G; }, get state() { return state; }, get buttons() { return buttons; }, levelDef, WEAPONS, UPG };
requestAnimationFrame(frame);
