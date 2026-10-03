// ===== STORAGE.JS - Manejo de datos locales =====
const Storage = {
  KEY: 'gymtracker_data_v1',

  // Estructura por defecto
  defaultData() {
    return {
      sessions: [],       // [{ id, date, exercises: [{ name, muscle, sets: [{reps, weight}] }] }]
      routines: {},       // { "lunes": ["Press banca", ...], ... }  (opcional)
      settings: {
        weightUnit: 'kg'
      }
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.defaultData();
      return { ...this.defaultData(), ...JSON.parse(raw) };
    } catch (e) {
      console.error('Error cargando datos', e);
      return this.defaultData();
    }
  },

  save(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Error guardando datos', e);
      return false;
    }
  },

  // --- Sesiones ---
  getSessions() {
    return this.load().sessions;
  },

  addSession(session) {
    const data = this.load();
    session.id = Date.now().toString();
    data.sessions.unshift(session); // más reciente primero
    this.save(data);
    return session;
  },

  updateSession(id, updated) {
    const data = this.load();
    const idx = data.sessions.findIndex(s => s.id === id);
    if (idx !== -1) {
      data.sessions[idx] = { ...data.sessions[idx], ...updated };
      this.save(data);
    }
  },

  getSessionByDate(dateStr) {
    return this.load().sessions.find(s => s.date === dateStr);
  },

  getAllDates() {
    return this.load().sessions.map(s => s.date);
  },

  // --- Helpers de progreso ---
  getExerciseHistory(exerciseName) {
    const sessions = this.getSessions();
    const history = [];
    sessions.forEach(s => {
      s.exercises.forEach(ex => {
        if (ex.name.toLowerCase() === exerciseName.toLowerCase()) {
          const maxWeight = Math.max(...ex.sets.map(set => set.weight || 0));
          const totalVolume = ex.sets.reduce((acc, set) => acc + (set.reps * set.weight), 0);
          history.push({
            date: s.date,
            maxWeight,
            totalVolume,
            sets: ex.sets
          });
        }
      });
    });
    // Ordenar por fecha ascendente
    return history.sort((a, b) => a.date.localeCompare(b.date));
  },

  getMuscleVolume() {
    const sessions = this.getSessions();
    const volume = {};
    sessions.forEach(s => {
      s.exercises.forEach(ex => {
        const muscle = ex.muscle || 'otros';
        const vol = ex.sets.reduce((acc, set) => acc + (set.reps * (set.weight || 0)), 0);
        volume[muscle] = (volume[muscle] || 0) + vol;
      });
    });
    return volume;
  },

  getAllExerciseNames() {
    const set = new Set();
    this.getSessions().forEach(s => {
      s.exercises.forEach(ex => set.add(ex.name));
    });
    return Array.from(set).sort();
  },

  // Limpiar todo (útil para testing)
  clear() {
    localStorage.removeItem(this.KEY);
  }
};
