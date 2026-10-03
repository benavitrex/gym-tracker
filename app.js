// ===== APP.JS - Lógica principal de GymTracker =====

const App = {
  currentDate: new Date(),
  calendarDate: new Date(),
  tempSets: [],
  progressChart: null,
  muscleChart: null,
  editingSessionId: null,

  init() {
    this.renderTodayDate();
    this.bindNavigation();
    this.bindButtons();
    this.renderToday();
    this.renderCalendar();
    this.renderHistory();
    this.renderProgress();
    this.showToast('¡Bienvenido a GymTracker! Tus datos se guardan automáticamente.');
  },

  // ---------- NAVEGACIÓN ----------
  bindNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${view}`).classList.add('active');

        if (view === 'calendario') this.renderCalendar();
        if (view === 'historial') this.renderHistory();
        if (view === 'progreso') this.renderProgress();
      });
    });
  },

  bindButtons() {
    document.getElementById('btn-add-exercise').addEventListener('click', () => this.openModal());
    document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('btn-add-set').addEventListener('click', () => this.addSetRow());
    document.getElementById('btn-save-exercise').addEventListener('click', () => this.saveExercise());
    document.getElementById('btn-finish-session').addEventListener('click', () => this.finishSession());
    document.getElementById('prev-month').addEventListener('click', () => {
      this.calendarDate.setMonth(this.calendarDate.getMonth() - 1);
      this.renderCalendar();
    });
    document.getElementById('next-month').addEventListener('click', () => {
      this.calendarDate.setMonth(this.calendarDate.getMonth() + 1);
      this.renderCalendar();
    });
    document.getElementById('exercise-select').addEventListener('change', (e) => {
      this.updateProgressChart(e.target.value);
    });

    // Cerrar modal al hacer click fuera
    document.getElementById('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') this.closeModal();
    });
  },

  // ---------- HOY ----------
  renderTodayDate() {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const str = this.currentDate.toLocaleDateString('es-ES', options);
    document.getElementById('today-date').textContent = str.charAt(0).toUpperCase() + str.slice(1);
  },

  getTodayStr() {
    return this.formatDate(this.currentDate);
  },

  formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  renderToday() {
    const todayStr = this.getTodayStr();
    const session = Storage.getSessionByDate(todayStr);
    const statusEl = document.getElementById('today-status');
    const sessionCard = document.getElementById('session-card');
    const routineList = document.getElementById('today-routine');

    if (session) {
      statusEl.textContent = 'Entrenado ✓';
      statusEl.className = 'badge trained';
      sessionCard.style.display = 'block';
      this.renderSessionExercises(session);
    } else {
      statusEl.textContent = 'Sin entrenar';
      statusEl.className = 'badge';
      sessionCard.style.display = 'none';
      routineList.innerHTML = `
        <div class="empty-state">
          <span>💪</span>
          <p>Todavía no has registrado nada hoy.<br>¡Empieza añadiendo un ejercicio!</p>
        </div>`;
    }
  },

  renderSessionExercises(session) {
    const container = document.getElementById('session-exercises');
    if (!session.exercises.length) {
      container.innerHTML = '<p class="hint">No hay ejercicios aún</p>';
      return;
    }
    container.innerHTML = session.exercises.map(ex => {
      const setsStr = ex.sets.map(s => `${s.weight}kg × ${s.reps}`).join(' · ');
      return `
        <div class="exercise-item">
          <div class="info">
            <h4>${ex.name}</h4>
            <span>${ex.muscle || ''} · ${ex.sets.length} series</span>
          </div>
          <div class="sets-preview">${setsStr}</div>
        </div>`;
    }).join('');
  },

  // ---------- MODAL ----------
  openModal() {
    document.getElementById('modal').classList.remove('hidden');
    document.getElementById('input-exercise').value = '';
    document.getElementById('input-muscle').value = 'pecho';
    this.tempSets = [{ reps: 10, weight: 0 }];
    this.renderSetRows();
    document.getElementById('input-exercise').focus();
  },

  closeModal() {
    document.getElementById('modal').classList.add('hidden');
  },

  addSetRow() {
    this.tempSets.push({ reps: 10, weight: 0 });
    this.renderSetRows();
  },

  removeSetRow(index) {
    if (this.tempSets.length <= 1) return;
    this.tempSets.splice(index, 1);
    this.renderSetRows();
  },

  renderSetRows() {
    const container = document.getElementById('sets-container');
    container.innerHTML = this.tempSets.map((set, i) => `
      <div class="set-row">
        <span>${i + 1}</span>
        <input type="number" inputmode="decimal" placeholder="Peso" value="${set.weight || ''}" 
               data-index="${i}" data-field="weight" class="set-input">
        <input type="number" inputmode="numeric" placeholder="Reps" value="${set.reps || ''}" 
               data-index="${i}" data-field="reps" class="set-input">
        <button class="icon-btn" onclick="App.removeSetRow(${i})" title="Eliminar">🗑️</button>
      </div>
    `).join('');

    // Bind inputs
    container.querySelectorAll('.set-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        const field = e.target.dataset.field;
        this.tempSets[idx][field] = parseFloat(e.target.value) || 0;
      });
    });
  },

  saveExercise() {
    const name = document.getElementById('input-exercise').value.trim();
    const muscle = document.getElementById('input-muscle').value;

    if (!name) {
      this.showToast('Escribe el nombre del ejercicio');
      return;
    }

    // Validar series
    const validSets = this.tempSets.filter(s => s.reps > 0);
    if (validSets.length === 0) {
      this.showToast('Añade al menos una serie con repeticiones');
      return;
    }

    const todayStr = this.getTodayStr();
    let session = Storage.getSessionByDate(todayStr);

    const exercise = {
      name,
      muscle,
      sets: validSets
    };

    if (session) {
      // Añadir a sesión existente
      session.exercises.push(exercise);
      Storage.updateSession(session.id, session);
    } else {
      // Crear nueva sesión
      session = {
        date: todayStr,
        exercises: [exercise],
        completed: false
      };
      Storage.addSession(session);
    }

    this.closeModal();
    this.renderToday();
    this.renderHistory();
    this.renderProgress();
    this.showToast(`✓ ${name} guardado`);
  },

  finishSession() {
    const todayStr = this.getTodayStr();
    const session = Storage.getSessionByDate(todayStr);
    if (session) {
      session.completed = true;
      Storage.updateSession(session.id, session);
      this.showToast('¡Entrenamiento finalizado! 🔥');
      this.renderToday();
      this.renderCalendar();
    }
  },

  // ---------- CALENDARIO ----------
  renderCalendar() {
    const year = this.calendarDate.getFullYear();
    const month = this.calendarDate.getMonth();
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    document.getElementById('calendar-month').textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay(); // 0 = domingo
    const daysInMonth = lastDay.getDate();

    const trainedDates = new Set(Storage.getAllDates());
    const todayStr = this.getTodayStr();

    const grid = document.getElementById('calendar-grid');
    const dayNames = ['D','L','M','X','J','V','S'];
    let html = dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join('');

    // Días del mes anterior (para rellenar)
    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      html += `<div class="cal-day other-month">${prevMonthLast - i}</div>`;
    }

    // Días del mes actual
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      let classes = 'cal-day';
      if (dateStr === todayStr) classes += ' today';
      if (trainedDates.has(dateStr)) classes += ' trained';

      html += `<div class="${classes}" data-date="${dateStr}">${d}</div>`;
    }

    // Rellenar el resto
    const totalCells = startDay + daysInMonth;
    const remaining = 7 - (totalCells % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        html += `<div class="cal-day other-month">${i}</div>`;
      }
    }

    grid.innerHTML = html;

    // Click en día
    grid.querySelectorAll('.cal-day:not(.other-month)').forEach(el => {
      el.addEventListener('click', () => this.showDayDetail(el.dataset.date));
    });
  },

  showDayDetail(dateStr) {
    const session = Storage.getSessionByDate(dateStr);
    const detail = document.getElementById('day-detail');
    const title = document.getElementById('day-detail-title');
    const content = document.getElementById('day-detail-content');

    const d = new Date(dateStr + 'T12:00:00');
    title.textContent = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    if (!session) {
      content.innerHTML = '<p class="hint">No hay entrenamiento registrado este día.</p>';
    } else {
      content.innerHTML = session.exercises.map(ex => {
        const sets = ex.sets.map(s => `${s.weight}kg × ${s.reps}`).join(', ');
        return `<div class="exercise-item" style="margin-bottom:8px">
          <div class="info"><h4>${ex.name}</h4><span>${ex.muscle}</span></div>
          <div class="sets-preview">${sets}</div>
        </div>`;
      }).join('');
    }
    detail.style.display = 'block';
  },

  // ---------- HISTORIAL ----------
  renderHistory() {
    const list = document.getElementById('history-list');
    const sessions = Storage.getSessions();

    if (sessions.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <span>📋</span>
          <p>Aún no hay entrenamientos guardados.</p>
        </div>`;
      return;
    }

    list.innerHTML = sessions.map(s => {
      const d = new Date(s.date + 'T12:00:00');
      const dateStr = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
      const totalSets = s.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
      const muscles = [...new Set(s.exercises.map(ex => ex.muscle))].join(', ');
      return `
        <div class="history-item" onclick="App.showDayDetail('${s.date}')">
          <div class="date">${dateStr}</div>
          <div class="summary">${s.exercises.length} ejercicios · ${totalSets} series · ${muscles}</div>
        </div>`;
    }).join('');
  },

  // ---------- PROGRESO ----------
  renderProgress() {
    const select = document.getElementById('exercise-select');
    const names = Storage.getAllExerciseNames();
    const current = select.value;

    select.innerHTML = '<option value="">Selecciona un ejercicio</option>' +
      names.map(n => `<option value="${n}" ${n === current ? 'selected' : ''}>${n}</option>`).join('');

    if (current) this.updateProgressChart(current);
    else if (names.length) {
      select.value = names[0];
      this.updateProgressChart(names[0]);
    }

    this.updateMuscleChart();
    this.updateMuscleStats();
  },

  updateProgressChart(exerciseName) {
    const history = Storage.getExerciseHistory(exerciseName);
    const ctx = document.getElementById('progress-chart').getContext('2d');

    if (this.progressChart) this.progressChart.destroy();

    if (history.length === 0) {
      this.progressChart = null;
      return;
    }

    this.progressChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: history.map(h => {
          const d = new Date(h.date + 'T12:00:00');
          return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        }),
        datasets: [{
          label: 'Peso máximo (kg)',
          data: history.map(h => h.maxWeight),
          borderColor: '#22d3ee',
          backgroundColor: 'rgba(34,211,238,0.15)',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointBackgroundColor: '#22d3ee'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: false,
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });
  },

  updateMuscleChart() {
    const volume = Storage.getMuscleVolume();
    const labels = Object.keys(volume);
    const data = Object.values(volume);
    const ctx = document.getElementById('muscle-chart').getContext('2d');

    if (this.muscleChart) this.muscleChart.destroy();

    if (labels.length === 0) return;

    const colors = ['#22d3ee','#a78bfa','#4ade80','#fbbf24','#f87171','#fb923c','#38bdf8','#e879f9'];

    this.muscleChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', padding: 12, font: { size: 11 } }
          }
        }
      }
    });
  },

  updateMuscleStats() {
    const volume = Storage.getMuscleVolume();
    const container = document.getElementById('muscle-stats');
    const sorted = Object.entries(volume).sort((a,b) => b[1] - a[1]);

    if (sorted.length === 0) {
      container.innerHTML = '<p class="hint">Entrena para ver estadísticas</p>';
      return;
    }

    container.innerHTML = sorted.map(([muscle, vol]) =>
      `<span class="muscle-tag">${muscle}: ${Math.round(vol)} kg</span>`
    ).join('');
  },

  // ---------- TOAST ----------
  showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.add('hidden'), 2800);
  }
};

// Arrancar la app
document.addEventListener('DOMContentLoaded', () => App.init());
