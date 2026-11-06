/* JARVIS · error con código HTTP (lo usan el Worker y las dos formas de llamar a la IA) */
export class ErrorHttp extends Error {
  constructor(status, mensaje, extra = {}) {
    super(mensaje);
    this.status = status;
    this.extra = extra;
  }
}
