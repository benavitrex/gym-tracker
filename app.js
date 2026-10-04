'use strict';
const VIEWS = ['home', 'stats', 'train', 'programs', 'profile'];
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const num = v => parseFloat(String(v).replace(',', '.')) || 0;
const dkey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/* ===== Datos ===== */
let S; try { S = JSON.parse(localStorage.getItem('gt')); } catch (e) {}
S = S || {};
S.logs = S.logs || [];
S.plan = S.plan || {};
S.customEx = S.customEx || [];
S.settings = S.settings || { theme: 'oled', units: 'kg' };
S.settings.name = S.settings.name ?? 'Eduardo';
S.goals = S.goals || [
  { name: 'Sentadilla', target: 100 },
  { name: 'Press de banca', target: 80 }
];

let ss = null;
try { ss = JSON.parse(localStorage.getItem('gt_s')); } catch (e) {}
if (ss && !Array.isArray(ss.entries)) ss = null;
if (ss) ss.entries.forEach(e => e.sets.forEach(s => { s.t = s.t || 'E'; }));

const saveS = () => { try { ss ? localStorage.setItem('gt_s', JSON.stringify(ss)) : localStorage.removeItem('gt_s'); } catch (e) {} };
const saveLogs = () => { try { localStorage.setItem('gt', JSON.stringify(S)); } catch (e) {} };

let R = { end: 0, fin: false }, AC = null, wl = null;
let mapSide = 'front', galCat = 'all', galEquip = 'all', galQ = '', chartDays = 30;
let calYear = new Date().getFullYear(), calMonth = new Date().getMonth(); // 0-11
let selectedMuscle = null;

/* ===== Temas ===== */
const THEMES = {
  oled:     { name: 'Lima neón',  bg: '#0C0C0E', surface: '#16161A', line: '#26262c', tx: '#f4f4f5', mu: '#9a9aa5', ac: '#D4FF00' },
  cian:     { name: 'Cian eléctrico', bg: '#0C0C0E', surface: '#16161A', line: '#26262c', tx: '#f4f4f5', mu: '#9a9aa5', ac: '#00F0FF' },
  dracula:  { name: 'Dracula',    bg: '#1e1f29', surface: '#282a36', line: '#44475a', tx: '#f8f8f2', mu: '#8e9ac4', ac: '#ff79c6' },
  rosepine: { name: 'Rosé Pine',  bg: '#191724', surface: '#1f1d2e', line: '#26233a', tx: '#e0def4', mu: '#908caa', ac: '#eb6f92' },
  emerald:  { name: 'Emerald',    bg: '#0b1210', surface: '#12201a', line: '#1c2e26', tx: '#e8f5ef', mu: '#7fa38f', ac: '#34d399' }
};

function applyTheme(key) {
  const t = THEMES[key] || THEMES.oled;
  S.settings.theme = key;
  const r = document.documentElement.style;
  r.setProperty('--bg', t.bg);
  r.setProperty('--surface', t.surface);
  r.setProperty('--line', t.line);
  r.setProperty('--tx', t.tx);
  r.setProperty('--mu', t.mu);
  r.setProperty('--ac', t.ac);
  document.body.style.background = t.bg;
  const meta = $('#meta-theme');
  if (meta) meta.content = t.bg;
  // bottom nav backdrop
  // simpler: keep as is, CSS vars handle most
  saveLogs();
}
applyTheme(S.settings.theme || 'oled');

/* ===== Unidades ===== */
function unitLabel() { return S.settings.units === 'lbs' ? 'lbs' : 'kg'; }
function toDisplay(kg) {
  if (S.settings.units === 'lbs') return +(kg * 2.20462).toFixed(1);
  return +Number(kg).toFixed(1);
}
function fromDisplay(v) {
  const n = num(v);
  if (S.settings.units === 'lbs') return +(n / 2.20462).toFixed(2);
  return n;
}
function fmtWeight(kg) {
  const v = toDisplay(kg);
  return (v % 1 === 0 ? v : v.toFixed(1)) + ' ' + unitLabel();
}

/* ===== Músculos y biblioteca ===== */
const MGROUPS = [
  { k: 'pecho', label: 'Pecho', emoji: '🫁', color: '#ff7a66' },
  { k: 'espalda', label: 'Espalda', emoji: '🔙', color: '#4ad8a0' },
  { k: 'piernas', label: 'Piernas', emoji: '🦵', color: '#6b8cff' },
  { k: 'brazos', label: 'Brazos', emoji: '💪', color: '#ffc857' },
  { k: 'hombros', label: 'Hombros', emoji: '🏋️', color: '#c084fc' },
  { k: 'abdomen', label: 'Abdomen', emoji: '🔥', color: '#f472b6' }
];
const MG = Object.fromEntries(MGROUPS.map(m => [m.k, m]));
const EQUIP = [
  { k: 'barra', label: 'Barra' },
  { k: 'mancuerna', label: 'Mancuerna' },
  { k: 'maquina', label: 'Máquina' },
  { k: 'polea', label: 'Polea' },
  { k: 'peso_corporal', label: 'Peso corporal' }
];

const LIB = [
  { name: 'Press de banca', equip: 'barra', cat: 'pecho', primary: ['pecho'], secondary: ['hombros', 'brazos'] },
  { name: 'Press inclinado con barra', equip: 'barra', cat: 'pecho', primary: ['pecho'], secondary: ['hombros', 'brazos'] },
  { name: 'Press declinado', equip: 'barra', cat: 'pecho', primary: ['pecho'], secondary: ['brazos'] },
  { name: 'Aperturas con mancuernas', equip: 'mancuerna', cat: 'pecho', primary: ['pecho'], secondary: [] },
  { name: 'Fondos en paralelas', equip: 'peso_corporal', cat: 'pecho', primary: ['pecho', 'brazos'], secondary: ['hombros'] },
  { name: 'Press con mancuernas', equip: 'mancuerna', cat: 'pecho', primary: ['pecho'], secondary: ['hombros', 'brazos'] },
  { name: 'Crossover en polea', equip: 'polea', cat: 'pecho', primary: ['pecho'], secondary: [] },
  { name: 'Dominadas', equip: 'peso_corporal', cat: 'espalda', primary: ['espalda'], secondary: ['brazos'] },
  { name: 'Jalón al pecho', equip: 'maquina', cat: 'espalda', primary: ['espalda'], secondary: ['brazos'] },
  { name: 'Remo con barra', equip: 'barra', cat: 'espalda', primary: ['espalda'], secondary: ['brazos'] },
  { name: 'Remo con mancuerna', equip: 'mancuerna', cat: 'espalda', primary: ['espalda'], secondary: ['brazos'] },
  { name: 'Peso muerto', equip: 'barra', cat: 'espalda', primary: ['espalda', 'piernas'], secondary: [] },
  { name: 'Remo en máquina', equip: 'maquina', cat: 'espalda', primary: ['espalda'], secondary: ['brazos'] },
  { name: 'Face pull', equip: 'polea', cat: 'espalda', primary: ['espalda', 'hombros'], secondary: [] },
  { name: 'Hiperextensiones', equip: 'maquina', cat: 'espalda', primary: ['espalda'], secondary: [] },
  { name: 'Sentadilla', equip: 'barra', cat: 'piernas', primary: ['piernas'], secondary: [] },
  { name: 'Prensa de piernas', equip: 'maquina', cat: 'piernas', primary: ['piernas'], secondary: [] },
  { name: 'Peso muerto rumano', equip: 'barra', cat: 'piernas', primary: ['piernas'], secondary: ['espalda'] },
  { name: 'Zancadas', equip: 'mancuerna', cat: 'piernas', primary: ['piernas'], secondary: [] },
  { name: 'Extensiones de cuádriceps', equip: 'maquina', cat: 'piernas', primary: ['piernas'], secondary: [] },
  { name: 'Curl femoral', equip: 'maquina', cat: 'piernas', primary: ['piernas'], secondary: [] },
  { name: 'Elevación de gemelos', equip: 'maquina', cat: 'piernas', primary: ['piernas'], secondary: [] },
  { name: 'Hip thrust', equip: 'barra', cat: 'piernas', primary: ['piernas'], secondary: [] },
  { name: 'Sentadilla búlgara', equip: 'mancuerna', cat: 'piernas', primary: ['piernas'], secondary: [] },
  { name: 'Curl de bíceps con barra', equip: 'barra', cat: 'brazos', primary: ['brazos'], secondary: [] },
  { name: 'Curl con mancuernas', equip: 'mancuerna', cat: 'brazos', primary: ['brazos'], secondary: [] },
  { name: 'Curl martillo', equip: 'mancuerna', cat: 'brazos', primary: ['brazos'], secondary: [] },
  { name: 'Extensiones de tríceps', equip: 'polea', cat: 'brazos', primary: ['brazos'], secondary: [] },
  { name: 'Press francés', equip: 'barra', cat: 'brazos', primary: ['brazos'], secondary: [] },
  { name: 'Fondos de tríceps', equip: 'peso_corporal', cat: 'brazos', primary: ['brazos'], secondary: ['pecho'] },
  { name: 'Curl en polea', equip: 'polea', cat: 'brazos', primary: ['brazos'], secondary: [] },
  { name: 'Press militar', equip: 'barra', cat: 'hombros', primary: ['hombros'], secondary: ['brazos'] },
  { name: 'Elevaciones laterales', equip: 'mancuerna', cat: 'hombros', primary: ['hombros'], secondary: [] },
  { name: 'Elevaciones frontales', equip: 'mancuerna', cat: 'hombros', primary: ['hombros'], secondary: [] },
  { name: 'Pájaros / rear delt', equip: 'mancuerna', cat: 'hombros', primary: ['hombros'], secondary: ['espalda'] },
  { name: 'Press Arnold', equip: 'mancuerna', cat: 'hombros', primary: ['hombros'], secondary: ['brazos'] },
  { name: 'Encogimientos de hombros', equip: 'mancuerna', cat: 'hombros', primary: ['hombros', 'espalda'], secondary: [] },
  { name: 'Crunch', equip: 'peso_corporal', cat: 'abdomen', primary: ['abdomen'], secondary: [] },
  { name: 'Plancha', equip: 'peso_corporal', cat: 'abdomen', primary: ['abdomen'], secondary: [] },
  { name: 'Elevación de piernas', equip: 'peso_corporal', cat: 'abdomen', primary: ['abdomen'], secondary: [] },
  { name: 'Russian twist', equip: 'peso_corporal', cat: 'abdomen', primary: ['abdomen'], secondary: [] },
  { name: 'Ab wheel', equip: 'peso_corporal', cat: 'abdomen', primary: ['abdomen'], secondary: [] },
  { name: 'Cable crunch', equip: 'polea', cat: 'abdomen', primary: ['abdomen'], secondary: [] }
];

function allExercises() { return [...LIB, ...S.customEx]; }
function findEx(name) {
  const n = name.toLowerCase().trim();
  return allExercises().find(e => e.name.toLowerCase() === n) || null;
}
function getMuscles(name) {
  const e = findEx(name);
  if (!e) return { primary: [], secondary: [] };
  return { primary: e.primary || [], secondary: e.secondary || [] };
}

/* ===== Días ===== */
const DAYS = [
  { k: 'mon', n: 'Lunes', short: 'Lun' },
  { k: 'tue', n: 'Martes', short: 'Mar' },
  { k: 'wed', n: 'Miércoles', short: 'Mié' },
  { k: 'thu', n: 'Jueves', short: 'Jue' },
  { k: 'fri', n: 'Viernes', short: 'Vie' },
  { k: 'sat', n: 'Sábado', short: 'Sáb' },
  { k: 'sun', n: 'Domingo', short: 'Dom' }
];
const DAY_MAP = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
function getTodayKey() { return DAY_MAP[new Date().getDay()]; }
function ensureDay(key) {
  if (!S.plan[key]) S.plan[key] = { title: '', exercises: [] };
  return S.plan[key];
}

/* ===== Volumen muscular, radar y sincronía con rutina ===== */
const REDUCED = matchMedia('(prefers-reduced-motion:reduce)').matches;
const RANGES = [{k:'week',l:'Semana',d:7},{k:'month',l:'Mes',d:30},{k:'all',l:'Todo',d:0}];
const RAD = ['pecho','hombros','brazos','abdomen','piernas','espalda'];
let radarRange = 'week', radarPlan = false, homeRange = 'week';
const exVol = sets => (sets || []).reduce((a, s) => a + num(s.kg) * (parseInt(s.reps) || 0), 0);
const zeroVol = () => Object.fromEntries(MGROUPS.map(m => [m.k, 0]));
const maxOf = o => Math.max(0, ...Object.values(o));
function addVol(acc, name, v) {
  const m = getMuscles(name), add = (k, x) => { if (k in acc) acc[k] += x; };
  m.primary.forEach(k => add(k, v));
  m.secondary.forEach(k => { if (!m.primary.includes(k)) add(k, v / 2); });
}
function muscleVolume(range) {
  const acc = zeroVol(), d = RANGES.find(r => r.k === range).d;
  let from = '';
  if (d) { const t = new Date(); t.setDate(t.getDate() - (d - 1)); from = dkey(t); }
  S.logs.forEach(l => { if (l.date >= from) (l.entries || []).forEach(e => addVol(acc, e.name, exVol(e.sets))); });
  return acc;
}
function planVolume() {
  const acc = zeroVol();
  DAYS.forEach(d => ((S.plan[d.k] || {}).exercises || []).forEach(e => addVol(acc, e.name, exVol(e.sets))));
  return acc;
}
function heatFrom(vol) {
  const mx = maxOf(vol), h = {};
  if (mx) for (const k in vol) if (vol[k] > 0) h[k] = Math.max(1, Math.ceil(vol[k] / mx * 5));
  return h;
}
function fmtVol(kg) {
  const v = S.settings.units === 'lbs' ? kg * 2.20462 : kg;
  return v >= 1000 ? (v / 1000).toFixed(1) + ' t' : Math.round(v) + ' ' + unitLabel();
}
function dayMuscles(day) {
  const c = {};
  ((day && day.exercises) || []).forEach(e => {
    const m = getMuscles(e.name);
    m.primary.forEach(k => c[k] = (c[k] || 0) + 2);
    m.secondary.forEach(k => c[k] = (c[k] || 0) + 1);
  });
  return Object.keys(c).filter(k => MG[k]).sort((a, b) => c[b] - c[a]);
}
function muscleChips(day) {
  const ms = dayMuscles(day).slice(0, 4);
  return ms.length ? `<div class="muscle-tags mchips">${ms.map(k => `<span class="mtag p">${MG[k].label}</span>`).join('')}</div>` : '';
}
const radarXY = (i, f) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [160 + 95 * f * Math.cos(a), 140 + 95 * f * Math.sin(a)]; };
const radarPts = (v, max, t) => RAD.map((k, i) => radarXY(i, max ? Math.min(1, v[k] / max) * t : 0).map(n => n.toFixed(1)).join(',')).join(' ');
function rangeTabs(cur, fn) {
  return `<div class="chart-range" role="group" aria-label="Periodo">${RANGES.map(r => `<button class="${cur === r.k ? 'on' : ''}" aria-pressed="${cur === r.k}" onclick="${fn}('${r.k}')">${r.l}</button>`).join('')}</div>`;
}
function setRadarRange(k) { radarRange = k; if (k === 'all') radarPlan = false; renderStats(); }
function setHomeRange(k) { homeRange = k; refreshHomeMap(); }
function radarCard() {
  const real = muscleVolume(radarRange), usePlan = radarPlan && radarRange !== 'all';
  let plan = null;
  if (usePlan) { const pv = planVolume(), f = radarRange === 'month' ? 30 / 7 : 1; plan = zeroVol(); for (const k in pv) plan[k] = pv[k] * f; }
  const max = Math.max(1, maxOf(real), plan ? maxOf(plan) : 0);
  const has = maxOf(real) > 0 || (plan && maxOf(plan) > 0);
  const top = RAD.reduce((a, k) => real[k] > real[a] ? k : a, RAD[0]);
  const rings = [.25, .5, .75, 1].map(f => `<polygon class="radar-ring" points="${RAD.map((k, i) => radarXY(i, f).map(n => n.toFixed(1)).join(',')).join(' ')}"/>`).join('');
  const axes = RAD.map((k, i) => {
    const [x, y] = radarXY(i, 1), [lx, ly] = radarXY(i, 1.22), c = Math.cos(-Math.PI / 2 + i * Math.PI / 3);
    return `<line class="radar-ring" x1="160" y1="140" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="radar-lbl${real[k] > 0 && k === top ? ' hi' : ''}" x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${c > .3 ? 'start' : c < -.3 ? 'end' : 'middle'}">${MG[k].label}</text>`;
  }).join('');
  const center = RAD.map(() => '160,140').join(' ');
  const svg = has ? `<svg class="radar" viewBox="0 0 320 280" role="img" aria-label="Radar de volumen por músculo">${rings}${axes}
    ${plan ? `<polygon id="radar-plan" class="radar-plan" data-vals='${JSON.stringify(plan)}' points="${center}"/>` : ''}
    <polygon id="radar-real" class="radar-real" data-max="${max}" data-vals='${JSON.stringify(real)}' points="${center}"/>
    ${RAD.map(() => '<circle class="radar-dot" r="4" cx="160" cy="140"/>').join('')}</svg>`
    : `<div class="empty"><strong>Sin volumen registrado</strong><span>Termina un entrenamiento y el gráfico se estirará hacia lo que más trabajas.</span></div>`;
  return `<div class="chart-card"><div class="chart-hd"><strong>Distribución por volumen</strong>${rangeTabs(radarRange, 'setRadarRange')}</div>${svg}
    <div class="radar-foot"><button class="chip${usePlan ? ' on' : ''}" aria-pressed="${usePlan}" onclick="radarPlan=!radarPlan;renderStats()"${radarRange === 'all' ? ' disabled' : ''}>Comparar con mi rutina</button>${plan ? '<span class="mu">- - - Rutina programada</span>' : ''}</div>
    ${usePlan && maxOf(plan) === 0 ? '<p class="hint" style="margin:8px 0 0">Tu rutina aún no tiene pesos cargados.</p>' : ''}</div>`;
}
function rankCard() {
  const vol = muscleVolume(radarRange), tot = Object.values(vol).reduce((a, b) => a + b, 0), mx = maxOf(vol);
  const rows = MGROUPS.filter(m => vol[m.k] > 0).sort((a, b) => vol[b.k] - vol[a.k]);
  return `<div class="records-card"><h3>Ranking por volumen</h3>${rows.length ? rows.map((m, i) => `<div class="rk"><span class="rk-ico" aria-hidden="true">${m.emoji}</span><div><div class="rk-top"><span>${m.label}</span><b>${fmtVol(vol[m.k])}</b></div><div class="rk-bar"><i style="--w:${(vol[m.k] / mx * 100).toFixed(1)}%;--i:${i};--c:${m.color}"></i></div></div><span class="rk-pct">${Math.round(vol[m.k] / tot * 100)}%</span></div>`).join('') : '<div class="empty" style="margin:0"><strong>Aún sin ranking</strong><span>Se ordena por kg × reps de cada músculo.</span></div>'}</div>`;
}
function homeMapInner() {
  const heat = heatFrom(muscleVolume(homeRange)), has = Object.keys(heat).length;
  return `<div class="map-hd"><h3>Músculos trabajados</h3>${rangeTabs(homeRange, 'setHomeRange')}</div>
    <div class="map-svg-box">${muscleSVG(mapSide, heat)}</div>
    <div class="map-foot"><div class="map-tog"><button class="${mapSide === 'front' ? 'on' : ''}" onclick="mapSide='front';refreshHomeMap()">Frente</button><button class="${mapSide === 'back' ? 'on' : ''}" onclick="mapSide='back';refreshHomeMap()">Espalda</button></div><div class="ramp"><span>Menos</span><i></i><span>Más</span></div></div>
    <p class="hint" style="text-align:center;margin:8px 0 0">${has ? 'Toca un músculo para ver sus ejercicios.' : 'Registra un entrenamiento y el mapa se iluminará.'}</p>`;
}
function refreshHomeMap() { const el = $('#hmap'); if (el) el.innerHTML = homeMapInner(); }
function animateRadar() {
  const rp = $('#radar-real'); if (!rp) return;
  const pl = $('#radar-plan'), v = JSON.parse(rp.dataset.vals), mx = +rp.dataset.max, pv = pl && JSON.parse(pl.dataset.vals);
  const dots = $$('.radar-dot'), t0 = performance.now(), dur = REDUCED ? 1 : 1000;
  const ease = x => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
  (function f(now) {
    const p = Math.min(1, (now - t0) / dur), t = ease(p);
    rp.setAttribute('points', radarPts(v, mx, t));
    if (pl) pl.setAttribute('points', radarPts(pv, mx, t));
    dots.forEach((d, i) => { const [x, y] = radarXY(i, Math.min(1, v[RAD[i]] / mx) * t); d.setAttribute('cx', x.toFixed(1)); d.setAttribute('cy', y.toFixed(1)); });
    if (p < 1) requestAnimationFrame(f);
  })(t0);
}
function afterRender(root) {
  animateRadar();
  $$('[data-count]', root).forEach(el => {
    const to = +el.dataset.count; if (REDUCED || !to) return;
    const t0 = performance.now();
    (function f(n) { const p = Math.min(1, (n - t0) / 700); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString('es'); if (p < 1) requestAnimationFrame(f); })(t0);
  });
}

/* ===== Inicio bento, PR y serie anterior ===== */
const greet = () => { const h = new Date().getHours(); return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'; };
function weekKg() { const t = new Date(); t.setDate(t.getDate() - 6); const from = dkey(t); let v = 0; S.logs.forEach(l => { if (l.date >= from) (l.entries || []).forEach(e => v += exVol(e.sets)); }); return v; }
function lastPR() {
  const mx = {}; let last = null;
  [...S.logs].sort((a, b) => a.date.localeCompare(b.date)).forEach(l => (l.entries || []).forEach(e => {
    const m = Math.max(0, ...(e.sets || []).map(s => num(s.kg)));
    if (m <= 0) return;
    if (mx[e.name] === undefined) mx[e.name] = m; else if (m > mx[e.name]) { mx[e.name] = m; last = { name: e.name, kg: m, date: l.date }; }
  }));
  return last;
}
function prMax(name) { let m = 0; S.logs.forEach(l => (l.entries || []).forEach(e => { if (e.name === name) (e.sets || []).forEach(s => m = Math.max(m, num(s.kg))); })); return m; }
function fillPrev(i, j) { const p = (lastSets(ss.entries[i].name) || [])[j]; if (!p) return; const s = ss.entries[i].sets[j]; s.kg = String(p.kg); s.reps = String(p.reps); saveS(); renderTrain(); }
function homeHero() {
  const key = getTodayKey(), day = S.plan[key], has = day && day.exercises && day.exercises.length, name = (S.settings.name || '').trim();
  const done = S.logs.some(l => l.date === dkey(new Date()));
  const sub = ss ? 'Sesión en curso · ' + esc(ss.title) : has ? esc(day.title || DAYS.find(d => d.k === key).n) : 'Sin rutina programada hoy';
  const cta = ss ? `<button class="btn" onclick="show('train')">Continuar entrenamiento</button>`
    : `<button class="btn" onclick="openStartModal()">${done ? 'Entrenar de nuevo' : has ? 'Iniciar entrenamiento de hoy' : 'Iniciar sesión libre'}</button>`;
  return `<div class="card b-hero"><h2>${greet()}${name ? ', ' + esc(name) : ''}</h2><p class="mu">${sub}${done && !ss ? ' · ya entrenaste hoy ✓' : ''}</p>${has && !ss ? muscleChips(day) : ''}${cta}</div>`;
}
function homeStats(streak) {
  const pr = lastPR();
  return `<div class="card b-stat"><span class="mu">Racha</span><b data-count="${streak}">${streak}</b><small>día${streak !== 1 ? 's' : ''}</small></div>
    <div class="card b-stat"><span class="mu">Esta semana</span><b>${fmtVol(weekKg())}</b><small>movidos</small></div>
    <div class="card b-stat pr"><span class="mu">Último PR</span><b>${pr ? fmtWeight(pr.kg) : '—'}</b><small>${pr ? esc(pr.name) : 'Sin PR aún'}</small></div>`;
}
function homeRecent() {
  const rows = [...S.logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return `<div class="card b-wide"><h3>Entrenamientos recientes</h3>${rows.length ? rows.map(l => {
    const v = (l.entries || []).reduce((a, e) => a + exVol(e.sets), 0), d = new Date(l.date + 'T12:00:00');
    return `<button class="rec-btn" onclick="showDayLog('${l.date}')"><span><strong>${esc(l.title || 'Entrenamiento')}</strong><small class="mu">${d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })} · ${Math.round((l.dur || 0) / 60)} min</small></span><b>${fmtVol(v)}</b></button>`;
  }).join('') : '<div class="empty" style="margin:0"><strong>Aún no hay entrenamientos</strong><span>Tu historial aparecerá aquí al finalizar una sesión.</span></div>'}</div>`;
}

/* ===== Navegación ===== */
function show(name) {
  if (!VIEWS.includes(name)) name = 'home';
  document.body.classList.toggle('in-train', name === 'train');
  $$('.view').forEach(v => (v.hidden = v.dataset.view !== name));
  $$('.nav-btn').forEach(b => {
    const on = b.dataset.go === name;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  document.getElementById('views').scrollTop = 0;
  if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  if (name === 'programs') {
    const activeSeg = $$('.seg button.active')[0]?.dataset.seg || 'routines';
    if (activeSeg === 'routines') renderWeek(); else renderGallery();
  }
  if (name === 'home') renderHome();
  if (name === 'train') renderTrain();
  if (name === 'stats') renderStats();
  if (name === 'profile') renderProfile();
}

function showSeg(name) {
  $$('.seg button').forEach(b => {
    const on = b.dataset.seg === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  });
  $$('.panel').forEach(p => (p.hidden = p.dataset.panel !== name));
  if (name === 'gallery') renderGallery();
  if (name === 'routines') renderWeek();
}

$$('.nav-btn').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.go === 'train' && !ss) openStartModal();
  else show(b.dataset.go);
}));
$$('.seg button').forEach(b => b.addEventListener('click', () => showSeg(b.dataset.seg)));
addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if (h === 'train' && !ss) openStartModal();
  else show(h);
});
show(location.hash.slice(1) || 'home');

if ('serviceWorker' in navigator)
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));


/* ===== Toast UX ===== */
let toastTimer = null;
function toast(msg, ms = 2200) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ===== Home dashboard ===== */
function renderHome() {
  const root = $('#home-root');
  if (!root) return;
  const todayKey = getTodayKey();
  const day = S.plan[todayKey];
  const dayName = DAYS.find(d => d.k === todayKey)?.n || 'Hoy';
  const hasPlan = day && day.exercises && day.exercises.length > 0;
  const todayStr = dkey(new Date());
  const trainedToday = S.logs.some(l => l.date === todayStr);
  const { secs } = computeStats();
  const hours = (secs / 3600).toFixed(1);

  // Volume per day for heatmap intensity
  const volByDate = {};
  const logsByDate = {};
  S.logs.forEach(l => {
    let v = 0;
    (l.entries || []).forEach(e => (e.sets || []).forEach(s => { v += num(s.kg) * (parseInt(s.reps) || 0); }));
    volByDate[l.date] = (volByDate[l.date] || 0) + v;
    if (!logsByDate[l.date]) logsByDate[l.date] = [];
    logsByDate[l.date].push(l);
  });
  const maxVol = Math.max(1, ...Object.values(volByDate), 1);

  // Streak
  let streak = 0;
  const dates = new Set(Object.keys(volByDate));
  const cursor = new Date();
  if (!dates.has(dkey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dates.has(dkey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }

  // GitHub-style heatmap: last 53 weeks ending today
  const heatCells = [];
  const endD = new Date();
  endD.setHours(12,0,0,0);
  // align to end of week (Saturday in grid? GitHub uses Sun start row)
  // Grid: rows = Sun..Sat, columns = weeks
  const startD = new Date(endD);
  startD.setDate(startD.getDate() - 52 * 7 - endD.getDay());
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const key = dkey(d);
    const v = volByDate[key] || 0;
    let lvl = 0;
    if (v > 0) {
      const r = v / maxVol;
      lvl = r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
    }
    heatCells.push({ key, lvl, title: key + (v ? ` · ${Math.round(v)} kg vol` : '') });
  }

  // Monthly calendar
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const first = new Date(calYear, calMonth, 1);
  const startPad = first.getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  let calCells = '';
  for (let i = 0; i < startPad; i++) calCells += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(calYear, calMonth, d);
    const key = dkey(dt);
    const trained = !!volByDate[key];
    const isToday = key === todayStr;
    const cls = `cal-day in${trained ? ' trained' : ''}${isToday ? ' today' : ''}`;
    const click = trained ? `onclick="showDayLog('${key}')"` : '';
    calCells += `<button class="${cls}" ${click} aria-label="${key}">${d}</button>`;
  }

  root.innerHTML = `
    ${homeHero()}
    ${homeStats(streak)}
    ${homeRecent()}

    <div class="home-card" id="hmap">${homeMapInner()}</div>

    <div class="home-card">
      <h3>Actividad del año</h3>
      <div class="heat-wrap"><div class="heat-grid">
        ${heatCells.map(c => `<div class="heat-cell${c.lvl ? ' l' + c.lvl : ''}" title="${esc(c.title)}"></div>`).join('')}
      </div></div>
      <div class="heat-legend">
        <span>Menos</span>
        <i style="background:var(--line)"></i>
        <i class="l1" style="background:color-mix(in srgb,var(--ac) 25%,var(--line))"></i>
        <i style="background:color-mix(in srgb,var(--ac) 45%,var(--line))"></i>
        <i style="background:color-mix(in srgb,var(--ac) 70%,transparent)"></i>
        <i style="background:var(--ac)"></i>
        <span>Más</span>
      </div>
    </div>

    <div class="home-card">
      <div class="cal-hd">
        <strong>${monthNames[calMonth]} ${calYear}</strong>
        <div class="cal-nav">
          <button type="button" onclick="shiftCal(-1)" aria-label="Mes anterior">‹</button>
          <button type="button" onclick="shiftCal(1)" aria-label="Mes siguiente">›</button>
        </div>
      </div>
      <div class="cal-grid">
        ${['D','L','M','X','J','V','S'].map(x => `<div class="cal-dow">${x}</div>`).join('')}
        ${calCells}
      </div>
      <p class="hint" style="margin:10px 0 0">Toca un día marcado para ver el entrenamiento.</p>
    </div>
  `;
  afterRender(root);
}

function shiftCal(dir) {
  calMonth += dir;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderHome();
}

function showDayLog(dateStr) {
  const logs = S.logs.filter(l => l.date === dateStr);
  if (!logs.length) { toast('Sin entrenamientos ese día'); return; }
  let html = '';
  logs.forEach(l => {
    const mins = Math.round((l.dur || 0) / 60);
    html += `<div style="margin-bottom:12px"><strong>${esc(l.title || 'Entrenamiento')}</strong>
      <span class="mu" style="font-size:.8rem"> · ${mins} min</span>
      <ul style="margin:6px 0 0;padding:0 0 0 18px;color:var(--mu);font-size:.85rem">`;
    (l.entries || []).forEach(e => {
      const sets = (e.sets || []).map(s => `${fmtWeight(s.kg)}×${s.reps}`).join(', ');
      html += `<li>${esc(e.name)}: ${sets || '—'}</li>`;
    });
    html += `</ul>${muscleChips({ exercises: l.entries })}</div>`;
  });
  $('#log-modal-title').textContent = dateStr;
  $('#log-modal-body').innerHTML = html;
  $('#log-modal').hidden = false;
}
function closeLogModal() { $('#log-modal').hidden = true; }

/* ===== Calendario ===== */
function renderWeek() {
  const root = $('#programs-week');
  if (!root) return;
  const todayKey = getTodayKey();
  let html = '';
  DAYS.forEach(d => {
    const day = ensureDay(d.k);
    const isToday = d.k === todayKey;
    const nEx = day.exercises.length;
    const mus = dayMuscles(day).slice(0, 3).map(k => MG[k].label).join(', ');
    const summary = nEx ? `${nEx} ejercicio${nEx > 1 ? 's' : ''}${day.title ? ' · ' + day.title : ''}${mus ? ' · ' + mus : ''}` : 'Sin rutina';
    html += `<div class="day-card${isToday ? ' today' : ''}${day._open ? ' open' : ''}" data-day="${d.k}">
      <div class="day-hd" role="button" tabindex="0" aria-expanded="${!!day._open}" onclick="toggleDay('${d.k}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleDay('${d.k}')}">
        <span class="badge">${d.short}</span>
        <div class="info"><strong>${d.n}${isToday ? ' · Hoy' : ''}</strong><span>${esc(summary)}</span></div>
        <span class="chev">▾</span>
      </div>
      <div class="day-body">
        <div class="day-title">
          <input class="inp l" placeholder="Nombre de la rutina (ej. Push, Piernas…)" maxlength="40"
            value="${esc(day.title)}" oninput="setDayTitle('${d.k}', this.value)">
        </div>
        ${day.exercises.length ? day.exercises.map((e, i) => planExCard(d.k, e, i)).join('') : '<div class="day-empty">Aún no hay ejercicios para este día</div>'}
        <div class="addx" style="margin-top:8px">
          <input class="inp l" id="nx-${d.k}" list="exlist-plan" placeholder="Nombre del ejercicio" maxlength="40"
            onkeydown="if(event.key==='Enter')addPlanEx('${d.k}')">
        </div>
        <button class="btn g" onclick="addPlanEx('${d.k}')">+ Agregar ejercicio</button>
      </div>
    </div>`;
  });
  const names = [...new Set([...allExercises().map(e => e.name), ...S.logs.flatMap(l => l.entries.map(e => e.name))])];
  html += `<datalist id="exlist-plan">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;
  root.innerHTML = html;
}
function toggleDay(key) {
  const day = ensureDay(key);
  day._open = !day._open;
  DAYS.forEach(d => { if (d.k !== key) ensureDay(d.k)._open = false; });
  renderWeek();
  const card = document.querySelector(`.day-card[data-day="${key}"]`);
  if (card && day._open) setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}
function setDayTitle(key, val) { ensureDay(key).title = val; saveLogs(); }
function planExCard(key, e, i) {
  let h = `<div class="pex"><div class="pex-h"><h3>${esc(e.name)}</h3>
    <span class="mu">⏱</span>
    <input class="inp" inputmode="numeric" value="${e.rest || 90}" style="width:52px;padding:6px 2px"
      oninput="setPlanRest('${key}',${i},this.value)"><span class="mu">s</span>
    <button class="x" onclick="rmPlanEx('${key}',${i})" aria-label="Quitar ejercicio">✕</button></div>
    <div class="ptr"><span class="th">N°</span><span class="th">${unitLabel()}</span><span class="th">Reps</span><span class="th"></span></div>`;
  (e.sets || []).forEach((s, j) => {
    const disp = s.kg !== '' && s.kg != null ? toDisplay(num(s.kg)) : '';
    h += `<div class="ptr"><span class="nn">${j + 1}</span>
      <input class="inp" inputmode="decimal" placeholder="${unitLabel()}" value="${disp}"
        oninput="setPlanSet('${key}',${i},${j},'kg',fromDisplay(this.value))">
      <input class="inp" inputmode="numeric" placeholder="reps" value="${esc(s.reps || '')}" oninput="setPlanSet('${key}',${i},${j},'reps',this.value)">
      <button class="x" onclick="rmPlanSet('${key}',${i},${j})" aria-label="Quitar serie">−</button></div>`;
  });
  return h + `<div class="rowb" style="margin-top:8px"><button class="btn g" onclick="addPlanSet('${key}',${i})">+ Serie</button></div></div>`;
}
function addPlanEx(key) {
  const inp = $(`#nx-${key}`);
  const n = (inp ? inp.value : '').trim();
  if (!n) return;
  const day = ensureDay(key);
  const last = lastSets(n);
  const sets = last && last.length ? last.map(s => ({ kg: s.kg || '', reps: s.reps || '' })) : [{ kg: '', reps: '' }, { kg: '', reps: '' }, { kg: '', reps: '' }];
  day.exercises.push({ name: n, rest: 90, sets });
  day._open = true;
  saveLogs();
  renderWeek();
}
function rmPlanEx(key, i) { if (!confirm('¿Quitar este ejercicio del día?')) return; ensureDay(key).exercises.splice(i, 1); saveLogs(); renderWeek(); }
function setPlanRest(key, i, v) { ensureDay(key).exercises[i].rest = parseInt(v) || 90; saveLogs(); }
function setPlanSet(key, i, j, field, val) { ensureDay(key).exercises[i].sets[j][field] = val; saveLogs(); }
function addPlanSet(key, i) {
  const sets = ensureDay(key).exercises[i].sets;
  const last = sets[sets.length - 1];
  sets.push({ kg: last ? last.kg : '', reps: last ? last.reps : '' });
  saveLogs(); renderWeek();
}
function rmPlanSet(key, i, j) {
  const sets = ensureDay(key).exercises[i].sets;
  if (sets.length <= 1) return;
  sets.splice(j, 1); saveLogs(); renderWeek();
}

/* ===== Modal inicio ===== */
function openStartModal() {
  const key = getTodayKey();
  const day = S.plan[key];
  const hasPlan = day && day.exercises && day.exercises.length > 0;
  const dayName = DAYS.find(d => d.k === key)?.n || 'Hoy';
  $('#modal-title').textContent = '¿Estás listo para entrenar?';
  const desc = $('#modal-desc'), prev = $('#modal-preview');
  if (hasPlan) {
    desc.textContent = `Se cargará la rutina de ${dayName}.`;
    prev.hidden = false;
    const title = day.title || dayName;
    prev.innerHTML = `<strong>${esc(title)}</strong><ul>${day.exercises.map(e => {
      const n = (e.sets || []).length;
      return `<li>${esc(e.name)} · ${n} serie${n !== 1 ? 's' : ''}</li>`;
    }).join('')}</ul>`;
  } else {
    desc.textContent = `No hay rutina programada para ${dayName}. Empezarás una sesión libre.`;
    prev.hidden = true; prev.innerHTML = '';
  }
  $('#start-modal').hidden = false;
}
function closeStartModal() { $('#start-modal').hidden = true; }
function confirmStart() { closeStartModal(); startSess(true); show('train'); }

/* ===== Galería ===== */
function renderGallery() {
  const root = $('#gallery-root');
  if (!root) return;
  const list = allExercises().filter(e => {
    if (galCat !== 'all' && e.cat !== galCat) return false;
    if (galEquip !== 'all' && e.equip !== galEquip) return false;
    if (galQ && !e.name.toLowerCase().includes(galQ)) return false;
    if (selectedMuscle) {
      const pri = e.primary || [], sec = e.secondary || [];
      if (!pri.includes(selectedMuscle) && !sec.includes(selectedMuscle) && e.cat !== selectedMuscle) return false;
    }
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  root.innerHTML = `
    <div class="map-wrap">
      <div class="map-hd">
        <strong>Mapa muscular</strong><span class="mu" style="font-size:.75rem;display:block;font-weight:400">Toca un músculo para filtrar</span>
        <div class="map-tog">
          <button class="${mapSide === 'front' ? 'on' : ''}" onclick="setMapSide('front')">Frente</button>
          <button class="${mapSide === 'back' ? 'on' : ''}" onclick="setMapSide('back')">Espalda</button>
        </div>
      </div>
      <div class="map-svg-box" id="gal-map">${muscleSVG(mapSide, getSessionHeat())}</div>
      <div class="map-legend">${MGROUPS.map(m => `<span><i style="background:${m.color}"></i>${m.label}</span>`).join('')}</div>
    </div>
    <div class="search-bar">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>
      <input class="inp l" id="gal-search" placeholder="Buscar ejercicio…" value="${esc(galQ)}"
        oninput="galQ=this.value.toLowerCase();renderGallery()">
    </div>
    <div class="cat-row">
      <button class="cat-btn ${galCat === 'all' ? 'on' : ''}" onclick="galCat='all';renderGallery()">Todos</button>
      ${MGROUPS.map(m => `<button class="cat-btn ${galCat === m.k ? 'on' : ''}" onclick="galCat='${m.k}';renderGallery()">${m.emoji} ${m.label}</button>`).join('')}
    </div>
    <div class="cat-row">
      <button class="cat-btn ${galEquip === 'all' ? 'on' : ''}" onclick="galEquip='all';renderGallery()">Cualquier equipo</button>
      ${EQUIP.map(eq => `<button class="cat-btn ${galEquip === eq.k ? 'on' : ''}" onclick="galEquip='${eq.k}';renderGallery()">${eq.label}</button>`).join('')}
    </div>
    ${selectedMuscle ? `<button class="btn g" style="margin-bottom:8px" onclick="selectedMuscle=null;renderGallery()">✕ Quitar filtro: ${MG[selectedMuscle]?.label || selectedMuscle}</button>` : ''}
    <button class="btn g" style="margin-bottom:12px" onclick="openCustomModal()">+ Agregar ejercicio personalizado</button>
    ${list.length ? list.map(e => exItemHTML(e)).join('') : '<div class="empty"><strong>Sin resultados</strong><span>Prueba otro nombre o quita los filtros.</span></div>'}
  `;
}
function exItemHTML(e) {
  const mg = MG[e.cat] || MGROUPS[0];
  const tags = [
    ...(e.primary || []).map(k => `<span class="mtag p">${MG[k]?.label || k}</span>`),
    ...(e.secondary || []).map(k => `<span class="mtag s">${MG[k]?.label || k}</span>`)
  ].join('');
  return `<div class="ex-item" role="button" tabindex="0" onclick="highlightMuscles('${esc(e.name)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();highlightMuscles('${esc(e.name)}')}">
    <div class="ico" style="background:color-mix(in srgb,${mg.color} 20%,transparent)">${mg.emoji}</div>
    <div class="meta"><strong>${esc(e.name)}</strong><div class="muscle-tags">${tags}</div></div>
    <button class="add-btn" onclick="event.stopPropagation();quickAddToToday('${esc(e.name)}')" title="Agregar a hoy" aria-label="Agregar ${esc(e.name)} a hoy">+</button>
  </div>`;
}
function setMapSide(side) {
  mapSide = side;
  const box = $('#gal-map');
  if (box) box.innerHTML = muscleSVG(mapSide, getSessionHeat());
  $$('.map-tog button').forEach(b => {
    const isFront = b.textContent.toLowerCase().includes('frente');
    b.classList.toggle('on', (side === 'front' && isFront) || (side === 'back' && !isFront));
  });
  const mini = $('#train-map');
  if (mini) mini.innerHTML = muscleSVG(mapSide, getSessionHeat());
}

function selectMuscle(k) {
  selectedMuscle = selectedMuscle === k ? null : k;
  if (selectedMuscle) {
    galCat = 'all';
    toast('Ejercicios: ' + (MG[k]?.label || k));
  } else {
    toast('Filtro muscular quitado');
  }
  show('programs');
  showSeg('gallery');
  renderGallery();
}

function highlightMuscles(name) {
  const { primary, secondary } = getMuscles(name);
  const heat = {};
  primary.forEach(k => heat[k] = 4);
  secondary.forEach(k => heat[k] = Math.max(heat[k] || 0, 2));
  const box = $('#gal-map');
  if (box) box.innerHTML = muscleSVG(mapSide, heat);
}
function quickAddToToday(name) {
  const key = getTodayKey();
  const day = ensureDay(key);
  const last = lastSets(name);
  const sets = last && last.length ? last.map(s => ({ kg: s.kg || '', reps: s.reps || '' })) : [{ kg: '', reps: '' }, { kg: '', reps: '' }, { kg: '', reps: '' }];
  day.exercises.push({ name, rest: 90, sets });
  day._open = true;
  saveLogs();
  const btn = event?.target;
  if (btn) { btn.textContent = '✓'; setTimeout(() => { btn.textContent = '+'; }, 800); }
}

let customSel = { cat: 'pecho', pri: [], sec: [] };
function openCustomModal() {
  customSel = { cat: 'pecho', pri: [], sec: [] };
  $('#custom-name').value = '';
  renderCustomChips();
  $('#custom-modal').hidden = false;
}
function closeCustomModal() { $('#custom-modal').hidden = true; }
function renderCustomChips() {
  $('#custom-cat').innerHTML = MGROUPS.map(m =>
    `<button class="chip ${customSel.cat === m.k ? 'on' : ''}" onclick="customSel.cat='${m.k}';renderCustomChips()">${m.label}</button>`).join('');
  $('#custom-pri').innerHTML = MGROUPS.map(m =>
    `<button class="chip ${customSel.pri.includes(m.k) ? 'on' : ''}" onclick="togCustom('pri','${m.k}')">${m.label}</button>`).join('');
  $('#custom-sec').innerHTML = MGROUPS.map(m =>
    `<button class="chip ${customSel.sec.includes(m.k) ? 'on' : ''}" onclick="togCustom('sec','${m.k}')">${m.label}</button>`).join('');
}
function togCustom(field, k) {
  const arr = customSel[field];
  const i = arr.indexOf(k);
  if (i >= 0) arr.splice(i, 1); else arr.push(k);
  renderCustomChips();
}
function saveCustomEx() {
  const name = $('#custom-name').value.trim();
  if (!name) { alert('Escribe un nombre'); return; }
  if (findEx(name)) { alert('Ya existe un ejercicio con ese nombre'); return; }
  if (!customSel.pri.length) { alert('Selecciona al menos un músculo principal'); return; }
  S.customEx.push({ name, cat: customSel.cat, primary: [...customSel.pri], secondary: [...customSel.sec].filter(k => !customSel.pri.includes(k)) });
  saveLogs();
  closeCustomModal();
  renderGallery();
}

/* ===== SVG Mapa ===== */
function muscleSVG(side, heat = {}) {
  const cls = k => {
    const h = heat[k] || 0;
    let c = '';
    if (h >= 5) c = 'hot5'; else if (h >= 4) c = 'hot4'; else if (h >= 3) c = 'hot3';
    else if (h >= 2) c = 'hot2'; else if (h >= 1) c = 'hot1';
    if (selectedMuscle === k) c += ' sel';
    return c;
  };
  // Estilo MuscleWiki: silueta clara con contornos y relleno al trabajar
  if (side === 'front') {
    return `<svg viewBox="0 0 240 480" xmlns="http://www.w3.org/2000/svg">
      <!-- Cabeza -->
      <ellipse cx="120" cy="36" rx="28" ry="32" class="body-outline"/>
      <!-- Cuello -->
      <path d="M105 62 L105 78 L135 78 L135 62" class="body-outline"/>
      <!-- Torso base -->
      <path d="M88 78 L70 95 L58 140 L55 200 L62 250 L78 310 L95 330 L120 315 L145 330 L162 310 L178 250 L185 200 L182 140 L170 95 L152 78 Z" class="body-outline"/>
      <!-- Pecho izq / der -->
      <path d="M90 88 L118 82 L118 130 Q105 142 90 132 Z" class="m-region ${cls('pecho')}" data-m="pecho" onclick="selectMuscle('pecho')"/>
      <path d="M122 82 L150 88 L150 132 Q135 142 122 130 Z" class="m-region ${cls('pecho')}" data-m="pecho" onclick="selectMuscle('pecho')"/>
      <!-- Línea media pecho -->
      <path d="M120 82 L120 145" class="body-line"/>
      <!-- Hombros -->
      <path d="M70 90 Q52 85 48 105 Q50 120 68 118 Q78 110 78 95 Z" class="m-region ${cls('hombros')}" data-m="hombros" onclick="selectMuscle('hombros')"/>
      <path d="M170 90 Q188 85 192 105 Q190 120 172 118 Q162 110 162 95 Z" class="m-region ${cls('hombros')}" data-m="hombros" onclick="selectMuscle('hombros')"/>
      <!-- Abdomen (6 pack stylized) -->
      <path d="M95 148 L145 148 L142 200 L120 210 L98 200 Z" class="m-region ${cls('abdomen')}" data-m="abdomen" onclick="selectMuscle('abdomen')"/>
      <path d="M100 152 L140 152 M100 168 L140 168 M100 184 L140 184 M120 148 L120 200" class="body-line"/>
      <!-- Brazos (bíceps) -->
      <path d="M48 118 L38 160 L42 200 L58 202 L62 160 L68 120 Z" class="m-region ${cls('brazos')}" data-m="brazos" onclick="selectMuscle('brazos')"/>
      <path d="M192 118 L202 160 L198 200 L182 202 L178 160 L172 120 Z" class="m-region ${cls('brazos')}" data-m="brazos" onclick="selectMuscle('brazos')"/>
      <!-- Antebrazos -->
      <path d="M42 202 L36 250 L52 255 L58 205 Z" class="body-outline"/>
      <path d="M198 202 L204 250 L188 255 L182 205 Z" class="body-outline"/>
      <!-- Manos -->
      <ellipse cx="40" cy="262" rx="12" ry="10" class="body-outline"/>
      <ellipse cx="200" cy="262" rx="12" ry="10" class="body-outline"/>
      <!-- Piernas (cuádriceps) -->
      <path d="M82 330 L72 400 L70 450 L95 455 L102 400 L108 335 Z" class="m-region ${cls('piernas')}" data-m="piernas" onclick="selectMuscle('piernas')"/>
      <path d="M158 330 L168 400 L170 450 L145 455 L138 400 L132 335 Z" class="m-region ${cls('piernas')}" data-m="piernas" onclick="selectMuscle('piernas')"/>
      <!-- Líneas cuádriceps -->
      <path d="M88 350 L88 420 M95 345 L92 430 M152 350 L152 420 M145 345 L148 430" class="body-line"/>
      <!-- Pies -->
      <ellipse cx="80" cy="462" rx="18" ry="10" class="body-outline"/>
      <ellipse cx="160" cy="462" rx="18" ry="10" class="body-outline"/>
    </svg>`;
  }
  // BACK
  return `<svg viewBox="0 0 240 480" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="120" cy="36" rx="28" ry="32" class="body-outline"/>
    <path d="M105 62 L105 78 L135 78 L135 62" class="body-outline"/>
    <path d="M88 78 L70 95 L58 140 L55 200 L62 250 L78 310 L95 330 L120 315 L145 330 L162 310 L178 250 L185 200 L182 140 L170 95 L152 78 Z" class="body-outline"/>
    <!-- Trapecio / espalda alta -->
    <path d="M90 82 L120 75 L150 82 L148 115 Q120 128 92 115 Z" class="m-region ${cls('espalda')}" data-m="espalda" onclick="selectMuscle('espalda')"/>
    <!-- Dorsales -->
    <path d="M88 118 L60 160 L62 220 L90 230 Q95 170 100 130 Z" class="m-region ${cls('espalda')}" data-m="espalda" onclick="selectMuscle('espalda')"/>
    <path d="M152 118 L180 160 L178 220 L150 230 Q145 170 140 130 Z" class="m-region ${cls('espalda')}" data-m="espalda" onclick="selectMuscle('espalda')"/>
    <!-- Lumbar -->
    <path d="M95 220 L145 220 L142 280 L120 290 L98 280 Z" class="m-region ${cls('espalda')}" data-m="espalda" onclick="selectMuscle('espalda')"/>
    <path d="M120 75 L120 280" class="body-line"/>
    <!-- Hombros rear -->
    <path d="M70 90 Q52 85 48 105 Q50 120 68 118 Q78 110 78 95 Z" class="m-region ${cls('hombros')}" data-m="hombros" onclick="selectMuscle('hombros')"/>
    <path d="M170 90 Q188 85 192 105 Q190 120 172 118 Q162 110 162 95 Z" class="m-region ${cls('hombros')}" data-m="hombros" onclick="selectMuscle('hombros')"/>
    <!-- Tríceps -->
    <path d="M48 118 L38 160 L42 200 L58 202 L62 160 L68 120 Z" class="m-region ${cls('brazos')}" data-m="brazos" onclick="selectMuscle('brazos')"/>
    <path d="M192 118 L202 160 L198 200 L182 202 L178 160 L172 120 Z" class="m-region ${cls('brazos')}" data-m="brazos" onclick="selectMuscle('brazos')"/>
    <path d="M42 202 L36 250 L52 255 L58 205 Z" class="body-outline"/>
    <path d="M198 202 L204 250 L188 255 L182 205 Z" class="body-outline"/>
    <ellipse cx="40" cy="262" rx="12" ry="10" class="body-outline"/>
    <ellipse cx="200" cy="262" rx="12" ry="10" class="body-outline"/>
    <!-- Glúteos + isquios -->
    <path d="M85 320 Q120 305 155 320 L160 360 Q120 380 80 360 Z" class="m-region ${cls('piernas')}" data-m="piernas" onclick="selectMuscle('piernas')"/>
    <path d="M82 360 L72 420 L70 450 L95 455 L105 400 L108 365 Z" class="m-region ${cls('piernas')}" data-m="piernas" onclick="selectMuscle('piernas')"/>
    <path d="M158 360 L168 420 L170 450 L145 455 L135 400 L132 365 Z" class="m-region ${cls('piernas')}" data-m="piernas" onclick="selectMuscle('piernas')"/>
    <ellipse cx="80" cy="462" rx="18" ry="10" class="body-outline"/>
    <ellipse cx="160" cy="462" rx="18" ry="10" class="body-outline"/>
  </svg>`;
}

function getSessionHeat() {
  const heat = {};
  if (!ss) return heat;
  ss.entries.forEach(e => {
    const done = e.sets.filter(s => s.done && s.t !== 'W').length;
    if (!done) return;
    const { primary, secondary } = getMuscles(e.name);
    primary.forEach(k => { heat[k] = Math.min(5, (heat[k] || 0) + done); });
    secondary.forEach(k => { heat[k] = Math.min(5, (heat[k] || 0) + Math.ceil(done / 2)); });
  });
  return heat;
}
function updateTrainMap() {
  const box = $('#train-map');
  if (box) box.innerHTML = muscleSVG(mapSide, getSessionHeat());
}

/* ===== Paso 5: Estadísticas ===== */
function computeStats() {
  let vol = 0, reps = 0, sets = 0, secs = 0;
  const byDate = {};
  const maxByEx = {};
  S.logs.forEach(l => {
    secs += l.dur || 0;
    byDate[l.date] = (byDate[l.date] || 0) + 1;
    (l.entries || []).forEach(e => {
      (e.sets || []).forEach(s => {
        const r = parseInt(s.reps) || 0;
        const k = num(s.kg);
        vol += k * r;
        reps += r;
        sets += 1;
        if (k > 0) maxByEx[e.name] = Math.max(maxByEx[e.name] || 0, k);
      });
    });
  });
  return { vol, reps, sets, secs, byDate, maxByEx };
}

function chartSVG(days) {
  const { byDate } = computeStats();
  const today = new Date();
  const points = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dkey(d);
    points.push({ date: key, n: byDate[key] || 0, label: d.getDate() });
  }
  const maxN = Math.max(1, ...points.map(p => p.n));
  const W = 320, H = 120, padL = 8, padR = 8, padT = 12, padB = 24;
  const innerW = W - padL - padR, innerH = H - padT - padB;

  if (points.every(p => p.n === 0)) {
    return `<div class="chart-empty">Aún no hay entrenamientos registrados</div>`;
  }

  const coords = points.map((p, i) => {
    const x = padL + (i / (points.length - 1 || 1)) * innerW;
    const y = padT + innerH - (p.n / maxN) * innerH;
    return { x, y, ...p };
  });

  const line = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area = line + ` L${coords[coords.length - 1].x.toFixed(1)},${padT + innerH} L${coords[0].x.toFixed(1)},${padT + innerH} Z`;

  // labels: first, middle, last
  const labels = [0, Math.floor(coords.length / 2), coords.length - 1].map(i => {
    const c = coords[i];
    return `<text x="${c.x}" y="${H - 6}" text-anchor="middle" fill="var(--mu)" font-size="10">${c.label}</text>`;
  }).join('');

  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs>
      <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--ac)" stop-opacity=".35"/>
        <stop offset="100%" stop-color="var(--ac)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#cg)"/>
    <path d="${line}" fill="none" stroke="var(--ac)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${coords.filter(c => c.n > 0).map(c =>
      `<circle cx="${c.x}" cy="${c.y}" r="3.5" fill="var(--ac)" stroke="var(--bg)" stroke-width="1.5"/>`
    ).join('')}
    ${labels}
  </svg>`;
}

function goalRing(name, target, current) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const r = 28, c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return `<div class="goal-ring">
    <svg viewBox="0 0 72 72">
      <circle cx="36" cy="36" r="${r}" fill="none" stroke="var(--line)" stroke-width="6"/>
      <circle cx="36" cy="36" r="${r}" fill="none" stroke="var(--ac)" stroke-width="6"
        stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round"
        transform="rotate(-90 36 36)" style="transition:stroke-dashoffset .4s"/>
      <text x="36" y="40" text-anchor="middle" fill="var(--tx)" font-size="14" font-weight="700">${pct}%</text>
    </svg>
    <span class="lbl">${esc(name)}<br><span style="color:var(--ac)">${fmtWeight(current)}</span> / ${fmtWeight(target)}</span>
  </div>`;
}

function renderStats() {
  const root = $('#stats-root');
  if (!root) return;
  const { vol, reps, sets, secs, maxByEx } = computeStats();
  const hours = (secs / 3600).toFixed(1);
  const volStr = vol >= 1000 ? (vol / 1000).toFixed(1) + ' ton' : Math.round(vol) + ' kg';
  // convert volume display if lbs
  let volDisplay = volStr;
  if (S.settings.units === 'lbs' && vol < 1000) {
    volDisplay = Math.round(vol * 2.20462) + ' lbs';
  } else if (S.settings.units === 'lbs' && vol >= 1000) {
    volDisplay = ((vol * 2.20462) / 2000).toFixed(1) + ' ton';
  }

  root.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi"><div class="ico">🏋️</div><b>${volDisplay}</b><span>Volumen total</span></div>
      <div class="kpi"><div class="ico">🔄</div><b data-count="${reps}">${reps.toLocaleString('es')}</b><span>Repeticiones</span></div>
      <div class="kpi"><div class="ico">✅</div><b data-count="${sets}">${sets.toLocaleString('es')}</b><span>Series completadas</span></div>
      <div class="kpi"><div class="ico">⏱</div><b>${hours} h</b><span>Horas entrenadas</span></div>
    </div>

    ${radarCard()}
    ${rankCard()}

    <div class="chart-card">
      <div class="chart-hd">
        <strong>Entrenamientos</strong>
        <div class="chart-range">
          <button class="${chartDays === 30 ? 'on' : ''}" onclick="chartDays=30;renderStats()">30 días</button>
          <button class="${chartDays === 90 ? 'on' : ''}" onclick="chartDays=90;renderStats()">90 días</button>
        </div>
      </div>
      ${chartSVG(chartDays)}
    </div>

    <div class="goals-card">
      <h3>Mis Objetivos</h3>
      <div class="goals-row">
        ${S.goals.length
          ? S.goals.map(g => goalRing(g.name, g.target, maxByEx[g.name] || 0)).join('')
          : '<p class="mu" style="font-size:.85rem;text-align:center;width:100%">Sin objetivos aún</p>'}
      </div>
      <button class="btn g goal-add" onclick="openGoalModal()">+ Agregar objetivo</button>
    </div>

    <div class="records-card">
      <h3>Récords personales</h3>
      ${Object.keys(maxByEx).length
        ? Object.entries(maxByEx).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, kg]) =>
            `<div class="rec-row"><span class="name">${esc(name)}</span><span class="val">${fmtWeight(kg)}</span></div>`
          ).join('')
        : '<p class="mu" style="font-size:.85rem;text-align:center">Completa entrenamientos para ver récords</p>'}
    </div>
  `;
  afterRender(root);
}

/* Objetivos */
function openGoalModal() {
  const names = [...new Set([...allExercises().map(e => e.name), ...S.logs.flatMap(l => l.entries.map(e => e.name))])];
  $('#exlist-goal').innerHTML = names.map(n => `<option value="${esc(n)}">`).join('');
  $('#goal-name').value = '';
  $('#goal-target').value = '';
  $('#goal-unit-lbl').textContent = unitLabel();
  $('#goal-modal').hidden = false;
}
function closeGoalModal() { $('#goal-modal').hidden = true; }
function saveGoal() {
  const name = $('#goal-name').value.trim();
  const targetDisp = num($('#goal-target').value);
  if (!name || !targetDisp) { alert('Completa ejercicio y peso objetivo'); return; }
  const target = fromDisplay(targetDisp); // store in kg
  const existing = S.goals.find(g => g.name.toLowerCase() === name.toLowerCase());
  if (existing) existing.target = target;
  else S.goals.push({ name, target });
  saveLogs();
  closeGoalModal();
  renderStats();
}

/* ===== Paso 5: Perfil / Ajustes ===== */
function renderProfile() {
  const root = $('#profile-root');
  if (!root) return;
  const theme = S.settings.theme || 'oled';
  const units = S.settings.units || 'kg';
  const nLogs = S.logs.length;
  const nCustom = S.customEx.length;

  root.innerHTML = `
    <div class="set-card">
      <h3>Resumen</h3>
      <div class="rec-row"><span class="name">Entrenamientos guardados</span><span class="val">${nLogs}</span></div>
      <div class="rec-row"><span class="name">Ejercicios personalizados</span><span class="val">${nCustom}</span></div>
      <div class="rec-row"><span class="name">Objetivos activos</span><span class="val">${S.goals.length}</span></div>
    </div>

    <div class="set-card">
      <h3>Tu nombre</h3>
      <input class="inp l" value="${esc(S.settings.name || '')}" maxlength="24" aria-label="Tu nombre" oninput="S.settings.name=this.value;saveLogs()">
    </div>

    <div class="set-card">
      <h3>Tema de color</h3>
      <div class="theme-grid">
        ${Object.entries(THEMES).map(([k, t]) => `
          <button class="theme-btn ${theme === k ? 'on' : ''}" onclick="setTheme('${k}')">
            <div class="swatch">
              <i style="background:${t.bg};border:1px solid ${t.line}"></i>
              <i style="background:${t.surface}"></i>
              <i style="background:${t.ac}"></i>
            </div>
            <strong>${t.name}</strong>
          </button>
        `).join('')}
      </div>
    </div>

    <div class="set-card">
      <h3>Unidades de peso</h3>
      <div class="unit-row">
        <button class="unit-btn ${units === 'kg' ? 'on' : ''}" onclick="setUnits('kg')">kg</button>
        <button class="unit-btn ${units === 'lbs' ? 'on' : ''}" onclick="setUnits('lbs')">lbs</button>
      </div>
    </div>

    <div class="set-card">
      <h3>Respaldo de datos</h3>
      <div class="set-actions">
        <button class="btn" onclick="exportData()">Exportar datos (JSON)</button>
        <button class="btn g" onclick="importData()">Importar datos</button>
        <button class="btn g" onclick="clearData()" style="color:var(--bad)">Borrar todos los datos</button>
      </div>
      <input type="file" id="import-file" accept=".json,application/json" hidden onchange="handleImport(event)">
    </div>
  `;
}

function setTheme(key) {
  applyTheme(key);
  toast('Tema aplicado');
  renderProfile();
}
function setUnits(u) {
  S.settings.units = u;
  saveLogs();
  toast('Unidades: ' + u);
  renderProfile();
  // refresh open views that show weights
  if (!$('.view[data-view="stats"]').hidden) renderStats();
  if (!$('.view[data-view="train"]').hidden) renderTrain();
  if (!$('.view[data-view="programs"]').hidden) {
    const seg = $$('.seg button.active')[0]?.dataset.seg;
    if (seg === 'routines') renderWeek();
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gymtracker-backup-${dkey(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Datos exportados');
}
function importData() { $('#import-file').click(); }
function handleImport(ev) {
  const file = ev.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  const ib = document.querySelector('[onclick="importData()"]');
  if (ib) ib.classList.add('is-loading');
  reader.onerror = () => { if (ib) ib.classList.remove('is-loading'); toast('No se pudo leer el archivo'); };
  reader.onload = () => {
    if (ib) ib.classList.remove('is-loading');
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object') throw new Error('Formato inválido');
      if (!confirm('¿Importar estos datos? Se sobrescribirán los actuales.')) return;
      S.logs = data.logs || [];
      S.plan = data.plan || {};
      S.customEx = data.customEx || [];
      S.settings = data.settings || S.settings;
      S.goals = data.goals || S.goals;
      saveLogs();
      applyTheme(S.settings.theme || 'oled');
      alert('Datos importados correctamente');
      renderProfile();
    } catch (e) {
      alert('Error al importar: archivo inválido');
    }
    ev.target.value = '';
  };
  reader.readAsText(file);
}
function clearData() {
  if (!confirm('¿Borrar TODOS los datos? Esta acción no se puede deshacer.')) return;
  if (!confirm('Confirma de nuevo: se eliminarán logs, rutinas, objetivos y ejercicios personalizados.')) return;
  S = { logs: [], plan: {}, customEx: [], settings: S.settings, goals: [] };
  saveLogs();
  ss = null; saveS();
  toast('Datos borrados');
  renderProfile();
  renderHome();
}

/* ===== Sesión ===== */
function lastSets(n) {
  for (const l of [...S.logs].sort((a, b) => a.date < b.date ? 1 : -1)) {
    const e = l.entries.find(e => e.name === n);
    if (e) return e.sets;
  }
  return null;
}
function numLabel(e, j) {
  if (e.sets[j].t === 'W') return 'W';
  let n = 0;
  for (let x = 0; x <= j; x++) if (e.sets[x].t !== 'W') n++;
  return n;
}
function sumHTML(e) {
  let vol = 0, reps = 0;
  e.sets.forEach(s => {
    if (s.done && s.t !== 'W') {
      const r = parseInt(s.reps) || 0;
      vol += num(s.kg) * r;
      reps += r;
    }
  });
  const avg = reps ? vol / reps : 0;
  const vt = S.settings.units === 'lbs'
    ? (vol >= 453.6 ? ((vol * 2.20462) / 2000).toFixed(1) + ' ton' : Math.round(vol * 2.20462) + ' lbs')
    : (vol >= 1000 ? (vol / 1000).toFixed(1) + ' ton' : Math.round(vol) + ' kg');
  return `<div><b>${vt}</b><span>Volumen total</span></div><div><b>${reps}</b><span>Reps totales</span></div><div><b>${avg ? toDisplay(avg).toFixed(1) : 0} ${unitLabel()}</b><span>Peso promedio</span></div>`;
}
function exCard(e, i) {
  let h = `<div class="card ex"><div class="ex-h"><h2>${esc(e.name)}</h2><span class="mu">⏱</span>
 <input class="inp" inputmode="numeric" value="${e.rest}" oninput="ss.entries[${i}].rest=parseInt(this.value)||0;saveS()"><span class="mu">s</span>
 <button class="x" onclick="rmEx(${i})" aria-label="Quitar ejercicio">✕</button></div>
 <div class="tr"><span class="th">Serie</span><span class="th">Anterior</span><span class="th">${unitLabel()}</span><span class="th">Reps</span><span class="th">✓</span></div>`;
  e.sets.forEach((s, j) => {
    const disp = s.kg !== '' && s.kg != null ? toDisplay(num(s.kg)) : '';
    const prev = (lastSets(e.name) || [])[j], mxp = prMax(e.name);
    const lbl = s.t === 'W' ? 'W' : s.t === 'D' ? 'D' : s.t === 'F' ? 'F' : numLabel(e, j);
    const isPR = s.done && s.t !== 'W' && mxp > 0 && num(s.kg) > mxp;
    h += `<div class="tr${isPR ? ' is-pr' : ''}"><button class="ty ${s.t==='W'?'w':s.t==='D'?'d':s.t==='F'?'f':'e'}" onclick="tgl(${i},${j})" aria-label="Tipo de serie, toca para cambiar">${lbl}</button>
  <button class="prev" onclick="fillPrev(${i},${j})"${prev ? '' : ' disabled'} aria-label="Usar serie anterior">${prev ? toDisplay(prev.kg) + unitLabel() + ' × ' + prev.reps : '—'}</button>
  <input class="inp" inputmode="decimal" placeholder="${unitLabel()}" value="${disp}" oninput="inp(${i},${j},'kg',fromDisplay(this.value))">
  <input class="inp" inputmode="numeric" placeholder="reps" value="${esc(s.reps)}" oninput="inp(${i},${j},'reps',this.value)">
  <button class="ck ${s.done ? 'on' : ''}" onclick="tick(${i},${j},this)" aria-label="Serie completada" aria-pressed="${!!s.done}">✓</button></div>`;
  });
  return h + `<div class="rowb"><button class="btn g" onclick="addS(${i})">+ Agregar serie</button><button class="btn g s" onclick="rmS(${i})">−</button></div>
 <div class="sum" id="sum-${i}">${sumHTML(e)}</div></div>`;
}

function renderTrain() {
  const root = $('#train-root'), v = root.closest('.view'), sc = v.scrollTop;
  const names = [...new Set([...allExercises().map(e => e.name), ...S.logs.flatMap(l => l.entries.map(e => e.name))])];
  const dl = `<datalist id="exlist">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;
  if (!ss) {
    root.innerHTML = `<header class="vh"><h1>Entrenar</h1><p>Inicio rápido</p></header>
  <div class="card"><p class="mu" style="margin:0 0 12px;font-size:.9rem">Pulsa el botón central o inicia aquí. Si tienes una rutina programada para hoy se cargará automáticamente.</p>
  <button class="btn" onclick="openStartModal()">Iniciar entrenamiento</button><button class="btn g" style="margin-top:8px" onclick="show('home')">Volver</button></div>`;
    return;
  }
  let h = `<div class="sh"><button class="x" onclick="show('home')" aria-label="Minimizar entrenamiento">⌄</button><input class="ttl" value="${esc(ss.title)}" maxlength="40" oninput="ss.title=this.value;saveS()">
  <span class="clk" id="g-time">00:00</span><button class="btn fin" onclick="finish()">Finalizar</button></div>`;
  h += `<div class="map-mini">
    <div class="map-hd">
      <strong>Trabajo muscular de la sesión</strong>
      <div class="map-tog">
        <button class="${mapSide === 'front' ? 'on' : ''}" onclick="setMapSide('front')">Frente</button>
        <button class="${mapSide === 'back' ? 'on' : ''}" onclick="setMapSide('back')">Espalda</button>
      </div>
    </div>
    <div class="map-svg-box" id="train-map">${muscleSVG(mapSide, getSessionHeat())}</div>
  </div>`;
  if (!ss.entries.length) h += `<div class="empty"><strong>Sesión vacía</strong><span>Agrega tu primer ejercicio abajo.</span></div>`;
  ss.entries.forEach((e, i) => h += exCard(e, i));
  h += `${dl}<div class="addx"><input class="inp l" id="nx" list="exlist" placeholder="Nombre del ejercicio" maxlength="40" onkeydown="if(event.key==='Enter')addEx()"></div>
 <button class="btn" onclick="addEx()">+ Agregar ejercicio</button><div style="height:110px"></div>
 <div class="rbar" id="rbar"><div onclick="startRest(90)"><small id="rl">Descanso automático</small><div class="big" id="rt">--:--</div></div>
 <div class="b"><button class="btn g s" onclick="adj(30)">+30s</button><button class="btn g s" onclick="startRest(60)">60s</button><button class="btn g s" onclick="startRest(90)">90s</button><button class="x" onclick="startRest(0)" aria-label="Saltar descanso">✕</button></div></div>`;
  root.innerHTML = h;
  v.scrollTop = sc;
  tickUI();
}

async function lock() {
  try { if (ss && !document.hidden) wl = await navigator.wakeLock.request('screen'); } catch (e) {}
}
function startSess(fromPlan = false) {
  let title = 'Entrenamiento', entries = [];
  if (fromPlan) {
    const key = getTodayKey();
    const day = S.plan[key];
    if (day && day.exercises && day.exercises.length) {
      title = day.title || DAYS.find(d => d.k === key)?.n || title;
      entries = day.exercises.map(e => ({
        name: e.name, rest: e.rest || 90,
        sets: (e.sets || []).map(s => ({ t: 'E', kg: s.kg != null ? String(s.kg) : '', reps: s.reps != null ? String(s.reps) : '', done: false }))
      }));
    }
  }
  ss = { title, date: dkey(new Date()), start: Date.now(), entries };
  saveS(); renderTrain(); lock();
}
function addEx() {
  const n = $('#nx').value.trim();
  if (!n) return;
  const l = lastSets(n);
  const sets = l && l.length ? l.map(s => ({ t: 'E', kg: s.kg, reps: s.reps, done: false })) : [0, 1, 2].map(() => ({ t: 'E', kg: '', reps: '', done: false }));
  ss.entries.push({ name: n, rest: 90, sets });
  saveS(); renderTrain();
  const c = document.querySelectorAll('.ex');
  c[c.length - 1].scrollIntoView({ block: 'center' });
}
function rmEx(i) { if (!confirm('¿Quitar este ejercicio?')) return; ss.entries.splice(i, 1); saveS(); renderTrain(); }
function addS(i) {
  const s = ss.entries[i].sets, l = s[s.length - 1];
  s.push({ t: 'E', kg: l ? l.kg : '', reps: l ? l.reps : '', done: false });
  saveS(); renderTrain();
}
function rmS(i) { ss.entries[i].sets.pop(); saveS(); renderTrain(); }
function tgl(i, j) {
  const s = ss.entries[i].sets[j];
  const order = ['E', 'W', 'D', 'F'];
  const idx = order.indexOf(s.t || 'E');
  s.t = order[(idx + 1) % order.length];
  saveS();
  renderTrain();
  if (navigator.vibrate) navigator.vibrate(15);
}
function inp(i, j, f, v) {
  ss.entries[i].sets[j][f] = f === 'kg' ? v : v;
  saveS();
  $('#sum-' + i).innerHTML = sumHTML(ss.entries[i]);
}
function tick(i, j, b) {
  const e = ss.entries[i], s = e.sets[j];
  s.done = !s.done;
  b.classList.toggle('on', s.done);
  if (s.done) {
    b.classList.remove('pulse');
    void b.offsetWidth;
    b.classList.add('pulse');
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
    const card = b.closest('.ex');
    if (card) { card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash'); }
  }
  $('#sum-' + i).innerHTML = sumHTML(e);
  if (s.done && e.rest > 0) startRest(e.rest);
  saveS();
  updateTrainMap();
}
function finish() {
  const ent = ss.entries
    .map(e => ({
      name: e.name,
      rest: e.rest || 90,
      allSets: e.sets.filter(s => s.done).map(s => ({ t: s.t || 'E', kg: num(s.kg), reps: parseInt(s.reps) || 0 })),
      sets: e.sets.filter(s => s.done && s.t !== 'W').map(s => ({ kg: num(s.kg), reps: parseInt(s.reps) || 0 }))
    }))
    .filter(e => e.sets.length);
  if (ent.length) {
    if (!confirm('¿Finalizar y guardar el entrenamiento?')) return;
    S.logs.push({
      date: ss.date,
      title: ss.title,
      dur: Math.round((Date.now() - ss.start) / 1000),
      entries: ent.map(e => ({ name: e.name, sets: e.sets }))
    });
    saveLogs();
    toast('Entrenamiento guardado');
    // Preguntar si actualizar rutina del calendario
    const key = getTodayKey();
    const day = S.plan[key];
    if (day && day.exercises && day.exercises.length) {
      if (confirm('¿Actualizar la rutina base del calendario con los pesos y reps de hoy?')) {
        const byName = {};
        ent.forEach(e => {
          byName[e.name] = {
            name: e.name,
            rest: e.rest,
            sets: (e.allSets.length ? e.allSets : e.sets).map(s => ({
              kg: String(s.kg || ''),
              reps: String(s.reps || '')
            }))
          };
        });
        day.exercises = day.exercises.map(ex => byName[ex.name] || ex);
        // agregar ejercicios nuevos de la sesión que no estaban en el plan
        ent.forEach(e => {
          if (!day.exercises.some(x => x.name === e.name)) {
            day.exercises.push(byName[e.name]);
          }
        });
        saveLogs();
        toast('Rutina del calendario actualizada');
      }
    }
  } else if (!confirm('No completaste ninguna serie efectiva. ¿Descartar el entrenamiento?')) return;
  ss = null; saveS(); R = { end: 0, fin: false };
  try { wl && wl.release(); } catch (e) {}
  renderTrain(); show('home');
}

/* Cronómetros */
function unlock() { try { AC = AC || new (window.AudioContext || webkitAudioContext)(); AC.resume(); } catch (e) {} }
function beep() {
  try {
    const o = AC.createOscillator(), g = AC.createGain();
    o.connect(g); g.connect(AC.destination);
    o.frequency.value = 880; g.gain.value = .25;
    o.start(); o.stop(AC.currentTime + .5);
  } catch (e) {}
  navigator.vibrate && navigator.vibrate([250, 100, 250]);
}
function startRest(sec) { unlock(); R = { end: sec > 0 ? Date.now() + sec * 1000 : 0, fin: false }; tickUI(); }
function adj(d) { if (R.end) R.end = Math.max(Date.now() + 1000, R.end + d * 1000); tickUI(); }
function tickUI() {
  const rs = $('#resume');
  if (rs) { const on = !!ss && !document.body.classList.contains('in-train'); rs.hidden = !on; if (on) $('#resume-c').textContent = fmt((Date.now() - ss.start) / 1000); }
  if (!ss) return;
  const g = $('#g-time');
  if (g) g.textContent = fmt((Date.now() - ss.start) / 1000);
  const rt = $('#rt'), rl = $('#rl'), bar = $('#rbar');
  if (!rt) return;
  if (R.end) {
    const left = Math.ceil((R.end - Date.now()) / 1000);
    if (left <= 0) { R = { end: 0, fin: true }; beep(); }
    else { rt.textContent = fmt(left); rl.textContent = 'Descansando'; bar.classList.add('go'); return; }
  }
  bar.classList.remove('go');
  rt.textContent = R.fin ? '¡Listo!' : '--:--';
  rl.textContent = R.fin ? 'A la siguiente serie' : 'Se inicia al completar una serie';
}
setInterval(tickUI, 250);
document.addEventListener('visibilitychange', lock);

/* Modales */
$('#start-modal').addEventListener('click', e => { if (e.target.id === 'start-modal') closeStartModal(); });
$('#custom-modal').addEventListener('click', e => { if (e.target.id === 'custom-modal') closeCustomModal(); });
$('#goal-modal').addEventListener('click', e => { if (e.target.id === 'goal-modal') closeGoalModal(); });
$('#log-modal').addEventListener('click', e => { if (e.target.id === 'log-modal') closeLogModal(); });
addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!$('#start-modal').hidden) closeStartModal();
    if (!$('#custom-modal').hidden) closeCustomModal();
    if (!$('#goal-modal').hidden) closeGoalModal();
    if (!$('#log-modal').hidden) closeLogModal();
  }
});

renderTrain();
