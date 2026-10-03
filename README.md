# GymTracker – Esqueleto funcional

https://benavitrex.github.io/gym-tracker/#profile

App de seguimiento de gimnasio lista para usar en el celular.

## Cómo probarla YA

### Opción 1 – Desde el celular (recomendado)
1. Sube la carpeta `gymtracker` a **GitHub**.
2. Activa **GitHub Pages** (Settings → Pages → Source: main branch).
3. Abre la URL que te dan en el navegador del celular (Chrome o Safari).
4. En Chrome: menú → **“Añadir a pantalla de inicio”**.  
   En Safari (iPhone): Compartir → **“Añadir a pantalla de inicio”**.

### Opción 2 – Local
1. Abre la carpeta con **Live Server** en VS Code (o cualquier servidor local).
2. Abre la URL en el navegador del celular (misma red WiFi) o en el PC.

## Qué incluye este esqueleto

- **Hoy**: Ver el día actual + añadir ejercicios con series, peso y repeticiones.
- **Calendario**: Vista mensual. Los días entrenados se marcan en verde. Toca un día para ver el detalle.
- **Historial**: Lista de todos los entrenamientos guardados.
- **Progreso**:
  - Gráfico de evolución de peso máximo por ejercicio.
  - Gráfico de volumen por grupo muscular.
  - Estadísticas de músculos más trabajados.
- **Guardado automático**: Todo se guarda en el `localStorage` del navegador (no se pierde al cerrar).
- **PWA**: Se puede instalar como app y funciona offline (después de la primera visita).

## Estructura de datos

Cada sesión se guarda así:

```json
{
  "id": "1727...",
  "date": "2026-10-03",
  "completed": true,
  "exercises": [
    {
      "name": "Press banca",
      "muscle": "pecho",
      "sets": [
        { "reps": 10, "weight": 60 },
        { "reps": 8, "weight": 70 }
      ]
    }
  ]
}
```

## Próximos pasos posibles

- Mapa del cuerpo interactivo (SVG coloreado).
- Rutinas predefinidas por día de la semana.
- Notificaciones (“Hoy te toca pierna”).
- Sincronización con Firebase (para varios dispositivos).
- Exportar datos a CSV / Excel.
- Temporizador de descanso entre series.

## Notas

- Los datos están solo en **ese navegador**. Si limpias datos del navegador se borran.
- Para sincronizar entre celular y PC más adelante se puede conectar Firebase (gratis).
- El diseño es **mobile-first** (pensado para celulares).

¡Listo para usar y mejorar!
