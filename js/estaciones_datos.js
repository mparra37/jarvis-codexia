/* JARVIS · ayuda para cada estación de CODEXIA
 *
 * La usan la app (pistas que funcionan sin internet) y el Worker (lo que sabe la IA de cada taller).
 * Las pistas explican conceptos y dónde buscar, NUNCA la respuesta. Si un taller cambia, actualicen
 * aquí su resumen, sus niveles y sus pistas (y vuelvan a desplegar el Worker).
 */
import { JUEGOS, MISION_VR } from './taller_vr_datos.js';

export const AYUDA_ESTACIONES = {
  movil: {
    id: 'movil',
    nombre: 'Desarrollo móvil',
    reto: 'Field Scanner',
    pieza: 'Protocolo final',
    url: '',
    resumen: 'Construyen una herramienta móvil para identificar dispositivos auténticos y separar las señales reales de los señuelos de Ultrón.',
    conceptos: [
      { t: 'App móvil', d: 'Una app es un programa que corre en el celular y puede usar sus sensores: la cámara, el GPS, el micrófono o el bluetooth.' },
      { t: 'Señal o señuelo', d: 'Un dispositivo auténtico cumple todas las reglas; un señuelo falla en al menos una. Hagan una lista de lo que debe cumplir uno auténtico y revisen cada punto.' },
      { t: 'Condicionales', d: 'Una app decide con reglas del tipo si pasa esto, entonces haz aquello. Si el dato coincide, es auténtico; si no, es señuelo.' },
      { t: 'Probar', d: 'Programar es probar: usen un caso que saben que es auténtico y otro que saben que es señuelo, y revisen que la app los distinga.' },
    ],
    pistas: [
      'Antes de programar, escriban en papel qué hace que un dispositivo sea auténtico.',
      'Prueben su herramienta con un caso que ya saben que es auténtico y con uno que saben que es señuelo.',
      'Si algo no funciona, cambien una sola cosa a la vez y vuelvan a probar.',
      'Lean con calma los mensajes de error: casi siempre dicen en qué línea o en qué bloque está el problema.',
    ],
    preguntas: ['¿Qué es una app móvil?', '¿Qué es un condicional?', '¿Cómo pruebo que mi app funciona?'],
  },

  algoritmos: {
    id: 'algoritmos',
    nombre: 'Algoritmos',
    reto: 'Project Icarus · Enjambre de satélites',
    pieza: 'Debilidad',
    url: 'https://dizzytlacuache.github.io/pso-js/',
    resumen: 'Comandan un enjambre de satélites que busca un depósito de vibranio antes que Ultrón. Usan PSO (optimización por enjambre de partículas): cada satélite solo lee la radiación en su posición, recuerda su mejor lectura, y todo el enjambre comparte la mejor lectura de todos.',
    conceptos: [
      { t: '¿Qué es PSO?', d: 'Es un método de búsqueda inspirado en las parvadas de pájaros y los bancos de peces. Muchas partículas simples exploran a la vez, comparten lo que encuentran y juntas llegan al mejor lugar.' },
      { t: 'Inercia', d: 'La inercia hace que el satélite siga en la dirección que ya llevaba. Con inercia alta explora más lejos; con inercia baja se calma y afina su búsqueda más rápido.' },
      { t: 'Cognitivo', d: 'El componente cognitivo jala al satélite hacia el mejor lugar que él mismo ha encontrado: su propia memoria.' },
      { t: 'Social', d: 'El componente social jala al satélite hacia el mejor lugar que ha encontrado todo el enjambre: lo que aprendió el equipo.' },
      { t: 'La fórmula', d: 'Nueva velocidad igual a inercia por velocidad, más c1 por un número al azar por la distancia a mi mejor posición, más c2 por otro número al azar por la distancia a la mejor posición del enjambre.' },
      { t: 'En la vida real', d: 'Los algoritmos de enjambre se usan para encontrar buenas soluciones cuando hay demasiadas opciones para probarlas todas: rutas, diseños de antenas o ajustar redes neuronales.' },
    ],
    pistas: [
      'Cambien un solo parámetro a la vez y anoten cuánto tarda el enjambre en localizar el vibranio.',
      'Comparen inercia baja contra inercia alta: ¿cuál explora más? ¿cuál se queda quieto más rápido?',
      'Prueben poniendo el social en cero y luego el cognitivo en cero. ¿Qué pasa cuando los satélites no comparten información?',
      'Prueben pocos satélites contra muchos. Más satélites encuentran mejor, pero cada uno cuesta tiempo de cómputo.',
      'Presionen Restart varias veces: una buena combinación funciona sin importar dónde quede escondido el vibranio.',
    ],
    preguntas: ['¿Qué es PSO?', '¿Para qué sirve la inercia?', '¿Qué pasa si el social es cero?', '¿Dónde se usa PSO en la vida real?'],
  },

  ciber: {
    id: 'ciber',
    nombre: 'Ciberseguridad',
    reto: 'Zero Trust · Operación Código Fantasma',
    pieza: 'Acceso',
    url: 'https://codexia-cybersecurity.onrender.com/',
    resumen: 'Cinco retos contra reloj: en cada uno hay una clave escondida en el código de la página. Necesitan una laptop: el código se ve con F12 (Inspeccionar) o con Ctrl+U (ver código fuente).',
    niveles: [
      { t: 'Reto 1 · Comentario HTML', pistas: ['En HTML, lo que va entre <!-- y --> es un comentario: el navegador no lo muestra, pero sigue en el código.', 'Abran el código fuente con Ctrl+U, o la pestaña Elements con F12, y busquen <!-- con Ctrl+F.'] },
      { t: 'Reto 2 · Elemento oculto', pistas: ['Un elemento puede estar en el HTML aunque no se vea: con display none, visibility hidden, el atributo hidden o letras del mismo color que el fondo.', 'En la pestaña Elements, recorran las etiquetas del reto: al pasar el mouse se marca cada una en la página. Busquen la que no aparece.'] },
      { t: 'Reto 3 · Variable CSS', pistas: ['Las variables de CSS empiezan con dos guiones, por ejemplo --color-fondo, y casi siempre se definen en :root.', 'Con F12, seleccionen la etiqueta html o body y revisen el panel Styles, o abran el archivo .css en la pestaña Sources.'] },
      { t: 'Reto 4 · Fragmentos JavaScript', pistas: ['La clave puede estar partida en varios pedazos dentro del JavaScript, en distintas variables o funciones.', 'Revisen la pestaña Sources. En la Console pueden escribir el nombre de una variable para ver su valor, y unir textos con el signo más.'] },
      { t: 'Reto 5 · Código Base64', pistas: ['Base64 escribe datos con letras, números, más y diagonal, y muchas veces termina en uno o dos signos de igual.', 'En la Console del navegador, la función atob con el texto entre comillas lo convierte de regreso a texto normal.'] },
    ],
    conceptos: [
      { t: 'Zero Trust', d: 'Zero Trust significa nunca confiar y siempre verificar: ningún usuario ni aparato tiene acceso solo por estar dentro de la red.' },
      { t: 'Herramientas de desarrollador', d: 'En Chrome o Edge se abren con F12, o con clic derecho y Inspeccionar. Elements muestra el HTML, Styles el CSS, Sources los archivos y Console permite escribir JavaScript.' },
      { t: 'El navegador no guarda secretos', d: 'Todo lo que llega al navegador se puede ver con F12. Por eso las contraseñas y llaves nunca deben ir en el código de una página.' },
      { t: 'Base64 no es cifrado', d: 'Base64 solo cambia la forma de escribir los datos; cualquiera lo puede regresar a texto normal. Cifrar de verdad necesita una llave secreta.' },
    ],
    preguntas: ['¿Cómo abro las herramientas de desarrollador?', '¿Qué es Base64?', '¿Qué es Zero Trust?', 'No encontramos la clave, ¿dónde más buscamos?'],
  },

  redes: {
    id: 'redes',
    nombre: 'Redes',
    reto: 'Ghost Network · Realidad virtual',
    pieza: 'Ubicación',
    url: 'https://mparra37.github.io/ITC-VR-Games/codexia/',
    resumen: `${MISION_VR.historia} ${MISION_VR.formato}`,
    niveles: JUEGOS.map((j) => ({ t: j.nombre, pistas: j.dudas.slice(0, 3).map((d) => `${d.p} ${d.r}`) })),
    conceptos: [
      { t: 'Dirección IP', d: 'Una dirección IP es como la dirección de una casa: los primeros números son la red, como la calle, y el último es el equipo, como el número de la casa. Cada número va de 0 a 255.' },
      { t: 'Router', d: 'Un router lee la dirección de cada paquete y decide por qué puerta mandarlo, usando una tabla de rutas.' },
      { t: 'Bit y byte', d: 'Un bit es un cero o un uno. Ocho bits forman un byte, y con un byte se escribe una letra.' },
      { t: 'GPS', d: 'Las coordenadas GPS son dos números: la latitud, que dice qué tan al norte o al sur, y la longitud, que dice qué tan al este o al oeste.' },
    ],
    preguntas: ['¿Qué es una dirección IP?', '¿Qué es un byte?', '¿Cómo funciona un router?'],
  },
};

export const ORDEN_ESTACIONES = ['movil', 'algoritmos', 'ciber', 'redes'];
