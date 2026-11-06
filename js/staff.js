/* JARVIS · panel del staff: estado del Cerebro IA, pausa, batería por tablet y resultados VR
 *
 * Las tablets no están conectadas entre sí: cada una tiene su JARVIS. Aquí solo se controla la IA.
 */
import { llamar, hayServidor } from './api.js';
import { Ambiente } from './ambiente.js';
import { $, esc, aviso, confirmar, hora } from './ui.js';

new Ambiente($('#fondo')).poner('base', '#3fd0ff');
const raiz = $('#staff');
let pin = sessionStorage.getItem('jarvis-pin') || '';
let datos = null;

function pantallaPin(mensaje = '') {
  raiz.innerHTML = `<div class="panel" style="max-width:420px;margin:10vh auto 0">
    <h2>Panel del staff</h2>
    ${hayServidor() ? '' : '<p style="color:var(--amarillo)">No hay servidor configurado (js/config.js → API_URL). Sin servidor, todas las tablets usan el cerebro básico.</p>'}
    <form id="f-pin"><label class="campo"><span>PIN del staff</span><input type="password" id="pin" autocomplete="current-password" inputmode="numeric"></label>
    <button class="btn btn-primario" style="width:100%">Entrar</button></form>
    <p style="color:var(--rojo)">${esc(mensaje)}</p>
    <p class="tenue enlaces" style="font-size:15px"><a href="./">App</a> · <a href="tarjetas.html">Tarjetas</a> · <a href="taller-vr.html">Taller VR</a> · <a href="guia.html">Guía</a></p>
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
  datos = await llamar('GET', '/api/staff/estado', undefined, { pin });
  $('#actualizado').textContent = `Actualizado ${hora(Date.now())}`;
}

async function accion(metodo, ruta, cuerpo, mensaje) {
  try {
    datos = await llamar(metodo, ruta, cuerpo, { pin });
    if (mensaje) aviso(mensaje);
    pintar();
  } catch (e) {
    aviso(e.message, { mal: true });
  }
}

function pintar() {
  const { estado, energiaVR, hoy, salud } = datos;
  const iaTexto = !salud.ia ? 'sin API key: las tablets usan el cerebro básico'
    : salud.prueba ? 'modo de prueba (sin API key)' : `configurada (${esc(salud.modelo)})`;
  raiz.innerHTML = `
    <section class="panel">
      <h2>Cerebro IA</h2>
      <p style="margin-top:0">IA: <b style="color:${salud.ia && !salud.prueba ? 'var(--verde)' : 'var(--amarillo)'}">${iaTexto}</b></p>
      ${salud.baseDeDatos === false ? '<p style="font-size:15px;color:var(--amarillo);border:1px solid var(--amarillo);border-radius:10px;padding:8px 12px">⚠ <b>Falta conectar la base de datos.</b> Sin ella, la pausa, la batería por tablet y el uso de hoy <b>no son confiables</b>: Cloudflare corre varias copias del Worker y cada una lleva su propia cuenta. Conéctenla (Cloudflare → D1 → enlace con nombre DB, ver LEEME). Los resultados VR se quedan en la tablet de la estación.</p>' : ''}
      <div class="interruptor"><span><b>IA en las tablets</b><br><span class="tenue" style="font-size:15px">En pausa, cada JARVIS contesta con su cerebro básico (respuestas pre-escritas).</span></span>
        <button class="btn ${estado.chatActivo ? 'btn-primario' : 'btn-rojo'}" id="b-chat">${estado.chatActivo ? 'Activa' : 'En pausa'}</button></div>
      <div class="interruptor"><span><b>Batería por tablet</b><br><span class="tenue" style="font-size:15px">Preguntas de IA por tablet al día. Al acabarse, sigue el cerebro básico.</span></span>
        <span style="display:flex;gap:6px;align-items:center"><input type="number" id="cuota" value="${estado.cuota}" style="width:90px"><button class="btn btn-chico" id="b-cuota">Guardar</button></span></div>
      <div class="interruptor"><span><b>Recargar todas las tablets</b><br><span class="tenue" style="font-size:15px">Vuelve a darles su batería completa hoy.</span></span>
        <button class="btn btn-chico" id="b-recargar">Recargar</button></div>
    </section>
    <section class="panel">
      <h2>Uso de hoy</h2>
      <div class="dos" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));display:grid;gap:12px">
        <div><div class="total">${hoy.tabletas}</div><span class="tenue">tablets que usaron la IA</span></div>
        <div><div class="total">${hoy.preguntas}</div><span class="tenue">preguntas de equipos</span></div>
        <div><div class="total">${hoy.presentaciones}</div><span class="tenue">presentaciones al encender</span></div>
        <div><div class="total">${hoy.totalIA}<span class="tenue" style="font-size:16px"> / ${hoy.limite}</span></div><span class="tenue">llamadas a la IA (límite del día)</span></div>
      </div>
    </section>
    <section class="panel">
      <h2>Taller VR · Ghost Network</h2>
      <div class="interruptor"><span><b>Batería del JARVIS de la estación</b></span>
        <span style="display:flex;gap:6px;align-items:center"><input type="number" id="en-vr" value="${energiaVR}" style="width:90px"><button class="btn btn-chico" id="b-en-vr">Guardar</button></span></div>
      <div class="fila-botones" style="margin-top:12px"><button class="btn btn-chico" id="b-csv-vr">Resultados VR (CSV)</button><a class="btn btn-chico" href="taller-vr.html" target="_blank">Abrir taller VR ↗</a></div>
    </section>
    <p class="tenue enlaces" style="font-size:15px"><a href="./" target="_blank">App ↗</a> · <a href="tarjetas.html" target="_blank">Tarjetas ↗</a> · <a href="guia.html" target="_blank">Guía ↗</a></p>`;

  $('#b-chat').addEventListener('click', () => accion('POST', '/api/staff/estado', { chatActivo: !estado.chatActivo }, estado.chatActivo ? 'IA en pausa' : 'IA activa'));
  $('#b-cuota').addEventListener('click', () => accion('POST', '/api/staff/estado', { cuota: Number($('#cuota').value) }, 'Guardado'));
  $('#b-recargar').addEventListener('click', async () => {
    if (await confirmar('¿Recargar la batería de IA de todas las tablets?', { si: 'Recargar' })) accion('POST', '/api/staff/recargar', {}, 'Batería recargada');
  });
  $('#b-en-vr').addEventListener('click', () => accion('POST', '/api/staff/estado', { energiaVR: Number($('#en-vr').value) }, 'Guardado'));
  $('#b-csv-vr').addEventListener('click', exportarVR);
}

function descargarCSV(nombre, filas) {
  const texto = filas.map((f) => f.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([`﻿${texto}`], { type: 'text/csv;charset=utf-8' }));
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function exportarVR() {
  try {
    const r = await llamar('GET', '/api/vr/resultados');
    const filas = [['Hora', 'Equipo', 'Juego', 'Puntaje', 'Código VR', 'Válido', 'Nota']];
    r.resultados.forEach((x) => filas.push([new Date(x.t).toLocaleString('es-MX'), x.equipo, x.juego, x.puntaje, x.codigo, x.valido ? 'sí' : 'no', x.nota]));
    descargarCSV(`jarvis-resultados-vr-${new Date().toISOString().slice(0, 10)}.csv`, filas);
  } catch (e) { aviso(e.message, { mal: true }); }
}

if (pin) cargar().then(pintar).catch(() => pantallaPin());
else pantallaPin();
setInterval(() => {
  if (!pin || !datos || document.hidden || (document.activeElement && document.activeElement.matches('input'))) return;
  cargar().then(pintar).catch(() => {});
}, 15000);
