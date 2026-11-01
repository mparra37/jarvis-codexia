/* JARVIS · núcleo visual: 6 formas animadas en <canvas>
 *
 * new Nucleo(canvas, { forma, color }) · .poner({ forma, color }) · .hablando(true|false)
 * .modo('ultron' | 'fiesta' | null) · .destruir()
 * Cuando habla, la "amplitud" sube y baja al azar (el navegador no deja medir la voz sintetizada).
 */

const ROJO = '#ff1638';

function hexARgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex, a) {
  if (hex.startsWith('hsl')) return hex.replace('hsl(', 'hsla(').replace(')', `,${a})`);
  const [r, g, b] = hexARgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export class Nucleo {
  constructor(canvas, { forma = 'reactor', color = '#3fd0ff', mini = false } = {}) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.forma = forma;
    this.color = color;
    this.mini = mini;
    this.amp = 0;
    this.objetivo = 0;
    this.estaHablando = false;
    this.modoActual = null;
    this.t0 = performance.now();
    this.mirada = { x: 0, y: 0, ox: 0, oy: 0, cambio: 0 };
    this.vivo = true;
    this.ajustar();
    this.observador = new ResizeObserver(() => this.ajustar());
    this.observador.observe(canvas);
    this.cuadro = this.cuadro.bind(this);
    requestAnimationFrame(this.cuadro);
  }

  ajustar() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.mini ? 1.5 : 2);
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  poner({ forma, color } = {}) {
    if (forma) this.forma = forma;
    if (color) this.color = color;
  }

  hablando(valor) { this.estaHablando = Boolean(valor); }
  modo(m) { this.modoActual = m; }

  destruir() {
    this.vivo = false;
    this.observador.disconnect();
  }

  cuadro(ahora) {
    if (!this.vivo) return;
    requestAnimationFrame(this.cuadro);
    if (document.hidden) return;
    const t = (ahora - this.t0) / 1000;
    // amplitud de la voz
    if (this.estaHablando || this.modoActual === 'fiesta') {
      if (Math.random() < 0.18) this.objetivo = 0.35 + Math.random() * 0.65;
    } else {
      this.objetivo = 0;
    }
    this.amp += (this.objetivo - this.amp) * 0.25;

    let color = this.color;
    if (this.modoActual === 'ultron') color = ROJO;
    if (this.modoActual === 'fiesta') color = `hsl(${Math.round((t * 160) % 360)},100%,60%)`;

    const g = this.g;
    g.clearRect(0, 0, this.w, this.h);
    g.save();
    if (this.modoActual === 'ultron') g.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6);
    const cx = this.w / 2;
    const cy = this.h / 2;
    const R = Math.min(this.w, this.h) * 0.42;
    const dibujo = FORMAS[this.forma] || FORMAS.reactor;
    dibujo.call(this, g, cx, cy, R, t, this.amp, color);
    g.restore();
    if (this.modoActual === 'ultron' && Math.random() < 0.3) {
      // franjas de interferencia
      const y = Math.random() * this.h;
      g.fillStyle = 'rgba(255,22,56,0.25)';
      g.fillRect(0, y, this.w, 2 + Math.random() * 8);
    }
  }
}

function brillo(g, color, cantidad) {
  g.shadowColor = color;
  g.shadowBlur = cantidad;
}

const FORMAS = {
  reactor(g, cx, cy, R, t, a, color) {
    g.lineCap = 'round';
    brillo(g, color, this.mini ? 6 : 18);
    // anillo exterior
    g.strokeStyle = rgba(color, 0.35);
    g.lineWidth = R * 0.03;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    // segmentos que giran
    g.strokeStyle = color;
    g.lineWidth = R * (0.07 + a * 0.04);
    for (let i = 0; i < 10; i++) {
      const ini = t * 0.6 + (i * Math.PI * 2) / 10;
      g.beginPath(); g.arc(cx, cy, R * 0.84, ini, ini + 0.42); g.stroke();
    }
    // anillo interior al revés, punteado
    g.lineWidth = R * 0.025;
    g.strokeStyle = rgba(color, 0.8);
    g.setLineDash([R * 0.06, R * 0.05]);
    g.lineDashOffset = -t * R * 0.4;
    g.beginPath(); g.arc(cx, cy, R * 0.64, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    // rayos
    g.lineWidth = R * 0.035;
    for (let i = 0; i < 3; i++) {
      const ang = -t * 0.9 + (i * Math.PI * 2) / 3;
      g.beginPath();
      g.moveTo(cx + Math.cos(ang) * R * 0.36, cy + Math.sin(ang) * R * 0.36);
      g.lineTo(cx + Math.cos(ang) * R * 0.56, cy + Math.sin(ang) * R * 0.56);
      g.stroke();
    }
    // corazón
    const r = R * (0.27 + a * 0.1 + Math.sin(t * 2) * 0.012);
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.45, color);
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  },

  ojo(g, cx, cy, R, t, a, color) {
    const m = this.mirada;
    if (t > m.cambio) {
      m.ox = (Math.random() - 0.5) * 0.5;
      m.oy = (Math.random() - 0.5) * 0.3;
      m.cambio = t + 1 + Math.random() * 2.5;
    }
    m.x += (m.ox - m.x) * 0.08;
    m.y += (m.oy - m.y) * 0.08;
    const ciclo = t % 4.2;
    const abierto = ciclo > 4.05 ? Math.abs(ciclo - 4.125) / 0.075 : 1;
    const ancho = R * 0.98;
    const alto = R * 0.62 * Math.max(0.04, abierto);
    brillo(g, color, this.mini ? 6 : 20);
    g.save();
    g.beginPath();
    g.moveTo(cx - ancho, cy);
    g.quadraticCurveTo(cx, cy - alto * 1.6, cx + ancho, cy);
    g.quadraticCurveTo(cx, cy + alto * 1.6, cx - ancho, cy);
    g.closePath();
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fill();
    g.strokeStyle = color;
    g.lineWidth = R * 0.05;
    g.stroke();
    g.clip();
    const ix = cx + m.x * R;
    const iy = cy + m.y * R;
    const ri = R * 0.42;
    const grad = g.createRadialGradient(ix, iy, ri * 0.2, ix, iy, ri);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, rgba(color, 0.25));
    g.fillStyle = grad;
    g.beginPath(); g.arc(ix, iy, ri, 0, Math.PI * 2); g.fill();
    g.strokeStyle = rgba(color, 0.6);
    g.lineWidth = 1.5;
    for (let i = 0; i < 16; i++) {
      const ang = (i * Math.PI) / 8 + t * 0.2;
      g.beginPath();
      g.moveTo(ix + Math.cos(ang) * ri * 0.45, iy + Math.sin(ang) * ri * 0.45);
      g.lineTo(ix + Math.cos(ang) * ri * 0.9, iy + Math.sin(ang) * ri * 0.9);
      g.stroke();
    }
    g.shadowBlur = 0;
    g.fillStyle = '#02060c';
    g.beginPath(); g.arc(ix, iy, R * (0.13 + a * 0.1), 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.arc(ix - ri * 0.3, iy - ri * 0.32, R * 0.05, 0, Math.PI * 2); g.fill();
    g.restore();
  },

  onda(g, cx, cy, R, t, a, color) {
    const n = this.mini ? 32 : 56;
    const base = R * 0.42;
    brillo(g, color, this.mini ? 4 : 12);
    g.lineCap = 'round';
    g.lineWidth = Math.max(2, (R * 2 * Math.PI * 0.42) / n * 0.55);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      const v = 0.5 + 0.5 * Math.sin(t * 3 + i * 0.7) * Math.sin(t * 1.3 + i * 0.23);
      const largo = R * (0.06 + (0.12 + a * 0.6) * v);
      g.strokeStyle = rgba(color, 0.55 + 0.45 * v);
      g.beginPath();
      g.moveTo(cx + Math.cos(ang) * base, cy + Math.sin(ang) * base);
      g.lineTo(cx + Math.cos(ang) * (base + largo), cy + Math.sin(ang) * (base + largo));
      g.stroke();
    }
    g.strokeStyle = color;
    g.lineWidth = R * 0.03;
    g.beginPath(); g.arc(cx, cy, base * 0.82, 0, Math.PI * 2); g.stroke();
    // onda en medio
    g.beginPath();
    for (let x = -1; x <= 1.0001; x += 0.04) {
      const y = Math.sin(x * 9 + t * 6) * (0.05 + a * 0.22) * Math.cos(x * Math.PI / 2);
      const px = cx + x * base * 0.65;
      const py = cy + y * R;
      if (x === -1) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.lineWidth = R * 0.035;
    g.stroke();
  },

  atomo(g, cx, cy, R, t, a, color) {
    brillo(g, color, this.mini ? 5 : 16);
    const vel = 1 + a * 2.5;
    for (let k = 0; k < 3; k++) {
      const rot = (k * Math.PI) / 3 + t * 0.15;
      g.save();
      g.translate(cx, cy);
      g.rotate(rot);
      g.strokeStyle = rgba(color, 0.55);
      g.lineWidth = R * 0.025;
      g.beginPath(); g.ellipse(0, 0, R * 0.92, R * 0.32, 0, 0, Math.PI * 2); g.stroke();
      const ang = t * vel * (1 + k * 0.25) + k * 2;
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(Math.cos(ang) * R * 0.92, Math.sin(ang) * R * 0.32, R * 0.07, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    const r = R * (0.2 + a * 0.08 + Math.sin(t * 3) * 0.01);
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, rgba(color, 0.1));
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  },

  hexagono(g, cx, cy, R, t, a, color) {
    const s = R * 0.215;
    const celdas = [];
    for (let q = -2; q <= 2; q++) {
      for (let r = -2; r <= 2; r++) {
        if (Math.abs(q + r) > 2) continue;
        celdas.push([q, r]);
      }
    }
    brillo(g, color, this.mini ? 4 : 12);
    g.lineWidth = Math.max(1.5, R * 0.02);
    for (const [q, r] of celdas) {
      const x = cx + s * Math.sqrt(3) * (q + r / 2);
      const y = cy + s * 1.5 * r;
      const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
      const onda = 0.5 + 0.5 * Math.sin(t * 2.5 - d * 1.3 + q * 0.4);
      const luz = d === 0 ? 0.6 + a * 0.4 : 0.15 + onda * (0.35 + a * 0.5);
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i + Math.PI / 6;
        const px = x + Math.cos(ang) * s * 0.92;
        const py = y + Math.sin(ang) * s * 0.92;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = rgba(color, luz * 0.55);
      g.fill();
      g.strokeStyle = rgba(color, 0.4 + luz * 0.6);
      g.stroke();
    }
  },

  pixel(g, cx, cy, R, t, a, color) {
    const n = 12;
    const lado = R * 1.62;
    const p = lado / n;
    const x0 = cx - lado / 2;
    const y0 = cy - lado / 2;
    brillo(g, color, this.mini ? 4 : 14);
    g.strokeStyle = rgba(color, 0.45);
    g.lineWidth = Math.max(1.5, R * 0.025);
    g.strokeRect(x0 - p * 0.4, y0 - p * 0.4, lado + p * 0.8, lado + p * 0.8);
    const celda = (c, f, alfa = 1) => {
      g.fillStyle = rgba(color, alfa);
      g.fillRect(x0 + c * p + 1, y0 + f * p + 1, p - 2, p - 2);
    };
    // fondo tenue
    for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if ((f + c) % 2 === 0) { g.fillStyle = rgba(color, 0.05); g.fillRect(x0 + c * p + 1, y0 + f * p + 1, p - 2, p - 2); }
    const parpadeo = t % 3.6 > 3.45;
    const ojoAlto = parpadeo ? 1 : 3;
    for (let f = 0; f < ojoAlto; f++) {
      const fila = parpadeo ? 4 : 3 + f;
      [3, 4].forEach((c) => celda(c, fila));
      [7, 8].forEach((c) => celda(c, fila));
    }
    // boca: más filas cuando habla
    const abre = Math.round(a * 2.4);
    const ancho = [4, 5, 6, 7];
    if (abre === 0) {
      [3, 8].forEach((c) => celda(c, 7));
      ancho.forEach((c) => celda(c, 8));
    } else {
      for (let f = 0; f <= abre; f++) [3, ...ancho, 8].forEach((c) => celda(c, 7 + f, f === 0 || f === abre ? 1 : 0.35));
    }
    // mejillas
    celda(2, 6, 0.3); celda(9, 6, 0.3);
  },
};
