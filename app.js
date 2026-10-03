'use strict';
const VIEWS = ['home', 'stats', 'train', 'programs', 'profile'];
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* Cambia de pestaña: muestra una vista y marca el botón activo */
function show(name) {
  if (!VIEWS.includes(name)) name = 'home';
  $$('.view').forEach(v => (v.hidden = v.dataset.view !== name));
  $$('.nav-btn').forEach(b => {
    const on = b.dataset.go === name;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  document.getElementById('views').scrollTop = 0;
  if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
}

/* Subpestañas de Programas: Rutinas / Ejercicios */
function showSeg(name) {
  $$('.seg button').forEach(b => {
    const on = b.dataset.seg === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  });
  $$('.panel').forEach(p => (p.hidden = p.dataset.panel !== name));
}

$$('.nav-btn').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));
$$('.seg button').forEach(b => b.addEventListener('click', () => showSeg(b.dataset.seg)));
addEventListener('hashchange', () => show(location.hash.slice(1)));
show(location.hash.slice(1));

if ('serviceWorker' in navigator)
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
