/* JARVIS · panel del staff: equipos, batería, chat, anuncios y exportar */
import { llamar, hayServidor } from './api.js';
import { ESTACIONES, ESTACIONES_PUNTOS } from './datos.js';
import { AYUDA_ESTACIONES } from './estaciones_datos.js';
import { Ambiente } from './ambiente.js';
import { $, esc, aviso, confirmar, hora } from './ui.js';

new Ambiente($('#fondo')).poner('base', '#3fd0ff');
const raiz = $('#staff');
let pin = sessionStorage.getItem('jarvis-pin') || '';
let datos = { equipos: [], estado: null, energiaVR: 0, salud: null };
const abiertos = new Set();

const PRESETS = [
  ['jarvis', 'Faltan 5 minutos para terminar el taller de JARVIS.'],
  ['jarvis', 'Enciendan su JARVIS: ¡vamos a verlos en la pantalla!'],
  ['jarvis', 'Es hora de ir a los talleres. ¡Lleven su JARVIS!'],
  ['jarvis', 'Regresen al salón principal para el reto final.'],
  ['jarvis', '¿Atorados en un taller? Su JARVIS tiene pistas de cada estación en la pestaña Hablar.'],
  ['jarvis', 'Antes de cambiar de estación, anoten su pieza y sus puntos en JARVIS.'],
  ['ultron', 'Humanos: sus JARVIS no podrán detenerme. Los espero en el reto final.'],
  ['ultron', 'He tomado el control de la red. Tienen poco tiempo.'],
];

function pantallaPin(mensaje = '') {
  raiz.innerHTML = `<div class="panel" style="max-width:420px;margin:10vh auto 0">
    <h2>Panel del staff</h2>
    ${hayServidor() ? '' : '<p style="color:var(--amarillo)">No hay servidor configurado (js/config.js → API_URL).</p>'}
    <form id="f-pin"><label class="campo"><span>PIN del staff</span><input type="password" id="pin" autocomplete="current-password" inputmode="numeric"></label>
    <button class="btn btn-primario" style="width:100%">Entrar</button></form>
    <p style="color:var(--rojo)">${esc(mensaje)}</p>
    <p class="tenue enlaces" style="font-size:15px"><a href="./">App de equipos</a><a href="sala.html">Sala de control</a><a href="tarjetas.html">Tarjetas</a><a href="taller-vr.html">Taller VR</a><a href="guia.html">Guía</a></p>
  </div>`;
  $('#f-pin').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    pin = $('#pin').value.trim();
    try {
      await cargar();
      sessionStorage.setItem('jarvis-pin', pin);
      pintar();
    } catch (e) {
      pantallaPin(e.status === 401 ? 'PIN incorrecto.' : e.message);
    }
  });
}

async function cargar() {
  const [eq, est] = await Promise.all([
    llamar('GET', '/api/staff/equipos', undefined, { pin }),
    llamar('GET', '/api/staff/estado', undefined, { pin }),
  ]);
  datos = { equipos: eq.equipos, estado: est.estado, energiaVR: est.energiaVR, salud: est.salud };
  $('#actualizado').textContent = `Actualizado ${hora(Date.now())}`;
}

const accion = async (metodo, ruta, cuerpo, mensaje) => {
  try {
    await llamar(metodo, ruta, cuerpo, { pin });
    if (mensaje) aviso(mensaje);
    await cargar();
    pintar();
  } catch (e) {
    aviso(e.message, { mal: true });
  }
};

function total(e) { return e.puntos.reduce((s, p) => s + (Number(p.puntos) || 0), 0); }

function pintar() {
  const { equipos, estado, energiaVR, salud } = datos;
  const enLinea = equipos.filter((e) => e.encendido).length;
  raiz.innerHTML = `
    <div class="dos">
      <section class="panel">
        <h2>Control general</h2>
        <p class="tenue" style="margin-top:0">IA: <b style="color:${salud.ia ? 'var(--verde)' : 'var(--amarillo)'}">${salud.ia ? `configurada (${esc(salud.modelo)})` : 'sin API key'}</b> · ${equipos.length} equipos · ${enLinea} encendidos</p>
        <div class="interruptor"><span><b>Chat con IA</b><br><span class="tenue" style="font-size:15px">Páusenlo si hace falta silencio o algo sale mal.</span></span>
          <button class="btn ${estado.chatActivo ? 'btn-primario' : 'btn-rojo'}" id="b-chat">${estado.chatActivo ? 'Activo' : 'Pausado'}</button></div>
        <div class="interruptor"><span><b>Batería inicial</b> de cada equipo nuevo</span>
          <span style="display:flex;gap:6px;align-items:center"><input type="number" id="en-ini" value="${estado.energiaInicial}" style="width:90px"><button class="btn btn-chico" id="b-en-ini">Guardar</button></span></div>
        <div class="interruptor"><span><b>Recargar a todos</b></span>
          <span style="display:flex;gap:6px"><button class="btn btn-chico" data-todos="5">+5</button><button class="btn btn-chico" data-todos="10">+10</button></span></div>
        <div class="interruptor"><span><b>Batería del JARVIS del taller VR</b></span>
          <span style="display:flex;gap:6px;align-items:center"><input type="number" id="en-vr" value="${energiaVR}" style="width:90px"><button class="btn btn-chico" id="b-en-vr">Guardar</button></span></div>
        <p class="tenue enlaces" style="font-size:15px;margin-bottom:0"><a href="sala.html" target="_blank">Sala de control ↗</a><a href="tarjetas.html" target="_blank">Tarjetas ↗</a><a href="taller-vr.html" target="_blank">Taller VR ↗</a><a href="guia.html" target="_blank">Guía ↗</a></p>
      </section>
      <section class="panel">
        <h2>Anuncio a todos los JARVIS</h2>
        <p class="tenue" style="margin-top:0">Aparece en todas las tablets, en los celulares y en la Sala de control. Cada JARVIS lo dice en voz alta.</p>
        <textarea id="anuncio" maxlength="200" placeholder="Escriban el mensaje…"></textarea>
        <div class="chips" id="presets">${PRESETS.map(([t, x], i) => `<button class="chip" data-i="${i}">${t === 'ultron' ? '⚠ ' : ''}${esc(x.slice(0, 42))}${x.length > 42 ? '…' : ''}</button>`).join('')}</div>
        <div class="fila-botones" style="margin-top:12px">
          <button class="btn btn-primario" data-enviar="jarvis">Enviar como staff</button>
          <button class="btn btn-rojo" data-enviar="ultron">Enviar como Ultrón</button>
          ${estado.anuncio ? '<button class="btn-texto" id="b-quitar">Quitar anuncio</button>' : ''}
        </div>
        ${estado.anuncio ? `<p class="tenue" style="font-size:15px">Último (${hora(estado.anuncio.t)}): “${esc(estado.anuncio.texto)}”</p>` : ''}
      </section>
    </div>
    <section class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <h2 style="margin:0">Equipos</h2>
        <div class="fila-botones"><button class="btn btn-chico" id="b-csv">Exportar CSV</button><button class="btn btn-chico" id="b-csv-vr">Resultados VR (CSV)</button><button class="btn btn-chico" id="b-recargar">Actualizar</button></div>
      </div>
      <div class="tabla-scroll"><table>
        <thead><tr><th>Equipo</th><th>Código</th><th>JARVIS</th><th>Estación</th><th>Módulos</th><th>Encendido</th><th>Batería</th><th>Puntos</th><th></th></tr></thead>
        <tbody>${equipos.length ? equipos.map((e) => `<tr>
          <td><button class="btn-texto" style="color:var(--texto);min-height:0" data-ver="${e.codigo}">${abiertos.has(e.codigo) ? '▾' : '▸'} ${esc(e.nombre)}</button></td>
          <td class="mono" style="color:var(--acento)">${e.codigo}</td>
          <td>${esc(e.jarvis)}</td>
          <td>${e.estacion && AYUDA_ESTACIONES[e.estacion] ? esc(AYUDA_ESTACIONES[e.estacion].nombre) : '—'}</td>
          <td>${e.instalados}/8</td>
          <td>${e.encendido ? hora(e.encendido) : '—'}</td>
          <td style="white-space:nowrap"><button class="btn btn-chico" data-en="${e.codigo}" data-d="-5">−5</button> <b class="mono">${e.energia}</b> <button class="btn btn-chico" data-en="${e.codigo}" data-d="5">+5</button></td>
          <td class="mono">${total(e)}</td>
          <td style="white-space:nowrap"><button class="btn btn-chico" data-apagar="${e.codigo}" ${e.encendido ? '' : 'disabled'}>Apagar</button> <button class="btn btn-chico btn-rojo" data-borrar="${e.codigo}">Borrar</button></td>
        </tr>${abiertos.has(e.codigo) ? `<tr class="detalle-eq"><td colspan="9">
          <b>Integrantes:</b> ${esc(e.integrantes.join(', ') || '—')} · <b>Prepa:</b> ${esc(e.prepa || '—')}<br>
          <b>Directiva:</b> habla como “${esc(e.directiva.habla || '—')}”, le encanta “${esc(e.directiva.encanta || '—')}”, nunca “${esc(e.directiva.nunca || '—')}”<br>
          <b>Bitácora:</b> ${ESTACIONES.map((s) => `${esc(s.pieza)}: ${esc(e.bitacora[s.id] || '—')}`).join(' · ')}<br>
          <b>Puntos:</b> ${e.puntos.length ? e.puntos.map((p) => `${esc((ESTACIONES_PUNTOS.find((s) => s.id === p.estacion) || { nombre: p.estacion }).nombre)} ${p.puntos}${p.codigo ? (p.valido ? ' ✓' : ' ✗') : ''}`).join(' · ') : '—'}
        </td></tr>` : ''}`).join('') : '<tr><td colspan="9" class="tenue">Todavía no hay equipos.</td></tr>'}</tbody>
      </table></div>
    </section>`;

  $('#b-chat').addEventListener('click', () => accion('POST', '/api/staff/estado', { chatActivo: !estado.chatActivo }, estado.chatActivo ? 'Chat pausado' : 'Chat activado'));
  $('#b-en-ini').addEventListener('click', () => accion('POST', '/api/staff/estado', { energiaInicial: Number($('#en-ini').value) }, 'Guardado'));
  $('#b-en-vr').addEventListener('click', () => accion('POST', '/api/staff/estado', { energiaVR: Number($('#en-vr').value) }, 'Guardado'));
  raiz.querySelectorAll('[data-todos]').forEach((b) => b.addEventListener('click', () => accion('POST', '/api/staff/energia', { delta: Number(b.dataset.todos) }, 'Batería recargada')));
  $('#presets').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-i]');
    if (!b) return;
    $('#anuncio').value = PRESETS[Number(b.dataset.i)][1];
  });
  raiz.querySelectorAll('[data-enviar]').forEach((b) => b.addEventListener('click', () => {
    const texto = $('#anuncio').value.trim();
    if (!texto) { aviso('Escriban el anuncio.', { mal: true }); return; }
    accion('POST', '/api/staff/estado', { anuncio: { texto, tipo: b.dataset.enviar } }, 'Anuncio enviado');
  }));
  $('#b-quitar')?.addEventListener('click', () => accion('POST', '/api/staff/estado', { anuncio: null }, 'Anuncio quitado'));
  $('#b-recargar').addEventListener('click', async () => { await cargar(); pintar(); });
  $('#b-csv').addEventListener('click', exportarEquipos);
  $('#b-csv-vr').addEventListener('click', exportarVR);
  raiz.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => {
    const c = b.dataset.ver;
    if (abiertos.has(c)) abiertos.delete(c); else abiertos.add(c);
    pintar();
  }));
  raiz.querySelectorAll('[data-en]').forEach((b) => b.addEventListener('click', () => accion('POST', `/api/staff/equipos/${b.dataset.en}/energia`, { delta: Number(b.dataset.d) })));
  raiz.querySelectorAll('[data-apagar]').forEach((b) => b.addEventListener('click', async () => {
    if (await confirmar('¿Apagar este JARVIS? El equipo tendrá que volver a encenderlo.', { si: 'Apagar' })) accion('POST', `/api/staff/equipos/${b.dataset.apagar}/apagar`, {}, 'JARVIS apagado');
  }));
  raiz.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', async () => {
    if (await confirmar(`¿Borrar el equipo ${b.dataset.borrar}? Se pierden sus módulos, bitácora y puntos. No se puede deshacer.`, { si: 'Borrar', peligro: true })) accion('DELETE', `/api/staff/equipos/${b.dataset.borrar}`, undefined, 'Equipo borrado');
  }));
}

function descargarCSV(nombre, filas) {
  const texto = filas.map((f) => f.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([`﻿${texto}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function exportarEquipos() {
  const filas = [['Equipo', 'Código', 'JARVIS', 'Integrantes', 'Prepa', 'Módulos', 'Encendido', 'Batería', 'Total puntos', ...ESTACIONES_PUNTOS.map((s) => `Puntos ${s.nombre}`), ...ESTACIONES.map((s) => `Bitácora ${s.pieza}`)]];
  datos.equipos.forEach((e) => {
    filas.push([e.nombre, e.codigo, e.jarvis, e.integrantes.join(' / '), e.prepa, e.instalados, e.encendido ? new Date(e.encendido).toLocaleTimeString('es-MX') : '', e.energia, total(e),
      ...ESTACIONES_PUNTOS.map((s) => e.puntos.filter((p) => p.estacion === s.id).reduce((t, p) => t + p.puntos, 0)),
      ...ESTACIONES.map((s) => e.bitacora[s.id] || '')]);
  });
  descargarCSV(`jarvis-equipos-${new Date().toISOString().slice(0, 10)}.csv`, filas);
}

async function exportarVR() {
  try {
    const r = await llamar('GET', '/api/vr/resultados');
    const filas = [['Hora', 'Equipo', 'Código JARVIS', 'Juego', 'Puntaje', 'Código VR', 'Válido', 'Nota']];
    r.resultados.forEach((x) => filas.push([new Date(x.t).toLocaleString('es-MX'), x.equipo, x.codigo_equipo || '', x.juego, x.puntaje, x.codigo, x.valido ? 'sí' : 'no', x.nota]));
    descargarCSV(`jarvis-resultados-vr-${new Date().toISOString().slice(0, 10)}.csv`, filas);
  } catch (e) { aviso(e.message, { mal: true }); }
}

if (pin) {
  cargar().then(pintar).catch(() => pantallaPin());
} else {
  pantallaPin();
}
setInterval(() => {
  if (!pin || document.hidden || raiz.contains(document.activeElement) && document.activeElement.matches('input, textarea')) return;
  cargar().then(pintar).catch(() => {});
}, 10000);
