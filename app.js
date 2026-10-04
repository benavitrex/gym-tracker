'use strict';
const VIEWS = ['home', 'stats', 'train', 'programs', 'profile'];
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const num = v => parseFloat(String(v).replace(',', '.')) || 0;
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DETECT_RULES = [
  ['hombros', ['press militar','militar','hombro','elevacion lateral','elevaciones lateral','lateral raise','elevacion frontal','elevaciones frontal','pajaro','rear delt','arnold','encogimiento','shrug','deltoid','overhead press']],
  ['abdomen', ['crunch','plancha','plank','abdom','core','twist','ab wheel','rueda abdominal','elevacion de pierna','elevaciones de pierna','sit up','situp','oblicu','hollow','mountain climber']],
  ['piernas', ['sentadilla','squat','prensa','zancada','lunge','pierna','gemelo','pantorrilla','femoral','cuadricep','gluteo','hip thrust','rumano','isquio','aductor','abductor','step up','hack','calf']],
  ['brazos',  ['curl','bicep','tricep','martillo','frances','predicador','antebrazo','skull','patada de tricep']],
  ['espalda', ['remo','dominada','jalon','peso muerto','espalda','pulldown','pull down','pull up','pullup','lumbar','hiperextension','dorsal','trapecio','row','deadlift']],
  ['pecho',   ['pecho','banca','press','apertura','fondos','crossover','cruce','pec deck','flexion','push up','pushup','fly','bench','chest']]
];
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
let chartDays = 30;
let openDayKey = null, dayCloseTimer = null;
let dayRadarCur = null, dayRadarRaf = 0;
let exName = null, exCal = { y: 0, m: 0 }, exCloseTimer = null, manualCat = null;
let calYear = new Date().getFullYear(), calMonth = new Date().getMonth(); // 0-11

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
  if (!e) {
    const d = detectEx(name);
    return d ? { primary: d.primary, secondary: d.secondary } : { primary: [], secondary: [] };
  }
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
let radarRange = 'week', radarPlan = false;
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
  if (name !== 'programs' && openDayKey) closeDay();
  if (exName) closeExProgress(true);
  document.body.classList.toggle('in-train', name === 'train');
  $$('.view').forEach(v => (v.hidden = v.dataset.view !== name));
  $$('.nav-btn').forEach(b => {
    const on = b.dataset.go === name;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  document.getElementById('views').scrollTop = 0;
  if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  if (name === 'programs') renderWeek();
  if (name === 'home') renderHome();
  if (name === 'train') renderTrain();
  if (name === 'stats') renderStats();
  if (name === 'profile') renderProfile();
}

$$('.nav-btn').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.go === 'train' && !ss) openStartModal();
  else show(b.dataset.go);
}));
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
      html += `<li><button type="button" class="lnk" data-ex="${esc(e.name)}" onclick="closeLogModal();openExProgress(this.dataset.ex)">${esc(e.name)}</button>: ${sets || '—'}</li>`;
    });
    html += `</ul>${muscleChips({ exercises: l.entries })}</div>`;
  });
  $('#log-modal-title').textContent = dateStr;
  $('#log-modal-body').innerHTML = html;
  $('#log-modal').hidden = false;
}
function closeLogModal() { $('#log-modal').hidden = true; }

/* ===== Programas: tarjetas + push screen ===== */
function renderWeek() {
  const root = $('#programs-week');
  if (!root) return;
  const todayKey = getTodayKey();
  root.innerHTML = DAYS.map(d => {
    const day = ensureDay(d.k), n = day.exercises.length, isToday = d.k === todayKey;
    const prev = day.exercises.slice(0, 3).map(e => `<li>${esc(e.name)}</li>`).join('')
      + (n > 3 ? `<li class="more">+${n - 3} más</li>` : '');
    return `<button type="button" class="dcard${isToday ? ' today' : ''}${n ? '' : ' rest'}" onclick="openDay('${d.k}')">
      <span class="badge">${d.short}</span>
      <span class="dc-info">
        <strong>${d.n}${isToday ? '<em class="today-pill">Hoy</em>' : ''}</strong>
        <small>${esc(day.title || (n ? 'Rutina' : 'Descanso'))}${n ? ' · ' + n + ' ejercicio' + (n > 1 ? 's' : '') : ''}</small>
        ${n ? `<ul class="dc-prev">${prev}</ul>${muscleChips(day)}` : '<span class="dc-empty">Sin rutina · toca para armarla</span>'}
      </span>
      <span class="chev" aria-hidden="true">›</span>
    </button>`;
  }).join('');
  if (openDayKey) renderDayScreen();
}

function openDay(key) {
  clearTimeout(dayCloseTimer);
  openDayKey = key;
  dayRadarCur = null;
  const sc = $('#day-screen'), body = $('#day-body');
  sc.hidden = false;
  body.classList.add('stagger');
  renderDayScreen();
  $('#day-scroll').scrollTop = 0;
  requestAnimationFrame(() => requestAnimationFrame(() => sc.classList.add('show')));
  setTimeout(() => body.classList.remove('stagger'), 1000);
}

function closeDay() {
  const sc = $('#day-screen');
  if (!sc || sc.hidden) return;
  openDayKey = null;
  cancelAnimationFrame(dayRadarRaf); dayRadarCur = null;
  sc.classList.remove('show');
  dayCloseTimer = setTimeout(() => { sc.hidden = true; }, 300);
  renderWeek();
}

function renderDayScreen() {
  const key = openDayKey;
  if (!key) return;
  const d = DAYS.find(x => x.k === key), day = ensureDay(key), n = day.exercises.length;
  const sc = $('#day-scroll'), top = sc.scrollTop;
  $('#day-name').textContent = d.n;
  $('#day-today').hidden = key !== getTodayKey();
  $('#day-body').innerHTML = `
    <div class="day-title">
      <input class="inp l" placeholder="Nombre de la rutina (ej. Push, Piernas…)" maxlength="40"
        value="${esc(day.title)}" oninput="setDayTitle('${key}', this.value)">
    </div>
    ${n
      ? day.exercises.map((e, i) => `<div class="dx" style="--i:${i}">${planExCard(key, e, i)}</div>`).join('')
      : '<div class="empty dx" style="--i:0"><strong>Día libre</strong><span>Aún no hay ejercicios para este día.</span></div>'}
    <button class="btn dx" style="--i:${n + 1}" onclick="openManualModal()">+ Añadir ejercicio a mano</button>`;
  sc.scrollTop = top;
  renderDayRadar();
}

function setDayTitle(key, val) { ensureDay(key).title = val; saveLogs(); }
function planExCard(key, e, i) {
  let h = `<div class="pex"><div class="pex-h"><h3><button type="button" class="pex-name" data-ex="${esc(e.name)}" onclick="openExProgress(this.dataset.ex)">${esc(e.name)} <span aria-hidden="true">›</span></button></h3>
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
function rmPlanEx(key, i) { if (!confirm('¿Quitar este ejercicio del día?')) return; ensureDay(key).exercises.splice(i, 1); saveLogs(); renderWeek(); }
function setPlanRest(key, i, v) { ensureDay(key).exercises[i].rest = parseInt(v) || 90; saveLogs(); }
function setPlanSet(key, i, j, field, val) { ensureDay(key).exercises[i].sets[j][field] = val; saveLogs(); if (openDayKey === key) renderDayRadar(); }
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

/* ===== Radar de distribución por día ===== */
const DR = [
  { k: 'pecho', l: 'Pecho' }, { k: 'hombros', l: 'Hombros' }, { k: 'triceps', l: 'Tríceps' }, { k: 'biceps', l: 'Bíceps' },
  { k: 'espalda', l: 'Espalda' }, { k: 'piernas', l: 'Piernas' }, { k: 'abdomen', l: 'Core' }
];
function armOf(n) {
  if (/tricep|frances|skull|fondo|patada|pushdown/.test(n)) return 'tri';
  if (/curl|bicep|martillo|predicador|concentrad/.test(n)) return 'bi';
  if (/remo|row|jalon|dominada|pull|face/.test(n)) return 'bi';
  if (/press|banca|militar|arnold|bench|flexion|push|extension/.test(n)) return 'tri';
  return null;
}
function armShare(name) {
  const ex = findEx(name), a = ex && ex.arm ? ex.arm : armOf(norm(name));
  return a === 'tri' ? { tri: 1, bi: 0 } : a === 'bi' ? { tri: 0, bi: 1 } : { tri: .5, bi: .5 };
}
function dayRadarVals(day) {
  const ex = (day && day.exercises) || [];
  const useVol = ex.length > 0 && ex.every(e => exVol(e.sets) > 0);
  const acc = Object.fromEntries(DR.map(r => [r.k, 0])), unknown = [];
  ex.forEach(e => {
    const m = getMuscles(e.name), load = useVol ? exVol(e.sets) : (e.sets || []).length;
    if (!m.primary.length && !m.secondary.length) { unknown.push(e.name); return; }
    const add = (k, w) => {
      if (k === 'brazos') { const s = armShare(e.name); acc.triceps += w * s.tri; acc.biceps += w * s.bi; }
      else if (k in acc) acc[k] += w;
    };
    m.primary.forEach(k => add(k, load));
    m.secondary.forEach(k => { if (!m.primary.includes(k)) add(k, load / 2); });
  });
  return { vals: DR.map(r => acc[r.k]), useVol, unknown };
}
const dRadXY = (i, f) => { const a = -Math.PI / 2 + i * 2 * Math.PI / DR.length; return [160 + 95 * f * Math.cos(a), 140 + 95 * f * Math.sin(a)]; };
function paintDayRadar(v) {
  const poly = $('#drad-poly');
  if (!poly) return;
  poly.setAttribute('points', v.map((x, i) => dRadXY(i, x).map(n => n.toFixed(1)).join(',')).join(' '));
  $$('.drad-dot').forEach((d, i) => { const [x, y] = dRadXY(i, v[i]); d.setAttribute('cx', x.toFixed(1)); d.setAttribute('cy', y.toFixed(1)); });
}
function renderDayRadar() {
  const box = $('#day-radar');
  if (!box || !openDayKey) return;
  const day = ensureDay(openDayKey), { vals, useVol, unknown } = dayRadarVals(day), n = DR.length;
  const total = vals.reduce((a, b) => a + b, 0);
  cancelAnimationFrame(dayRadarRaf);
  const note = unknown.length ? `<p class="hint" style="margin:10px 0 0">Sin clasificar: ${unknown.map(esc).join(', ')}. Al añadirlo a mano puedes elegir su grupo.</p>` : '';
  if (!total) {
    dayRadarCur = null;
    box.innerHTML = `<div class="chart-card"><div class="chart-hd"><strong>Distribución de volumen</strong></div>
      <div class="empty" style="margin:0"><strong>Radar vacío</strong><span>Añade ejercicios y el gráfico se deformará hacia los músculos que trabajes.</span></div>${note}</div>`;
    return;
  }
  const mx = Math.max(...vals), target = vals.map(v => v / mx), top = vals.indexOf(mx);
  const rings = [.25, .5, .75, 1].map(f => `<polygon class="radar-ring" points="${DR.map((r, i) => dRadXY(i, f).map(x => x.toFixed(1)).join(',')).join(' ')}"/>`).join('');
  const axes = DR.map((r, i) => {
    const [x, y] = dRadXY(i, 1), [lx, ly] = dRadXY(i, 1.22), c = Math.cos(-Math.PI / 2 + i * 2 * Math.PI / n);
    return `<line class="radar-ring" x1="160" y1="140" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="radar-lbl${i === top ? ' hi' : ''}" x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${c > .3 ? 'start' : c < -.3 ? 'end' : 'middle'}">${r.l}</text>`;
  }).join('');
  const dots = DR.map((r, i) => `<circle class="radar-dot drad-dot" r="4" cx="160" cy="140"${target[i] > 0 ? '' : ' style="display:none"'}/>`).join('');
  const tags = DR.map((r, i) => ({ l: r.l, v: vals[i] })).filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 4)
    .map(x => `<span class="mtag p">${x.l} ${Math.round(x.v / total * 100)}%</span>`).join('');
  box.innerHTML = `<div class="chart-card"><div class="chart-hd"><strong>Distribución de volumen</strong><span class="mu" style="font-size:.72rem">${useVol ? 'Por volumen (kg × reps)' : 'Por series'}</span></div>
    <svg class="radar" viewBox="0 0 320 280" role="img" aria-label="Radar de distribución por grupo muscular">${rings}${axes}<polygon id="drad-poly" class="radar-real" points=""/>${dots}</svg>
    <div class="muscle-tags mchips" style="justify-content:center">${tags}</div>${note}</div>`;
  const from = dayRadarCur && dayRadarCur.length === n ? dayRadarCur : new Array(n).fill(0), t0 = performance.now(), dur = REDUCED ? 1 : 450;
  (function f(now) {
    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    const cur = target.map((t, i) => from[i] + (t - from[i]) * e);
    dayRadarCur = cur; paintDayRadar(cur);
    if (p < 1) dayRadarRaf = requestAnimationFrame(f);
  })(t0);
}

/* ===== Añadir ejercicio a mano ===== */
const MANUAL_CHIPS = [
  { k: 'pecho', l: 'Pecho' }, { k: 'espalda', l: 'Espalda' }, { k: 'piernas', l: 'Piernas' }, { k: 'hombros', l: 'Hombros' },
  { k: 'triceps', l: 'Tríceps' }, { k: 'biceps', l: 'Bíceps' }, { k: 'abdomen', l: 'Core' }
];
const manualPreset = k => k === 'triceps' ? { cat: 'brazos', primary: ['brazos'], secondary: [], arm: 'tri' }
  : k === 'biceps' ? { cat: 'brazos', primary: ['brazos'], secondary: [], arm: 'bi' }
  : { cat: k, primary: [k], secondary: [] };
const hasKey = (n, k) => n === k || n.startsWith(k) || n.includes(' ' + k);
function detectEx(name) {
  const n = norm(name);
  if (n.length < 3) return null;
  const ex = findEx(name);
  if (ex) return { src: 'exact', cat: ex.cat, primary: ex.primary || [], secondary: ex.secondary || [], arm: ex.arm, ref: ex.name };
  let best = null;
  allExercises().forEach(e => {
    const en = norm(e.name);
    if (en.length < 4) return;
    if ((n.includes(en) || (n.length >= 5 && en.includes(n))) && (!best || en.length > norm(best.name).length)) best = e;
  });
  if (best) return { src: 'lib', cat: best.cat, primary: [...(best.primary || [])], secondary: [...(best.secondary || [])], arm: best.arm, ref: best.name };
  for (const [cat, keys] of DETECT_RULES) {
    if (!keys.some(k => hasKey(n, k))) continue;
    const sec = [];
    if (cat === 'pecho' && /press|banca|bench|fondos/.test(n)) sec.push('hombros', 'brazos');
    else if (cat === 'hombros' && /press|militar|arnold/.test(n)) sec.push('brazos');
    else if (cat === 'espalda' && /remo|row|dominada|jalon|pull/.test(n)) sec.push('brazos');
    return { src: 'kw', cat, primary: [cat], secondary: sec, arm: cat === 'brazos' ? (armOf(n) || undefined) : undefined };
  }
  return null;
}
function openManualModal() {
  if (!openDayKey) return;
  manualCat = null;
  $('#man-name').value = '';
  const names = [...new Set([...allExercises().map(e => e.name), ...S.logs.flatMap(l => (l.entries || []).map(e => e.name))])];
  $('#exlist-man').innerHTML = names.map(n => `<option value="${esc(n)}">`).join('');
  renderManualChips(); onManualInput();
  $('#manual-modal').hidden = false;
  setTimeout(() => $('#man-name').focus(), 60);
}
function closeManualModal() { $('#manual-modal').hidden = true; }
function renderManualChips() {
  $('#man-cat').innerHTML = `<button type="button" class="chip ${manualCat ? '' : 'on'}" onclick="setManualCat(null)">Auto</button>`
    + MANUAL_CHIPS.map(m => `<button type="button" class="chip ${manualCat === m.k ? 'on' : ''}" onclick="setManualCat('${m.k}')">${m.l}</button>`).join('');
}
function setManualCat(k) { manualCat = k; renderManualChips(); onManualInput(); }
function onManualInput() {
  const el = $('#man-detect'), name = $('#man-name').value.trim();
  if (name.length < 3) { el.innerHTML = ''; return; }
  const lab = (a, arm) => a.map(k => k === 'brazos' && arm ? (arm === 'tri' ? 'Tríceps' : 'Bíceps') : (MG[k] ? (k === 'abdomen' ? 'Core' : MG[k].label) : k)).join(', ');
  if (manualCat) { el.innerHTML = `Se clasificará como <b>${MANUAL_CHIPS.find(m => m.k === manualCat).l}</b>.`; return; }
  const d = detectEx(name);
  if (!d) el.innerHTML = 'No pude clasificarlo: elige un grupo o añádelo sin clasificar.';
  else if (d.src === 'exact') el.innerHTML = `Ya existe en tu biblioteca: <b>${esc(d.ref)}</b>.`;
  else el.innerHTML = `Detectado: <b>${lab(d.primary, d.arm)}</b>${d.secondary.length ? ' · secundarios: ' + lab(d.secondary) : ''}`;
}
function saveManualEx() {
  const key = openDayKey;
  if (!key) return;
  const raw = $('#man-name').value.replace(/\s+/g, ' ').trim();
  if (!raw) { toast('Escribe un nombre'); return; }
  const existing = findEx(raw), name = existing ? existing.name : raw, day = ensureDay(key);
  if (day.exercises.some(x => norm(x.name) === norm(name))) { toast('Ese ejercicio ya está en este día'); return; }
  let classified = true;
  if (!existing) {
    const d = manualCat ? manualPreset(manualCat) : detectEx(raw);
    if (d) {
      const rec = { name, cat: d.cat, primary: [...d.primary], secondary: (d.secondary || []).filter(k => !d.primary.includes(k)) };
      if (d.arm) rec.arm = d.arm;
      S.customEx.push(rec);
    } else classified = false;
  }
  const last = lastSets(name);
  const sets = last && last.length ? last.map(s => ({ kg: s.kg || '', reps: s.reps || '' })) : [{ kg: '', reps: '' }, { kg: '', reps: '' }, { kg: '', reps: '' }];
  day.exercises.push({ name, rest: 90, sets });
  saveLogs();
  closeManualModal();
  renderWeek();
  toast(classified ? 'Ejercicio añadido' : 'Añadido sin clasificar');
  requestAnimationFrame(() => { const c = $$('#day-body .pex'); if (c.length) c[c.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' }); });
}

/* ===== Progreso por ejercicio ===== */
function exHistory(name) {
  const n = norm(name), by = {};
  S.logs.forEach(l => (l.entries || []).forEach(e => {
    if (norm(e.name) !== n || !(e.sets || []).length) return;
    const o = by[l.date] || (by[l.date] = { date: l.date, kg: 0, vol: 0 });
    o.kg = Math.max(o.kg, ...e.sets.map(s => num(s.kg)));
    o.vol += exVol(e.sets);
  }));
  const arr = Object.values(by).sort((a, b) => a.date.localeCompare(b.date));
  let best = 0;
  arr.forEach((p, i) => { p.pr = i > 0 && p.kg > best; best = Math.max(best, p.kg); });
  return arr;
}
function smoothPath(pts) {
  const n = pts.length, dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1].x - pts[i].x; m[i] = (pts[i + 1].y - pts[i].y) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p = pts[i], q = pts[i + 1], w = dx[i] / 3;
    d += ` C${(p.x + w).toFixed(1)},${(p.y + t[i] * w).toFixed(1)} ${(q.x - w).toFixed(1)},${(q.y - t[i + 1] * w).toFixed(1)} ${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  }
  return d;
}
function exChartSVG(hist) {
  const h = hist.slice(-30);
  if (!h.length || !h.some(p => p.kg > 0)) return '<div class="chart-empty">Aún no hay series con peso registrado para este ejercicio.</div>';
  const W = 320, H = 190, L = 38, R = 14, T = 24, B = 26, iw = W - L - R, ih = H - T - B;
  const lo = Math.min(...h.map(p => p.kg)), hi = Math.max(...h.map(p => p.kg));
  const pad = (hi - lo) * 0.2 || hi * 0.15 || 1, y0 = Math.max(0, lo - pad), y1 = hi + pad;
  const X = i => h.length === 1 ? L + iw / 2 : L + i / (h.length - 1) * iw;
  const Y = v => T + ih - (v - y0) / (y1 - y0) * ih;
  const dec = (y1 - y0) < 8 ? 1 : 0;
  const grid = [0, 1, 2, 3].map(i => {
    const v = y0 + (y1 - y0) * i / 3, y = Y(v).toFixed(1);
    return `<line class="ex-gl" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text class="ex-yl" x="${L - 6}" y="${(+y + 3).toFixed(1)}" text-anchor="end">${toDisplay(v).toFixed(dec)}</text>`;
  }).join('');
  const pts = h.map((p, i) => ({ x: X(i), y: Y(p.kg) }));
  const dl = s => new Date(s + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' });
  let curve = '';
  if (h.length > 1) {
    const line = smoothPath(pts);
    curve = `<path class="ex-area" d="${line} L${pts[pts.length - 1].x.toFixed(1)},${T + ih} L${pts[0].x.toFixed(1)},${T + ih} Z" fill="url(#exg)"/><path class="ex-line" pathLength="1" d="${line}"/>`;
  }
  const dots = h.map((p, i) => {
    const q = pts[i], tip = `<title>${dl(p.date)} · ${fmtWeight(p.kg)}${p.pr ? ' · PR' : ''}</title>`;
    return p.pr
      ? `<g>${tip}<circle class="ex-ring" cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="9"/><circle class="ex-dot pr" cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="5"/><text class="ex-prl" x="${q.x.toFixed(1)}" y="${(q.y - 13).toFixed(1)}">PR</text></g>`
      : `<g>${tip}<circle class="ex-dot" cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="3.5"/></g>`;
  }).join('');
  const xl = h.length === 1
    ? `<text class="ex-yl" x="${X(0)}" y="${H - 6}" text-anchor="middle">${dl(h[0].date)}</text>`
    : `<text class="ex-yl" x="${L}" y="${H - 6}" text-anchor="start">${dl(h[0].date)}</text><text class="ex-yl" x="${W - R}" y="${H - 6}" text-anchor="end">${dl(h[h.length - 1].date)}</text>`;
  return `<svg class="ex-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Progresión de peso por sesión">
    <defs><linearGradient id="exg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--ac)" stop-opacity=".3"/><stop offset="100%" stop-color="var(--ac)" stop-opacity="0"/></linearGradient></defs>
    ${grid}${curve}${dots}${xl}</svg>`;
}
function exCalInner(hist) {
  const map = Object.fromEntries(hist.map(p => [p.date, p]));
  const { y, m } = exCal, start = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate();
  const total = Math.ceil((start + dim) / 7) * 7, today = dkey(new Date());
  let cells = '', nTrain = 0, nPR = 0;
  for (let i = 0; i < total; i++) {
    const dt = new Date(y, m, 1 - start + i), key = dkey(dt), inM = dt.getMonth() === m, p = map[key];
    if (p && inM) { nTrain++; if (p.pr) nPR++; }
    const cls = 'nc' + (inM ? '' : ' out') + (p ? ' did' : '') + (p && p.pr ? ' pr' : '') + (key === today ? ' today' : '');
    const inner = `<span class="nd">${dt.getDate()}</span>` + (p ? `<span class="nv">${p.kg > 0 ? +toDisplay(p.kg).toFixed(1) : '✓'}</span>` : '') + (p && p.pr ? '<span class="npr">PR</span>' : '');
    cells += p ? `<button type="button" class="${cls}" onclick="showDayLog('${key}')" aria-label="${key}${p.pr ? ', récord personal' : ''}">${inner}</button>` : `<div class="${cls}">${inner}</div>`;
  }
  return `<div class="cal-hd"><strong>${MESES[m]} ${y}</strong><div class="cal-nav">
      <button type="button" onclick="shiftExCal(-1)" aria-label="Mes anterior">‹</button>
      <button type="button" onclick="shiftExCal(1)" aria-label="Mes siguiente">›</button></div></div>
    <div class="ncal">${['D', 'L', 'M', 'X', 'J', 'V', 'S'].map(x => `<div class="ncal-dow">${x}</div>`).join('')}${cells}</div>
    <div class="ncal-foot"><span>${nTrain} día${nTrain !== 1 ? 's' : ''} este mes · ${nPR} PR</span><span class="ncal-leg"><i></i>Entrenado <i class="pr"></i>PR</span></div>`;
}
function shiftExCal(dir) {
  exCal.m += dir;
  if (exCal.m < 0) { exCal.m = 11; exCal.y--; }
  if (exCal.m > 11) { exCal.m = 0; exCal.y++; }
  const el = $('#ex-cal');
  if (el && exName) el.innerHTML = exCalInner(exHistory(exName));
}
function renderExProgress() {
  if (!exName) return;
  const hist = exHistory(exName), mu = getMuscles(exName);
  const tags = [...mu.primary.map(k => `<span class="mtag p">${MG[k] ? MG[k].label : k}</span>`), ...mu.secondary.map(k => `<span class="mtag s">${MG[k] ? MG[k].label : k}</span>`)].join('');
  const best = hist.length ? Math.max(...hist.map(p => p.kg)) : 0, nPR = hist.filter(p => p.pr).length;
  const gain = hist.length > 1 ? hist[hist.length - 1].kg - hist[0].kg : null;
  $('#ex-body').innerHTML = `
    ${tags ? `<div class="muscle-tags">${tags}</div>` : ''}
    <div class="ex-kpis">
      <div class="ex-kpi pr"><b>${best > 0 ? fmtWeight(best) : '—'}</b><span>Récord</span></div>
      <div class="ex-kpi"><b>${hist.length}</b><span>Sesiones</span></div>
      <div class="ex-kpi"><b>${gain === null ? '—' : (gain > 0 ? '+' : '') + fmtWeight(gain)}</b><span>Mejora total${nPR ? ' · ' + nPR + ' PR' : ''}</span></div>
    </div>
    <div class="chart-card" style="margin-bottom:var(--sp-3)">
      <div class="chart-hd"><strong>Progresión de peso</strong><span class="mu" style="font-size:.72rem">${unitLabel()} · máx. por sesión</span></div>
      ${exChartSVG(hist)}
    </div>
    <div class="home-card"><div id="ex-cal">${exCalInner(hist)}</div></div>`;
}
function openExProgress(name) {
  if (!name) return;
  clearTimeout(exCloseTimer);
  exName = name;
  const hist = exHistory(name), ref = hist.length ? new Date(hist[hist.length - 1].date + 'T12:00:00') : new Date();
  exCal = { y: ref.getFullYear(), m: ref.getMonth() };
  const sc = $('#ex-screen');
  sc.hidden = false;
  $('#ex-title').textContent = name;
  renderExProgress();
  $('#ex-scroll').scrollTop = 0;
  requestAnimationFrame(() => requestAnimationFrame(() => sc.classList.add('show')));
}
function closeExProgress(now) {
  if (!exName) return;
  exName = null;
  const sc = $('#ex-screen');
  sc.classList.remove('show');
  if (now === true) sc.hidden = true;
  else exCloseTimer = setTimeout(() => { sc.hidden = true; }, 300);
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
  if (openDayKey) renderDayScreen();
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
            `<button type="button" class="rec-row rec-link" data-ex="${esc(name)}" onclick="openExProgress(this.dataset.ex)"><span class="name">${esc(name)}</span><span class="val">${fmtWeight(kg)}</span></button>`
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
  if (!$('.view[data-view="programs"]').hidden) renderWeek();
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
$('#manual-modal').addEventListener('click', e => { if (e.target.id === 'manual-modal') closeManualModal(); });
addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!$('#start-modal').hidden) closeStartModal();
    if (!$('#custom-modal').hidden) closeCustomModal();
    if (!$('#goal-modal').hidden) closeGoalModal();
    if (!$('#log-modal').hidden) closeLogModal();
    if (!$('#manual-modal').hidden) closeManualModal();
  }
});

renderTrain();
