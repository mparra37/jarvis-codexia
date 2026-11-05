# JARVIS · CODEXIA

Taller inicial del hackathon CODEXIA (7 de noviembre de 2026, 9:00): cada equipo arma su propio asistente de IA en su tablet escaneando tarjetas QR, lo enciende frente a todos y lo usa el resto del día como ayuda en los talleres (pistas de cada estación), bitácora, marcador y cámara. Incluye un **JARVIS ya armado** para el taller VR Ghost Network.

Es una página web (sin instalar nada) que funciona en tablets Android, iPad y en cualquier celular. **Cada tablet es independiente:** su JARVIS se guarda en la tablet, no hay que unir aparatos y no depende de internet. El presentador guía la sesión con un PowerPoint.

| Archivo | Para qué |
| --- | --- |
| `index.html` | La app de cada equipo |
| `presentacion/JARVIS_taller_CODEXIA.pptx` | El PowerPoint del presentador (16 diapositivas, con notas) |
| `tarjetas.html` | Tarjetas QR para imprimir (un sobre de 36 por equipo) y los carteles “¿Atorados?” de cada estación |
| `staff.html` | Panel del staff: estado de la IA, pausa, batería por tablet y resultados VR (con PIN) |
| `taller-vr.html` | JARVIS ya armado de la estación de Redes (videos, explicaciones, ayuda, resultados) |
| `guia.html` | Guía del facilitador: guion de 60 min, checklist y qué hacer si algo falla |

Dirección cuando se publique: `https://mparra37.github.io/jarvis-codexia/`

---

## Dos cerebros

- **Cerebro básico** (`js/cerebro.js`): viene desde el inicio y funciona sin internet. Busca palabras clave en la pregunta y contesta con textos escritos por personas (agenda, talleres, conceptos de cada estación, chistes, datos curiosos, “pista”…), con el estilo de la personalidad que eligió el equipo, y lo dice en voz alta. Así funcionaban los primeros chatbots, como ELIZA (1966).
- **Cerebro IA** (tarjeta **H4**): la pregunta va al Worker de Cloudflare, que le pregunta a Claude con la personalidad, la memoria y la estación del equipo. Si la IA no contesta, el staff la pausa o se acaba la batería de la tablet, **contesta el cerebro básico** y la app lo avisa. Cada respuesta dice qué cerebro la dio.

Para usar solo el cerebro básico (sin API): en `js/config.js` pongan `IA: 'basico'`, o simplemente no configuren el Worker.

## 1. Publicar la página (GitHub Pages)

1. En github.com creen un repositorio **público** llamado `jarvis-codexia`, vacío (sin README).
2. Desde esta carpeta:

   ```bash
   git remote add origin https://github.com/mparra37/jarvis-codexia.git
   git push -u origin main
   ```

3. En el repositorio: **Settings → Pages → Deploy from a branch → `main` / `(root)`**. En uno o dos minutos queda en `https://mparra37.github.io/jarvis-codexia/`.

Con solo este paso, todo funciona con el cerebro básico.

## 2. El Cerebro IA (Cloudflare Worker con la API key) · ~15 minutos

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

`deploy` imprime la dirección del Worker, por ejemplo `https://jarvis-codexia.SU-CUENTA.workers.dev`. Pónganla en `js/config.js` (`API_URL`) y suban el cambio. Las tablas se crean solas en la primera visita.

**Comprobar:** abran `staff.html`, entren con el PIN y revisen que diga “IA: configurada”. En una tablet escaneen la tarjeta H4 y pregunten algo: la respuesta debe decir “✨ IA”.

El Worker **no guarda los JARVIS**: con cada pregunta la tablet manda los datos de su JARVIS (nombre, personalidad, memoria, estación) y un identificador al azar de la tablet. La base de datos D1 solo guarda cuántas preguntas lleva cada tablet hoy, los ajustes del staff y los resultados del taller VR.

### Ajustes del Worker (`worker/wrangler.toml`)

| Variable | Qué hace |
| --- | --- |
| `MODELO` | `claude-opus-5-5` (el más capaz, predeterminado) o `claude-haiku-5-5` (más rápido y unas 40 veces más barato; buena opción para respuestas cortas) |
| `ESFUERZO` | `low` (respuestas rápidas) |
| `ORIGENES` | Sitios que pueden usar el Worker (`https://mparra37.github.io`) |
| `CUOTA_TABLETA` | Preguntas de IA por tablet al día (30). También se cambia desde el panel del staff |
| `LIMITE_DIARIO` | Máximo de preguntas a la IA por día entre todos (3000): protege la API key |
| `CLAVE_VR` | La clave de los códigos de los juegos VR (la misma de `ITC-VR-Games/js/config.js`) |

Después de cambiar algo: `npx wrangler deploy`.

**Costo aproximado:** cada pregunta usa unos 2,500 tokens de entrada y unos 400 de salida. Con Opus 5.5 son unos 2 centavos de dólar por pregunta; 20 tablets × 30 preguntas ≈ 12 dólares como máximo. Con Haiku 5.5, menos de 1 dólar por todo el evento.

## 3. JARVIS en los otros talleres (ayuda, no dependencia)

- **Pestaña Hablar → “¿Dónde están ahora?”**: eligen la estación y aparece su ayuda: de qué trata, **Abrir taller ↗**, **Dame una pista** (pistas en orden, nunca la respuesta) y los conceptos del taller. Funciona **sin internet y sin IA**. En el chat también pueden escribir “pista”.
- **Recordatorios suaves** (si la app está abierta): al empezar cada ronda pregunta en qué estación están, y en los últimos 6 minutos recuerda anotar la pieza y los puntos. Horario en `js/config.js` (`RONDAS`); `RECORDATORIOS` puede ser `'evento'` (solo el 7 de noviembre), `'siempre'` (pruebas) o `'nunca'`. Para probar: `index.html?hora=10:41`.
- **Carteles “¿Atorados? Pregúntenle a su JARVIS”** (en `tarjetas.html`): uno en la mesa de cada taller; su QR abre las pistas de esa estación.

El contenido de cada estación está en **`js/estaciones_datos.js`**:

| Estación | Taller | Estado |
| --- | --- | --- |
| Desarrollo móvil · Field Scanner | (sin página todavía) | Pistas generales: cámbienlas cuando el taller esté listo |
| Algoritmos · Project Icarus | [PSO: enjambre de satélites](https://dizzytlacuache.github.io/pso-js/) | Conceptos (inercia, cognitivo, social, fórmula) y experimentos |
| Ciberseguridad · Zero Trust | [Operación Código Fantasma](https://codexia-cybersecurity.onrender.com/) | Pistas para los 5 retos (comentario HTML, elemento oculto, variable CSS, fragmentos JS, Base64) |
| Redes · Ghost Network | [Juegos VR](https://mparra37.github.io/ITC-VR-Games/codexia/) | Dudas frecuentes de los 4 juegos |

Revisen con los responsables de cada taller que las pistas no regalen nada. El cerebro básico y la IA leen el mismo archivo (si lo cambian, vuelvan a desplegar el Worker).

## 4. Probar en la computadora

```bash
cd worker && npm install && cd ..   # una vez
node dev/servidor.mjs
```

Abre `http://localhost:8095/`. Es el mismo código del Worker con una base de datos en memoria. Sin API key, el Cerebro IA contesta en “modo de prueba”. Para probar la IA de verdad:

```bash
ANTHROPIC_API_KEY=sk-ant-... node dev/servidor.mjs
```

PIN del staff en local: `1234`. Para probar en una tablet no sirve localhost (la cámara pide https): publiquen en GitHub Pages.

## 5. Prueba piloto del taller VR

`taller-vr.html` funciona sin servidor: videos (del sitio de los juegos VR), explicaciones, cronómetro, guion y resultados guardados en la tablet (exportar a CSV). Con el Worker contesta con IA; su batería (300 preguntas) se ajusta en el panel del staff.

---

## Cómo está hecho

```
jarvis-codexia/
├── index.html, staff.html, tarjetas.html, taller-vr.html, guia.html
├── presentacion/            ← el PowerPoint del presentador
├── css/jarvis.css
├── js/
│   ├── config.js            ← dirección del Worker, modo de IA, horario de las rondas
│   ├── cerebro.js           ← el cerebro básico: intenciones, palabras clave y respuestas
│   ├── datos.js             ← módulos, tarjetas, voces, núcleos, ambientes, chistes, datos curiosos
│   ├── personalidades.js    ← las 6 personalidades (frases y estilo) y las reglas del staff
│   ├── estaciones_datos.js  ← ayuda y pistas de cada estación
│   ├── taller_vr_datos.js   ← reglas, explicaciones, dudas y guion de los 4 juegos VR
│   ├── filtro.js            ← palabras bloqueadas
│   ├── codigo_vr.js         ← verifica los códigos de los visores
│   ├── app.js               ← la app
│   ├── estado.js            ← el JARVIS de esta tablet (localStorage)
│   ├── vr.js, staff.js, tarjetas.js
│   └── nucleo.js, ambiente.js, voz.js, sonidos.js, qr.js, camara.js, ui.js, api.js
├── vendor/                  ← jsQR (lee QR) y qrcode-generator (dibuja QR)
├── worker/                  ← el Worker de Cloudflare (src/index.js, src/prompts.js, wrangler.toml)
└── dev/servidor.mjs         ← servidor de prueba local
```

- **Sin build:** HTML, CSS y módulos de JavaScript. La voz usa la síntesis del navegador (gratis y sin internet); los fondos y núcleos se dibujan con `<canvas>`; los sonidos se generan con Web Audio.
- **Seguridad:** la API key es un secreto del Worker. Las reglas del staff van primero en el prompt y lo que escriben los equipos va marcado como datos. La IA no conoce las claves de ningún taller. El Worker limita preguntas por tablet y por día, el tamaño de los datos y filtra groserías.
- **Privacidad (son menores de edad):** solo nombres de pila; todo se guarda en la tablet y las fotos nunca se suben.

## Cambiar cosas

- Respuestas del cerebro básico → `js/cerebro.js` (intenciones y glosario)
- Personalidades, frases y reglas del staff → `js/personalidades.js`
- Pistas de cada estación → `js/estaciones_datos.js`
- Voces, núcleos, ambientes, chistes, datos curiosos → `js/datos.js`
- Reglas y explicaciones de los juegos VR → `js/taller_vr_datos.js`
- Horario y recordatorios, modo de IA → `js/config.js`
- Lo que sabe la IA del evento → `worker/src/prompts.js`
- Si cambian algo que usa el Worker (`personalidades.js`, `estaciones_datos.js`, `taller_vr_datos.js`, `filtro.js`, `codigo_vr.js`), vuelvan a desplegarlo.
- Cuando cambien JavaScript, cambien `CACHE` en `sw.js` (por ejemplo `jarvis-v7`) para que las tablets bajen la versión nueva.
