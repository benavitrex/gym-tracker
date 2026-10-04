/* --- STATE & STORE --- */
const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

let state = {
  routines: JSON.parse(localStorage.getItem('gt_routines')) || {
    "Lunes": ["Press de banca plano", "Aperturas con mancuerna"],
    "Martes": ["Dominadas", "Remo con barra"],
    "Miércoles": ["Sentadilla profunda", "Prensa 45"],
    "Jueves": ["Press militar", "Elevaciones laterales"],
    "Viernes": ["Curl de bíceps", "Tríceps polea"],
    "Sábado": [],
    "Domingo": []
  },
  // Histórico de entrenamientos completados: [{ date: 'YYYY-MM-DD', ex: 'Nombre', maxWeight: 80 }]
  history: JSON.parse(localStorage.getItem('gt_history')) || [],
  activeSession: JSON.parse(localStorage.getItem('gt_session')) || null,
  selectedDay: null,
  selectedExForDetail: null
};

function saveState() {
  localStorage.setItem('gt_routines', JSON.stringify(state.routines));
  localStorage.setItem('gt_history', JSON.stringify(state.history));
  localStorage.setItem('gt_session', JSON.stringify(state.activeSession));
}

function vibrate() {
  if (navigator.vibrate) navigator.vibrate(12);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

/* --- NAVIGATION & VIEWS --- */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    vibrate();
    const view = btn.dataset.go;
    showView(view);
  });
});

function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.hidden = true);
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  const target = document.querySelector(`.view[data-view="${viewName}"]`);
  if (target) target.hidden = false;
  
  const activeBtn = document.querySelector(`.nav-btn[data-go="${viewName}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  if (viewName === 'programs') renderProgramsWeek();
  if (viewName === 'home') renderHome();
  if (viewName === 'stats') renderStats();
}

/* --- RENDER PROGRAMAS (DÍAS DE LA SEMANA) --- */
function renderProgramsWeek() {
  const container = document.getElementById('programs-week-list');
  const todayIdx = (new Date().getDay() + 6) % 7; // 0: Lunes
  
  container.innerHTML = DAYS.map((day, idx) => {
    const list = state.routines[day] || [];
    const isToday = idx === todayIdx;
    const preview = list.length > 0 ? `${list.length} ejercicios (${list.slice(0, 2).join(', ')}${list.length > 2 ? '...' : ''})` : 'Descanso / Sin programar';
    
    return `
      <div class="day-card ${isToday ? 'is-today' : ''}" onclick="openDayDetail('${day}', ${isToday})">
        <div class="day-card-info">
          <div class="day-title">
            ${day} ${isToday ? '<span class="badge-today">HOY</span>' : ''}
          </div>
          <p class="day-preview-sub">${preview}</p>
        </div>
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    `;
  }).join('');
}

/* --- SUBPANTALLA: DETALLE DE DÍA (PUSH) --- */
function openDayDetail(day, isToday) {
  vibrate();
  state.selectedDay = day;
  document.getElementById('day-detail-title').textContent = day;
  document.getElementById('day-today-badge').hidden = !isToday;
  
  renderDayExercises();
  document.getElementById('day-detail-screen').classList.add('active');
}

function closeDayDetail() {
  vibrate();
  document.getElementById('day-detail-screen').classList.remove('active');
}

function renderDayExercises() {
  const container = document.getElementById('day-exercises-container');
  const list = state.routines[state.selectedDay] || [];
  
  if (list.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding: 20px 0;">No hay ejercicios en este día.</p>`;
    return;
  }

  container.innerHTML = list.map((exName, idx) => `
    <div class="ex-item-card" onclick="openExDetail('${exName}')">
      <div>
        <div class="ex-name">${exName}</div>
        <span class="ex-tag">${detectMuscleGroup(exName).toUpperCase()}</span>
      </div>
      <button onclick="event.stopPropagation(); removeExFromDay(${idx})" style="background:none; border:none; color:var(--danger); font-size:1.2rem; cursor:pointer;">&times;</button>
    </div>
  `).join('');
}

function removeExFromDay(index) {
  vibrate();
  state.routines[state.selectedDay].splice(index, 1);
  saveState();
  renderDayExercises();
  renderProgramsWeek();
}

/* --- MODAL AÑADIR EJERCICIO A MANO --- */
function openAddExerciseModal() {
  vibrate();
  document.getElementById('manual-ex-name').value = '';
  document.getElementById('add-ex-modal').hidden = false;
}

function closeAddExerciseModal() {
  document.getElementById('add-ex-modal').hidden = true;
}

function saveManualExercise() {
  const name = document.getElementById('manual-ex-name').value.trim();
  if (!name) return showToast('Escribe un nombre para el ejercicio');

  if (!state.routines[state.selectedDay]) {
    state.routines[state.selectedDay] = [];
  }

  state.routines[state.selectedDay].push(name);
  saveState();
  closeAddExerciseModal();
  renderDayExercises();
  renderProgramsWeek();
  showToast('Ejercicio añadido');
}

/* --- DETALLE DE EJERCICIO (GRÁFICO DE LÍNEAS + NOTION CALENDAR) --- */
function openExDetail(exName) {
  vibrate();
  state.selectedExForDetail = exName;
  document.getElementById('ex-detail-name').textContent = exName;
  
  renderExChart(exName);
  renderNotionCalendar(exName);
  
  document.getElementById('ex-detail-screen').classList.add('active');
}

function closeExDetail() {
  vibrate();
  document.getElementById('ex-detail-screen').classList.remove('active');
}

function renderExChart(exName) {
  const container = document.getElementById('chart-container');
  // Filtrar histórico del ejercicio
  const exLogs = state.history.filter(h => h.ex.toLowerCase() === exName.toLowerCase());
  
  const maxPR = exLogs.length > 0 ? Math.max(...exLogs.map(l => l.maxWeight)) : 0;
  document.getElementById('ex-pr-value').textContent = `PR: ${maxPR} kg`;

  if (exLogs.length < 2) {
    // Si hay menos de 2 registros, mostrar gráfico demo/guía
    const dummyData = [0, maxPR * 0.5 || 20, maxPR * 0.8 || 40, maxPR || 60];
    container.innerHTML = generateBezierSVG(dummyData, ["Inicio", "Sesión 1", "Sesión 2", "Hoy"]);
    return;
  }

  const weights = exLogs.map(l => l.maxWeight);
  const labels = exLogs.map(l => l.date.slice(5));
  container.innerHTML = generateBezierSVG(weights, labels);
}

// Generador de SVG gráfico de líneas suaves (Bezier)
function generateBezierSVG(data, labels) {
  const w = 320, h = 150, padding = 25;
  const maxVal = Math.max(...data, 10);
  const minVal = 0;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * (w - padding * 2);
    const y = h - padding - ((val - minVal) / (maxVal - minVal)) * (h - padding * 2);
    return { x, y, val };
  });

  // Generar path d con curvas Bezier
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) / 2;
    const cp2x = cp1x;
    pathD += ` C ${cp1x} ${p0.y}, ${cp2x} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  const dots = points.map(p => `
    <circle cx="${p.x}" cy="${p.y}" r="4" fill="#007AFF" />
    <text x="${p.x}" y="${p.y - 8}" fill="#FFF" font-size="10" text-anchor="middle">${p.val}kg</text>
  `).join('');

  return `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:100%;">
      <!-- Lineas horizontales de guía -->
      <line x1="${padding}" y1="${padding}" x2="${w-padding}" y2="${padding}" stroke="#24242A" stroke-dasharray="3,3"/>
      <line x1="${padding}" y1="${h/2}" x2="${w-padding}" y2="${h/2}" stroke="#24242A" stroke-dasharray="3,3"/>
      <line x1="${padding}" y1="${h-padding}" x2="${w-padding}" y2="${h-padding}" stroke="#24242A"/>
      
      <!-- Curva -->
      <path d="${pathD}" fill="none" stroke="#007AFF" stroke-width="3" />
      ${dots}
    </svg>
  `;
}

/* --- CALENDARIO ESTILO NOTION --- */
function renderNotionCalendar(exName) {
  const grid = document.getElementById('notion-calendar-grid');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7; // Ajuste Lunes = 0

  const exDates = state.history
    .filter(h => h.ex.toLowerCase() === exName.toLowerCase())
    .map(h => h.date);

  let cells = '';
  for (let i = 0; i < startOffset; i++) {
    cells += `<div class="notion-day-cell" style="opacity:0.2"></div>`;
  }

  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const done = exDates.includes(dateStr);

    cells += `
      <div class="notion-day-cell ${done ? 'done' : ''}">
        ${d}
        ${done ? '<div class="pr-dot"></div>' : ''}
      </div>
    `;
  }

  grid.innerHTML = cells;
}

/* --- AUTO-DETECCION DE MUSCULOS & BODY MAP --- */
const MUSCLE_RULES = {
  chest: ["press", "banca", "bench", "pecho", "aperturas", "cruces", "crossover"],
  back: ["dominada", "pull", "remo", "row", "jalon", "espalda", "dorsal", "lat"],
  legs: ["sentadilla", "squat", "prensa", "estocada", "cuadriceps", "isquio", "peso muerto"],
  shoulders: ["militar", "hombro", "shoulder", "lateral", "pajaro", "deltoides"],
  biceps: ["biceps", "curl", "martillo"],
  triceps: ["triceps", "polea", "copa", "fondos", "french"]
};

function detectMuscleGroup(name) {
  const clean = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [group, keywords] of Object.entries(MUSCLE_RULES)) {
    if (keywords.some(kw => clean.includes(kw))) return group;
  }
  return "General";
}

/* --- ENTRENAMIENTO EN CURSO (MODO TRAIN) --- */
function startWorkout() {
  const todayName = DAYS[(new Date().getDay() + 6) % 7];
  const todayExs = state.routines[todayName] || [];
  
  state.activeSession = {
    day: todayName,
    exercises: todayExs.map(ex => ({
      name: ex,
      sets: [{ weight: 0, reps: 0, done: false }]
    })),
    startTime: Date.now()
  };
  saveState();
  renderTrainingView();
  showView('train');
}

function renderTrainingView() {
  const root = document.getElementById('train-root');
  if (!state.activeSession) return;

  const currentEx = state.activeSession.exercises[0] || { name: 'Ejercicio' };
  const muscleGroup = detectMuscleGroup(currentEx.name);

  root.innerHTML = `
    <div class="train-header">
      <h2>Entrenando: ${state.activeSession.day}</h2>
      <button class="btn" onclick="finishWorkout()" style="background:var(--success)">Terminar</button>
    </div>

    <!-- Body Map SVG Interactivo -->
    <div class="body-map-wrap">
      <svg class="body-map-svg" viewBox="0 0 100 200">
        <!-- Silueta Base -->
        <circle cx="50" cy="20" r="12" fill="#24242A"/>
        <!-- Torso / Pecho -->
        <path d="M 35 35 L 65 35 L 60 80 L 40 80 Z" fill="#24242A" class="${muscleGroup === 'chest' || muscleGroup === 'back' ? 'muscle-active' : ''}"/>
        <!-- Brazos -->
        <rect x="20" y="35" width="12" height="50" rx="6" fill="#24242A" class="${muscleGroup === 'biceps' || muscleGroup === 'triceps' ? 'muscle-active' : ''}"/>
        <rect x="68" y="35" width="12" height="50" rx="6" fill="#24242A" class="${muscleGroup === 'biceps' || muscleGroup === 'triceps' ? 'muscle-active' : ''}"/>
        <!-- Piernas -->
        <rect x="38" y="85" width="10" height="70" rx="5" fill="#24242A" class="${muscleGroup === 'legs' ? 'muscle-active' : ''}"/>
        <rect x="52" y="85" width="10" height="70" rx="5" fill="#24242A" class="${muscleGroup === 'legs' ? 'muscle-active' : ''}"/>
      </svg>
    </div>

    <h3>${currentEx.name} <span class="ex-tag">${muscleGroup.toUpperCase()}</span></h3>

    <table class="sets-table">
      <thead>
        <tr><th>SERIE</th><th>KG</th><th>REPES</th><th>COMPLETADO</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td><input class="inp" type="number" style="width:60px; text-align:center; margin:0;" value="60" id="set-w-0"></td>
          <td><input class="inp" type="number" style="width:60px; text-align:center; margin:0;" value="10" id="set-r-0"></td>
          <td><button class="set-check" onclick="toggleSetDone(this)">&check;</button></td>
        </tr>
      </tbody>
    </table>
  `;
}

function toggleSetDone(btn) {
  vibrate();
  btn.classList.toggle('done');
}

function finishWorkout() {
  vibrate();
  const todayStr = new Date().toISOString().split('T')[0];
  
  if (state.activeSession) {
    state.activeSession.exercises.forEach(e => {
      const w = parseFloat(document.getElementById('set-w-0')?.value) || 40;
      state.history.push({ date: todayStr, ex: e.name, maxWeight: w });
    });
  }

  state.activeSession = null;
  saveState();
  showToast('¡Entrenamiento guardado con éxito!');
  showView('home');
}

/* --- INICIO & STATS --- */
function renderHome() {
  const root = document.getElementById('home-root');
  root.innerHTML = `
    <div style="background:var(--card-bg); border:1px solid var(--card-border); border-radius:16px; padding:20px; text-align:center;">
      <h3>Comenzar rutina de hoy</h3>
      <p style="color:var(--text-muted)">Haz clic abajo para iniciar la sesión</p>
      <button class="btn" style="width:100%" onclick="startWorkout()">Empezar Entreno</button>
    </div>
  `;
}

function renderStats() {
  const root = document.getElementById('stats-root');
  root.innerHTML = `
    <div style="background:var(--card-bg); border:1px solid var(--card-border); border-radius:16px; padding:16px;">
      <h3>Total Sesiones Completadas</h3>
      <p font-size="2rem" font-weight="700">${state.history.length}</p>
    </div>
  `;
}

/* --- INIT --- */
showView('home');