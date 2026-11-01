# JARVIS · CODEXIA

Taller inicial del hackathon CODEXIA (7 de noviembre de 2026, 9:00): cada equipo arma su propio asistente de IA escaneando tarjetas QR, lo enciende frente a todos y lo usa el resto del día como ayuda en los talleres (pistas de cada estación), bitácora, marcador y cámara. Incluye un **JARVIS ya armado** para el taller VR Ghost Network.

Es una página web (sin instalar nada) que funciona en tablets Android, iPad y en cualquier celular. La API key de Claude vive en un Worker de Cloudflare: los estudiantes nunca la ven.

| Página | Para qué |
| --- | --- |
| `index.html` | La app de cada equipo (tablet y celulares) |
| `sala.html` | Sala de control para el proyector |
| `staff.html` | Panel del staff: batería, anuncios, equipos, CSV (con PIN) |
| `tarjetas.html` | Tarjetas QR para imprimir (un sobre de 36 por equipo) y los carteles “¿Atorados?” de cada estación |
| `taller-vr.html` | JARVIS ya armado de la estación de Redes (videos, explicaciones, ayuda, resultados) |
| `guia.html` | Guía del facilitador: guion de 60 min, checklist y qué hacer si algo falla |

Dirección cuando se publique: `https://mparra37.github.io/jarvis-codexia/`

---

## 1. Publicar la página (GitHub Pages)

1. En github.com creen un repositorio **público** llamado `jarvis-codexia`, vacío (sin README).
2. Desde esta carpeta:

   ```bash
   git remote add origin https://github.com/mparra37/jarvis-codexia.git
   git push -u origin main
   ```

3. En el repositorio: **Settings → Pages → Deploy from a branch → `main` / `(root)`**. En uno o dos minutos queda en `https://mparra37.github.io/jarvis-codexia/`.

Sin el paso 2, la página funciona en **modo sin servidor**: todo se guarda en cada aparato, no se pueden unir celulares, no hay Sala de control y no hay chat con IA (las pistas de cada estación sí funcionan). El taller VR funciona completo (los resultados se quedan en la tablet).

## 2. El servidor con la API key (Cloudflare Worker) · ~15 minutos

Necesitan una cuenta gratis de Cloudflare y una API key de Claude (console.anthropic.com → API Keys). En la consola de Anthropic pongan un **límite de gasto** mensual.

```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create jarvis-codexia
```

El último comando imprime un `database_id`. Cópienlo en `worker/wrangler.toml` (donde dice `PEGA-AQUI-EL-ID-DE-TU-BASE-D1`). Luego:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put STAFF_PIN
npx wrangler deploy
```

(`secret put` les pide el valor: peguen la API key y luego inventen un PIN para el staff.)

`deploy` imprime la dirección del Worker, por ejemplo `https://jarvis-codexia.SU-CUENTA.workers.dev`. Pónganla en `js/config.js` (`API_URL`) y suban el cambio. Las tablas de la base de datos se crean solas en la primera visita.

**Comprobar:** abran `staff.html`, entren con el PIN y revisen que diga “IA: configurada”. Hagan una pregunta desde la app.

### Ajustes del Worker (`worker/wrangler.toml`)

| Variable | Qué hace |
| --- | --- |
| `MODELO` | `claude-opus-5-5` (el más capaz, predeterminado) o `claude-haiku-5-5` (más rápido y unas 40 veces más barato; buena opción para respuestas cortas) |
| `ESFUERZO` | `low` (respuestas rápidas) |
| `ORIGENES` | Sitios que pueden usar el Worker (`https://mparra37.github.io`) |
| `MAX_EQUIPOS` | Máximo de equipos (60) |
| `LIMITE_DIARIO` | Máximo de preguntas a la IA por día (3000): protege la API key |
| `CLAVE_VR` | La clave de los códigos de los juegos VR (la misma de `ITC-VR-Games/js/config.js`) |

Después de cambiar algo: `npx wrangler deploy`.

**Costo aproximado:** cada pregunta usa unos 2,500 tokens de entrada y unos 400 de salida. Con Opus 5.5 son unos 2 centavos de dólar por pregunta; 20 equipos × 15 preguntas ≈ 6 dólares. Con Haiku 5.5, menos de 1 dólar por todo el evento. La batería de cada equipo (15 preguntas al inicio, se recarga desde el panel) y `LIMITE_DIARIO` ponen el tope.

## 3. JARVIS en los otros talleres (ayuda, no dependencia)

Los talleres funcionan igual aunque nadie abra JARVIS. Cuando lo usan, ayuda así:

- **Pestaña Hablar → “¿Dónde están ahora?”**: eligen la estación y aparece su ayuda: de qué trata, botón **Abrir taller ↗**, **Dame una pista** (pistas en orden, primero el concepto y luego dónde buscar, nunca la respuesta) y los conceptos del taller. Funciona **sin internet y sin IA**. Si tienen chat, la IA también sabe en qué estación están y les ayuda con ese taller.
- **Recordatorios suaves** (solo si la app está abierta): al empezar cada ronda pregunta en qué estación están, y en los últimos 6 minutos recuerda anotar la pieza y los puntos. El horario está en `js/config.js` (`RONDAS`); `RECORDATORIOS` puede ser `'evento'` (solo el 7 de noviembre), `'siempre'` (pruebas piloto) o `'nunca'`.
- **Carteles “¿Atorados? Pregúntenle a su JARVIS”** (en `tarjetas.html`, 2 por hoja): uno en la mesa de cada taller. Su QR abre las pistas de esa estación, aunque el celular no esté unido a ningún equipo.
- **Anuncios del panel del staff**: hay dos mensajes listos para recordarles que JARVIS tiene pistas y que anoten su pieza.

El contenido de cada estación está en **`js/estaciones_datos.js`**:

| Estación | Taller | Estado |
| --- | --- | --- |
| Desarrollo móvil · Field Scanner | (sin página todavía) | Pistas generales: cámbienlas cuando el taller esté listo |
| Algoritmos · Project Icarus | [PSO: enjambre de satélites](https://dizzytlacuache.github.io/pso-js/) | Conceptos (inercia, cognitivo, social, fórmula) y experimentos |
| Ciberseguridad · Zero Trust | [Operación Código Fantasma](https://codexia-cybersecurity.onrender.com/) | Pistas para los 5 retos (comentario HTML, elemento oculto, variable CSS, fragmentos JS, Base64) |
| Redes · Ghost Network | [Juegos VR](https://mparra37.github.io/ITC-VR-Games/codexia/) | Dudas frecuentes de los 4 juegos |

Revisen con los responsables de cada taller que las pistas no regalen nada. Si cambian algo, vuelvan a desplegar el Worker (la IA lee el mismo archivo).

**Probar los recordatorios en otro día u hora:** `index.html?hora=10:41` (simula esa hora) o `?recordatorios=siempre`.

## 4. Probar en la computadora

```bash
cd worker && npm install && cd ..   # una vez
node dev/servidor.mjs
```

Abre `http://localhost:8095/`. Es el mismo código del Worker con una base de datos en memoria. Sin API key, la IA contesta en “modo de prueba”. Para probar la IA de verdad:

```bash
ANTHROPIC_API_KEY=sk-ant-... node dev/servidor.mjs
```

PIN del staff en local: `1234`. Para probar en una tablet no sirve localhost (la cámara pide https): publiquen en GitHub Pages. También se puede correr con el entorno real de Cloudflare: `cd worker && npx wrangler dev` (usa `worker/.dev.vars`).

## 5. Prueba piloto del taller VR

`taller-vr.html` funciona sin servidor: videos (se toman del sitio de los juegos VR), explicaciones, cronómetro, guion y resultados guardados en la tablet (exportar a CSV). Para que conteste con IA, hagan el paso 2; la batería del JARVIS de la estación (300 preguntas) se ajusta en el panel del staff.

---

## Cómo está hecho

```
jarvis-codexia/
├── index.html, sala.html, staff.html, tarjetas.html, taller-vr.html, guia.html
├── css/jarvis.css
├── js/
│   ├── config.js            ← dirección del Worker, horario de las rondas, clave de los códigos VR
│   ├── datos.js             ← módulos, tarjetas, voces, núcleos, ambientes, chistes, datos curiosos
│   ├── personalidades.js    ← las 6 personalidades y las reglas del staff (también las usa el Worker)
│   ├── estaciones_datos.js  ← ayuda y pistas de cada estación (también las usa el Worker)
│   ├── taller_vr_datos.js   ← reglas, explicaciones, dudas y guion de los 4 juegos VR (también los usa el Worker)
│   ├── filtro.js            ← palabras bloqueadas (app y Worker)
│   ├── codigo_vr.js         ← verifica los códigos de los visores (mismo algoritmo que ITC-VR-Games/js/marcador.js)
│   ├── app.js               ← la app de equipos
│   ├── estado.js            ← el equipo en el aparato y sincronización con el Worker
│   ├── vr.js, sala.js, staff.js, tarjetas.js
│   └── nucleo.js, ambiente.js, voz.js, sonidos.js, qr.js, camara.js, ui.js, api.js
├── vendor/                  ← jsQR (lee QR) y qrcode-generator (dibuja QR)
├── worker/                  ← el Worker de Cloudflare (src/index.js, src/prompts.js, wrangler.toml)
└── dev/servidor.mjs         ← servidor de prueba local
```

- **Sin build:** HTML, CSS y módulos de JavaScript. La voz usa la síntesis del navegador (gratis y sin internet); los fondos y núcleos se dibujan con `<canvas>`; los sonidos se generan con Web Audio.
- **Sincronización:** cada cambio se manda como “merge patch” al Worker, que lo guarda en D1 (SQLite). Los aparatos del equipo revisan cada 6 segundos. Sin internet, todo se guarda en el aparato y se manda después.
- **Seguridad:** la API key es un secreto del Worker. Las reglas del staff van primero en el prompt y lo que escriben los equipos va marcado como datos. La IA no conoce las claves de ningún taller. El Worker limita batería por equipo, preguntas por día, tamaño de los datos y filtra groserías.
- **Privacidad (son menores de edad):** solo nombres de pila; las fotos se quedan en la tablet y nunca se suben.

## Cambiar cosas

- Personalidades, frases y reglas del staff → `js/personalidades.js`
- Pistas de cada estación → `js/estaciones_datos.js`
- Voces, núcleos, ambientes, chistes, datos curiosos, sugerencias → `js/datos.js`
- Reglas y explicaciones de los juegos VR → `js/taller_vr_datos.js`
- Horario de las rondas y recordatorios → `js/config.js`
- Lo que sabe la IA del evento → `worker/src/prompts.js`
- Si cambian algo que usa el Worker (`personalidades.js`, `estaciones_datos.js`, `taller_vr_datos.js`, `filtro.js`, `codigo_vr.js`), vuelvan a desplegarlo.
- Cuando cambien JavaScript, cambien `CACHE` en `sw.js` (por ejemplo `jarvis-v3`) para que las tablets bajen la versión nueva.
