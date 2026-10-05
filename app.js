// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDViVTXXf4nByWujEO22kHft9NLquyAo-U",
  authDomain: "consistency-app2.firebaseapp.com",
  projectId: "consistency-app2",
  storageBucket: "consistency-app2.firebasestorage.app",
  messagingSenderId: "49921845728",
  appId: "1:49921845728:web:4ef4e46e292c62edb32385"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const VIEWS = ['home', 'stats', 'train', 'programs', 'profile'];
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const num = v => parseFloat(String(v).replace(',', '.')) || 0;
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_C = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DETECT_RULES = [
  ['hombros', ['press militar','militar','hombro','elevacion lateral','elevaciones lateral','lateral raise','elevacion frontal','elevaciones frontal','pajaro','rear delt','face pull','arnold','encogimiento','shrug','deltoid','overhead press']],
  ['abdomen', ['crunch','plancha','plank','abdom','core','twist','ab wheel','rueda abdominal','elevacion de pierna','elevaciones de pierna','sit up','situp','oblicu','hollow','mountain climber']],
  ['piernas', ['sentadilla','squat','prensa','zancada','lunge','pierna','gemelo','pantorrilla','femoral','cuadricep','gluteo','hip thrust','rumano','isquio','aductor','abductor','step up','hack','calf']],
  ['brazos',  ['curl','bicep','tricep','martillo','frances','predicador','antebrazo','skull','patada de tricep']],
  ['espalda', ['remo','dominada','jalon','peso muerto','espalda','pulldown','pull down','pull up','pullup','lumbar','hiperextension','dorsal','trapecio','row','deadlift']],
  ['pecho',   ['pecho','banca','press','apertura','fondos','crossover','cruce','pec deck','flexion','push up','pushup','fly','bench','chest']]
];
function buildBrand() { const w = $('#brand-w'); if (w) w.innerHTML = [...w.textContent].map((c, i) => `<i style="--i:${i}">${esc(c)}</i>`).join(''); }
function playBrand() { const b = $('#t-home'); if (!b) return; b.classList.remove('play'); void b.offsetWidth; b.classList.add('play'); }
const dkey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/* ===== Datos ===== */
let S; try { S = JSON.parse(localStorage.getItem('gt')); } catch (e) {}
S = S || {};
S.logs = S.logs || [];
S.plan = S.plan || {};
S.customEx = S.customEx || [];
S.settings = S.settings || { theme: 'grafito', units: 'kg' };
S.settings.name = S.settings.name ?? 'Eduardo';
S.goals = S.goals || [];

let ss = null;
try { ss = JSON.parse(localStorage.getItem('gt_s')); } catch (e) {}
if (ss && !Array.isArray(ss.entries)) ss = null;
if (ss) ss.entries.forEach(e => e.sets.forEach(s => { s.t = s.t || 'E'; }));

const saveS = () => { try { ss ? localStorage.setItem('gt_s', JSON.stringify(ss)) : localStorage.removeItem('gt_s'); } catch (e) {} };
const saveLogs = () => { try { localStorage.setItem('gt', JSON.stringify(S)); } catch (e) {} };

let R = { end: 0, fin: false }, AC = null, wl = null;
let openDayKey = null, dayCloseTimer = null;
let dayRadarCur = null, dayRadarRaf = 0;
let exName = null, exCal = { y: 0, m: 0 }, exCloseTimer = null;
let calYear = new Date().getFullYear(), calMonth = new Date().getMonth(); // 0-11
let heatYear = new Date().getFullYear(), weekIn = false, trainIn = false, dbCat = 'all', celeT = 0;
let pk = { ctx: 'day', cat: 'all', n: 0, flash: '' };

/* ===== Temas (paletas sobrias, todas con contraste AA) ===== */
const THEMES = {
  grafito: { name: 'Grafito', bg: '#0F1216', surface: '#171B21', line: '#272D36', tx: '#EEF0F3', mu: '#8F98A6', ac: '#E0B15A', on: '#1A1306' },
  glaciar: { name: 'Glaciar', bg: '#0B1016', surface: '#121922', line: '#212C39', tx: '#E8EEF4', mu: '#8196AB', ac: '#6DB4EA', on: '#06131D' },
  bosque:  { name: 'Bosque',  bg: '#0C110F', surface: '#131B17', line: '#223028', tx: '#E7EFEA', mu: '#84998D', ac: '#5DBE8E', on: '#06160E' },
  citrico: { name: 'Cítrico', bg: '#10120F', surface: '#171A14', line: '#272C22', tx: '#EFF2E8', mu: '#929B86', ac: '#BCD94F', on: '#121706' },
  ciruela: { name: 'Ciruela', bg: '#120F16', surface: '#1A151F', line: '#2B2433', tx: '#F0EBF3', mu: '#9A8EA6', ac: '#C58BDB', on: '#1B0C22' },
  carmin:  { name: 'Carmín',  bg: '#130F11', surface: '#1B1518', line: '#2D2428', tx: '#F3ECEE', mu: '#A0909A', ac: '#E36A82', on: '#230810' }
};
// Si tenías guardado un tema anterior, pasa al equivalente nuevo.
const LEGACY_THEMES = { oled: 'citrico', cian: 'glaciar', dracula: 'ciruela', rosepine: 'carmin', emerald: 'bosque' };

function applyTheme(key) {
  key = THEMES[key] ? key : (LEGACY_THEMES[key] || 'grafito');
  const t = THEMES[key];
  S.settings.theme = key;
  const r = document.documentElement.style;
  r.setProperty('--bg', t.bg);
  r.setProperty('--surface', t.surface);
  r.setProperty('--line', t.line);
  r.setProperty('--tx', t.tx);
  r.setProperty('--mu', t.mu);
  r.setProperty('--ac', t.ac);
  r.setProperty('--on-ac', t.on);
  document.body.style.background = t.bg;
  const meta = $('#meta-theme');
  if (meta) meta.content = t.bg;
  saveLogs();
}
applyTheme(S.settings.theme || 'grafito');

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
  { k: 'pecho', label: 'Pecho', emoji: '🫁', color: '#E8806F' },
  { k: 'espalda', label: 'Espalda', emoji: '🔙', color: '#5FBF9A' },
  { k: 'piernas', label: 'Piernas', emoji: '🦵', color: '#6F93E8' },
  { k: 'brazos', label: 'Brazos', emoji: '💪', color: '#E3B85C' },
  { k: 'hombros', label: 'Hombros', emoji: '🏋️', color: '#B48AE0' },
  { k: 'abdomen', label: 'Abdomen', emoji: '🔥', color: '#E486B4' }
];
const MG = Object.fromEntries(MGROUPS.map(m => [m.k, m]));
/* Base de ejercicios: la crea cada usuario (S.customEx). No hay ejercicios precargados. */
function allExercises() { return S.customEx; }
function findEx(name) {
  const n = norm(name || '');
  return n ? (S.customEx.find(e => norm(e.name) === n) || null) : null;
}
function getMuscles(name) {
  const e = findEx(name);
  return e ? { primary: e.primary || [], secondary: e.secondary || [] } : { primary: [], secondary: [] };
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
    <div class="radar-foot"><button class="chip${usePlan ? ' on' : ''}" aria-pressed="${usePlan}" onclick="radarPlan=!radarPlan;renderStats()"${radarRange === 'all' ? ' disabled' : ''}>Comparar con mi rutina</button>${plan ? '<span class="mu">- - - Rutina planificada</span>' : ''}</div>
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
  const dots = $$('.radar-dot'), t0 = performance.now(), dur = REDUCED ? 1 : 1000;   const ease = x => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);   (function f(now) {     const p = Math.min(1, (now - t0) / dur), t = ease(p);     rp.setAttribute('points', radarPts(v, mx, t));     if (pl) pl.setAttribute('points', radarPts(pv, mx, t));     dots.forEach((d, i) => { const [x, y] = radarXY(i, Math.min(1, v[RAD[i]] / mx) * t); d.setAttribute('cx', x.toFixed(1)); d.setAttribute('cy', y.toFixed(1)); });     if (p < 1) requestAnimationFrame(f);   })(t0); } function afterRender(root) {   animateRadar();   $$('[data-count]', root).forEach(el => {
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
  const sub = ss ? 'Sesión en curso · ' + esc(ss.title) : has ? esc(day.title || DAYS.find(d => d.k === key).n) : 'Sin rutina para hoy';
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
    return `<button class="rec-btn" onclick="showDayLog('${l.date}')"><span><strong>${esc(l.title || 'Entrenamiento')}</strong><small class="mu">${d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })} · ${Math.round((l.dur \vert{}\vert{} 0) / 60)} min</small></span><b>${fmtVol(v)}</b></button>`;
  }).join('') : '<div class="empty" style="margin:0"><strong>Aún no hay entrenamientos</strong><span>Tu historial aparecerá aquí al finalizar una sesión.</span></div>'}</div>`;
}

/* ===== Frases motivacionales (una distinta cada día) ===== */
const qs = (a, ...l) => l.map(q => ({ q, a }));
const QUOTES = [
  ...qs('Arnold Schwarzenegger',
    "La mente es el límite. Mientras la mente pueda imaginar que puedes hacer algo, puedes hacerlo, siempre que realmente lo creas al 100%.",
    "Las últimas tres o cuatro repeticiones son las que hacen que el músculo crezca. Este área de dolor divide al campeón de alguien que no lo es.",
    "Si quieres convertirte en un campeón, no puedes dejar que la duda te detenga. Tienes que ir a por todas.",
    "La fuerza no viene de ganar. Tus luchas desarrollan tus fortalezas. Cuando pasas por dificultades y decides no rendirte, eso es fuerza.",
    "Resiste el dolor, supera el obstáculo y verás los resultados.",
    "No puedes subir la escalera del éxito con las manos en los bolsillos.",
    "Todos tienen compasión por los débiles; la envidia hay que ganársela.",
    "El entrenamiento nos da una salida para las energías reprimidas, tonificando el espíritu tanto como el cuerpo.",
    "Visualiza tu meta. Si ves el resultado final en tu mente, tu cuerpo encontrará la forma de llegar allí.",
    "No le tengas miedo al fracaso. El fracaso no es lo opuesto al éxito, es parte del proceso hacia la victoria."),
  ...qs('Ronnie Coleman',
    "Todo el mundo quiere ser culturista, pero nadie quiere levantar pesos pesados.",
    "No hay nada que no pueda mover si pongo mi mente en ello. ¡Yeah buddy!",
    "Tienes que entrenar más duro que ayer si quieres resultados distintos mañana.",
    "El dolor es solo una sensación temporal, pero la gloria de haberlo dado todo dura para siempre.",
    "No hay secretos para el éxito. Es el resultado de la preparación, el trabajo duro y aprender de los errores.",
    "Si no estás dando el 100% en cada repetición, le estás regalando tu lugar a alguien más.",
    "Cuando sientes que no puedes dar un paso más, ahí es exactamente donde empieza el verdadero progreso.",
    "La disciplina es hacer lo que tienes que hacer, incluso cuando no tienes ganas de hacerlo.",
    "Mantenlo simple: come limpio, entrena pesado y sé constante día tras día.",
    "El trabajo duro siempre supera al talento cuando el talento no trabaja duro."),
  ...qs('Jay Cutler',
    "No entreno para ser el segundo mejor. Entreno para ser el mejor en lo que hago.",
    "La consistencia es la clave real. Puedes tener el mejor plan del mundo, pero sin constancia no vale nada.",
    "La diferencia entre lo imposible y lo posible reside en la determinación de una persona.",
    "Superar las derrotas y aprender de ellas es lo que te define como un verdadero campeón.",
    "No busques atajos. Los resultados duraderos requieren sacrificio y rutina diaria.",
    "Haz que cada día cuente. Un entrenamiento desperdiciado es una oportunidad de crecimiento perdida.",
    "Cuando la gente duda de ti, usa esa duda como combustible para entrenar aún más fuerte.",
    "El éxito en el gimnasio no se mide en horas, sino en la intensidad que pones en cada segundo.",
    "Construir un gran cuerpo es como construir un edificio: necesita bases sólidas y mucha paciencia.",
    "Si no te desafía, no te transforma."),
  ...qs('Dorian Yates',
    "Entreno hasta el fallo absoluto porque ahí es donde ocurre la adaptación del cuerpo.",
    "No vengo al gimnasio a socializar. Vengo a trabajar, darlo todo e irme a casa a recuperarme.",
    "La intensidad en el entrenamiento no es una opción; es la regla si quieres llegar a la cima.",
    "La mente debe ser siempre más fuerte que la incomodidad del músculo que arde.",
    "La preparación silenciosa produce los resultados más ruidosos.",
    "Si estás haciendo exactamente lo mismo que los demás, obtendrás los mismos resultados que los demás.",
    "La verdadera disciplina se demuestra en la oscuridad, cuando nadie te está mirando.",
    "Esto no es solo un deporte de un par de horas; es un estilo de vida de 24 horas al día."),
  ...qs('Phil Heath',
    "Cree en tu potencial incluso cuando absolutamente nadie más pueda verlo.",
    "Para ser un campeón, debes pensar y actuar como un campeón mucho antes de obtener el título.",
    "El trabajo que realizas en la sombra es lo que te hace brillar bajo las luces del escenario.",
    "Cada repetición te acerca o te aleja de tu objetivo. Elige sabiamente en cada serie.",
    "No dejes que los aplausos te suban a la cabeza ni que las críticas te derrumben.",
    "La grandeza no se regala a nadie, se gana a diario con sudor y sacrificio.",
    "Tu único competidor real es la persona que ves reflejada en el espejo cada mañana."),
  ...qs('Lee Haney',
    "Estimula el músculo, no lo aniquiles.",
    "El éxito se construye con el equilibrio perfecto entre el esfuerzo en el gimnasio y la sabiduría de la recuperación.",
    "La actitud con la que entras al gimnasio determina los resultados que te llevas a casa.",
    "Para durar en la cima, debes aprender a escuchar a tu cuerpo tanto como le exiges.",
    "Sé la versión más fuerte y disciplinada de ti mismo en cada jornada."),
  ...qs('Franco Columbu', "Si tienes una visión clara de lo que quieres lograr, ningún peso será demasiado pesado."),
  ...qs('Frank Zane', "La simetría, la proporción y el control mental son tan importantes como la fuerza bruta."),
  ...qs('Franco Columbu', "El fracaso es solo un estado mental temporal hasta que decides volver a levantarte."),
  ...qs('Frank Zane', "Define tus metas, mantén el enfoque y elimina cualquier distracción que no te acerque a ellas."),
  ...qs('Sergio Oliva', "Nunca permitas que el cansancio físico venza a tu pasión interior."),
  ...qs('Dexter Jackson', "La longevidad en el éxito proviene de una disciplina inquebrantable y el respeto absoluto al proceso."),
  ...qs('Mamdouh “Big Ramy” Elssbiay', "No importa de dónde vengas; si trabajas más duro que nadie, puedes llegar a la cima del mundo."),
  ...qs('Hadi Choopan', "La lucha diaria no es contra las pesas del gimnasio, es contra tus propios límites mentales."),
  ...qs('Derek Lunsford', "Cuando combinas fe, trabajo duro y perseverancia, nada en esta vida es imposible."),
  ...qs('Chris Bumstead', "No sueñes únicamente con la victoria; entrena duro cada día para hacer de la victoria una consecuencia inevitable.")
];
let quoteTimer = 0, quoteDone = false;
const quoteTxt = q => '“' + q.q + '”';
// Orden aleatorio fijo (semilla): recorre las 60 frases sin repetir y cambia a medianoche.
function quoteOfDay() {
  const n = new Date(), day = Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 864e5);
  const idx = QUOTES.map((_, i) => i); let s = 20260611;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return QUOTES[idx[day % QUOTES.length]];
}
function quoteCard() {
  const q = quoteOfDay(), t = quoteTxt(q);
  return `<div class="card b-quote" id="quote-card">
    <p class="q-text"><span id="q-on">${quoteDone ? esc(t) : ''}</span><span class="q-caret" id="q-caret"${quoteDone ? ' hidden' : ''}></span><span id="q-off">${quoteDone ? '' : esc(t)}</span></p>
    <div class="q-author${quoteDone ? ' show' : ''}" id="q-author">— ${esc(q.a)}</div></div>`;
}
function quoteFinish() {
  quoteDone = true;
  const c = $('#q-caret'), a = $('#q-author');
  if (c) c.hidden = true;
  if (a) a.classList.add('show');
}
function startQuote() {
  clearTimeout(quoteTimer);
  if (quoteDone) return;
  const txt = quoteTxt(quoteOfDay());
  if (!$('#q-on')) return;
  if (REDUCED) { $('#q-on').textContent = txt; $('#q-off').textContent = ''; quoteFinish(); return; }
  let i = 0;
  const step = () => {
    const on = $('#q-on'), off = $('#q-off');
    if (!on) { quoteDone = true; return; }       // el usuario salió de Inicio: no repetir la animación
    i++; on.textContent = txt.slice(0, i); off.textContent = txt.slice(i);
    if (i >= txt.length) { quoteTimer = setTimeout(quoteFinish, 350); return; }
    const ch = txt[i - 1];
    quoteTimer = setTimeout(step, ',;:'.includes(ch) ? 170 : '.!?'.includes(ch) ? 260 : ch === ' ' ? 40 : 22 + Math.random() * 22);
  };
  quoteTimer = setTimeout(step, 500);
}

/* ===== Base de ejercicios del usuario (empieza vacía) ===== */
const MUSCLE_OPTS = [
  { k: 'pecho', l: 'Pecho' }, { k: 'espalda', l: 'Espalda' }, { k: 'hombros', l: 'Hombros' },
  { k: 'biceps', l: 'Bíceps' }, { k: 'triceps', l: 'Tríceps' }, { k: 'piernas', l: 'Piernas' }, { k: 'abdomen', l: 'Core' }
];
const MO = Object.fromEntries(MUSCLE_OPTS.map(m => [m.k, m.l]));
const toGroup = k => (k === 'biceps' || k === 'triceps') ? 'brazos' : k;
function buildRec(name, pri, sec) {
  const primary = [...new Set(pri.map(toGroup))];
  const secondary = [...new Set(sec.map(toGroup))].filter(k => !primary.includes(k));
  const arms = a => new Set(a.filter(x => x === 'biceps' || x === 'triceps'));
  let ar = arms(pri); if (!ar.size) ar = arms(sec);
  const rec = { name, cat: primary[0] || '', primary, secondary, ui: { p: [...pri], s: sec.filter(k => !pri.includes(k)) } };
  if (ar.size === 1) rec.arm = ar.has('triceps') ? 'tri' : 'bi'; else if (ar.size === 2) rec.arm = 'both';
  return rec;
}
function uiOf(e) {
  if (e.ui) return e.ui;
  const exp = list => (list || []).flatMap(k => k === 'brazos' ? (e.arm === 'tri' ? ['triceps'] : e.arm === 'bi' ? ['biceps'] : ['biceps', 'triceps']) : (MO[k] ? [k] : []));
  const p = exp(e.primary);
  return { p, s: exp(e.secondary).filter(k => !p.includes(k)) };
}
const exTags = e => {
  const u = uiOf(e);
  const t = [...u.p.map(k => `<span class="mtag p">${MO[k]}</span>`), ...u.s.map(k => `<span class="mtag s">${MO[k]}</span>`)].join('');
  return t || '<span class="mtag s">Sin clasificar</span>';
};
const hasKey = (n, k) => n === k || n.startsWith(k) || n.includes(' ' + k);
// Solo para migrar datos antiguos: clasifica por palabras clave los ejercicios que ya existían en tu historial.
function guessRec(name) {
  const n = norm(name);
  if (n.length < 3) return null;
  for (const [cat, keys] of DETECT_RULES) {
    if (!keys.some(k => hasKey(n, k))) continue;
    const arm = cat === 'brazos' ? armOf(n) : null;
    const pri = cat === 'brazos' ? (arm === 'tri' ? ['triceps'] : arm === 'bi' ? ['biceps'] : ['biceps', 'triceps']) : [cat];
    const sec = [];
    if (cat === 'pecho' && /press|banca|bench|fondos/.test(n)) sec.push('hombros', 'triceps');
    else if (cat === 'hombros' && /press|militar|arnold/.test(n)) sec.push('triceps');
    else if (cat === 'espalda' && /remo|row|dominada|jalon|pull/.test(n)) sec.push('biceps');
    return buildRec(name, pri, sec);
  }
  return null;
}
// Una sola vez: todo ejercicio que ya aparece en tu historial/rutinas pasa a tu base.
function migrateDB() {
  S.customEx = (S.customEx || []).filter(e => e && e.name);
  if (S.dbMigrated) return;
  S.dbMigrated = true;
  const names = [];
  S.logs.forEach(l => (l.entries || []).forEach(e => names.push(e.name)));
  Object.values(S.plan).forEach(d => ((d && d.exercises) || []).forEach(e => names.push(e.name)));
  if (ss) ss.entries.forEach(e => names.push(e.name));
  names.forEach(nm => {
    if (!nm || findEx(nm)) return;
    const g = guessRec(nm) || { name: nm, cat: '', primary: [], secondary: [], ui: { p: [], s: [] } };
    g.name = nm; S.customEx.push(g);
  });
  saveLogs();
}
migrateDB();

/* Estado compartido de Estadísticas y modales */
const OV = [
  { k: 'w', l: 'Entrenos', c: '#58C497' },
  { k: 'vol', l: 'Levantado', c: '#B48AE0' },
  { k: 'reps', l: 'Reps', c: '#6FA8E8' },
  { k: 'sets', l: 'Series', c: '#E8A15A' },
  { k: 'max', l: 'Más pesado', c: '#E56F6F' },
  { k: 'secs', l: 'Tiempo', c: '#D9BE5A' }
];
const OV_RANGES = [{ d: 30, l: 'Últimos 30 días' }, { d: 90, l: 'Últimos 90 días' }, { d: 180, l: 'Últimos 6 meses' }, { d: 365, l: 'Último año' }, { d: 0, l: 'Todo el tiempo' }];
const XP_RANGES = [{ d: 90, l: '3M' }, { d: 180, l: '6M' }, { d: 365, l: '1A' }, { d: 0, l: 'Todo' }];
const GOAL_COLORS = ['#E8A15A', '#E56F6F', '#58C497', '#6FA8E8', '#B48AE0', '#D9BE5A'];
let ovRange = 90, xpName = null, xpRange = 180, goalEdit = -1;
const ovHidden = new Set();
const CH = {};
let xm = { ctx: 'day', editName: null, pri: [], sec: [] };

/* ===== Navegación ===== */
function show(name) {
  if (!VIEWS.includes(name)) name = 'home';
  if (name !== 'programs' && openDayKey) closeDay();
  if (exName) closeExProgress(true);
  if (name === 'train' && !document.body.classList.contains('in-train')) trainIn = true;
  document.body.classList.toggle('in-train', name === 'train');
  $$('.view').forEach(v => (v.hidden = v.dataset.view !== name));
  $$('.nav-btn').forEach(b => {     const on = b.dataset.go === name;     b.classList.toggle('active', on);     if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');   });   document.getElementById('views').scrollTop = 0;   if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);   if (name === 'programs') { weekIn = true; renderWeek(); }   if (name === 'home') { renderHome(); playBrand(); }   if (name === 'train') renderTrain();   if (name === 'stats') renderStats();   if (name === 'profile') renderProfile(); }  $$
('.nav-btn').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.go === 'train' && !ss) openStartModal();
  else show(b.dataset.go);
}));
addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if (h === 'train' && !ss) openStartModal();
  else show(h);
});
buildBrand();
show(location.hash.slice(1) || 'home');

if ('serviceWorker' in navigator)
  addEventListener('load', () => {});
