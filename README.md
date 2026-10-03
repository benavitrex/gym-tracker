# GymTracker

App web progresiva (PWA) para registrar entrenamientos, planificar la semana, ver estadísticas y seguir el mapa muscular. Funciona offline y se puede instalar en el teléfono.

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `index.html` | App completa (UI + lógica) |
| `sw.js` | Service Worker (caché offline) |
| `manifest.json` | Manifest PWA |
| `icon-192.png` / `icon-512.png` | Iconos de instalación |
| `favicon.png` | Favicon del navegador |
| `.nojekyll` | Evita el procesado Jekyll en GitHub Pages |

Todo usa **rutas relativas** (`./`, `sw.js`, `manifest.json`) para que funcione en la raíz del repo o en un subpath de GitHub Pages.

## Probar en local

```bash
# Desde la carpeta del proyecto
npx --yes serve .
# o
python3 -m http.server 8080
```

Abre `http://localhost:3000` (o el puerto que indique) en el móvil o en Chrome.

## Publicar en GitHub Pages

### Opción A — Interfaz web de GitHub

1. Crea un repositorio nuevo (por ejemplo `gymtracker`).
2. Sube **todos** los archivos de esta carpeta a la rama `main` (Drag & drop en *Add file → Upload files*, o usa la opción B).
3. Ve a **Settings → Pages**.
4. En *Build and deployment*:
   - **Source:** Deploy from a branch
   - **Branch:** `main` / `/ (root)`
5. Guarda. En 1–2 minutos la app estará en:
   - `https://TU_USUARIO.github.io/gymtracker/`
   (si el repo se llama `gymtracker`)

### Opción B — Línea de comandos (Git)

```bash
# 1. Entra a la carpeta con los archivos
cd gymtracker   # o el nombre de tu carpeta

# 2. Inicializa Git (solo la primera vez)
git init
git add .
git commit -m "GymTracker PWA lista para GitHub Pages"

# 3. Crea el repo vacío en GitHub y enlázalo
git branch -M main
git remote add origin https://github.com/TU_USUARIO/gymtracker.git
git push -u origin main
```

Luego activa Pages como en el paso 3–5 de la opción A.

### Si usas un subpath (repo que no es `usuario.github.io`)

La app ya usa rutas relativas (`./`, `href="manifest.json"`). No hace falta cambiar nada: GitHub Pages la servirá correctamente en `/nombre-del-repo/`.

## Instalar como app en el teléfono

1. Abre la URL de GitHub Pages en **Chrome (Android)** o **Safari (iOS)**.
2. **Android:** menú ⋮ → *Instalar aplicación* / *Añadir a la pantalla de inicio*.
3. **iOS:** botón Compartir → *Añadir a pantalla de inicio*.
4. Se abre a pantalla completa (standalone), sin barra del navegador.

## Datos

Todo se guarda en el **localStorage** del navegador (rutinas, logs, temas, objetivos).  
En **Perfil** puedes exportar / importar un JSON de respaldo.

## Temas incluidos

- Dark OLED (por defecto)
- Dracula
- Rosé Pine
- Emerald

---

Hecho para usarse como PWA móvil. Si actualizas `index.html` o `sw.js`, sube de nuevo y, si hace falta, incrementa la versión del caché en `sw.js` (`gymtracker-vN`) para forzar la actualización en clientes ya instalados.
