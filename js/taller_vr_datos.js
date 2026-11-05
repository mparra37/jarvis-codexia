/* JARVIS · Taller VR Ghost Network: cómo se juega cada minijuego
 *
 * Lo usan la página taller-vr.html (explicaciones en voz alta, pasos y dudas frecuentes) y el Worker
 * (lo que sabe la IA). Si cambian las reglas de un juego en ../js/*.js, actualícenlas aquí.
 */

// Los reels están en el sitio de los juegos VR (ITC-VR-Games).
const VIDEOS = 'https://mparra37.github.io/ITC-VR-Games/codexia/videos/';

export const MISION_VR = {
  titulo: 'Ghost Network',
  historia: 'Ultrón se escondió en la red de agua de la ciudad. En 40 minutos, cada equipo consigue su dirección IP en tres juegos y su ubicación GPS en la misión final. La IP y el GPS se anotan en la Bitácora y son lo que llevan al reto final.',
  formato: 'Un visor Meta Quest por equipo. Quien lleva el visor es el Operador: ve el juego pero no tiene el manual. El resto del equipo tiene el Manual de campo impreso, pero no ve el juego. Solo hablando entre todos se resuelve. Las pistas solo se ganan en las rondas, no en la práctica.',
};

export const JUEGOS = [
  {
    id: 'router',
    numero: 1,
    nombre: 'Router humano',
    area: 'Redes',
    minutos: 3,
    video: VIDEOS + 'reel_router.mp4',
    pista: '3 paquetes entregados en una ronda dan el 1.º y el 2.º número de la IP de Ultrón.',
    minimo: 3,
    unidad: 'paquetes',
    explicacion: 'En Router humano, Ultrón inunda la red de la ciudad con paquetes y el Operador es el router. Cada paquete trae una dirección IP: los tres primeros números son la red, como la calle de una casa, y el último es el equipo, como el número de la casa. El Operador le dicta la red al equipo, el equipo la busca en la tabla de rutas del manual y le dice a qué lugar va: el núcleo de Ultrón, la fábrica de drones, la presa, la planta de agua, las antenas o internet. Entonces el Operador voltea, busca esa puerta y le dispara el paquete. Con tres paquetes bien entregados ganan los dos primeros números de la IP de Ultrón.',
    pasos: [
      'El Operador lee la IP del paquete: la red (3 primeros números) está en rojo.',
      'El Operador le dicta la red al equipo.',
      'El equipo busca esa red en la tabla de rutas del manual y dice la puerta.',
      'El Operador voltea, apunta a la puerta y dispara el paquete.',
    ],
    reglas: 'Ronda de 3 minutos. +1 por paquete bien entregado; al fallar o saltar hay 5 segundos de bloqueo. Desde el nivel 1 hay seis puertas: NÚCLEO, FÁBRICA, PRESA, PLANTA, ANTENAS e INTERNET. Nivel 2: aparecen redes parecidas. Nivel 3: los paquetes falsos van a CUARENTENA y las puertas cambian de lugar después de cada paquete.',
    dudas: [
      { p: '¿Qué número le dicto al equipo?', r: 'Solo la red: los tres primeros números, los que se ven en rojo. El último número (en gris) es el equipo y no importa para elegir la puerta.' },
      { p: '¿Cuándo va a CUARENTENA?', r: 'Desde el nivel 3, cuando la dirección es imposible: si alguno de sus números es mayor que 255, es un paquete falso de Ultrón y va a cuarentena.' },
      { p: 'No encontramos la red en la tabla', r: 'Revisen número por número, porque en el nivel 2 hay redes muy parecidas: 192.168.67 no es 192.168.66. Si de verdad no está en la tabla, va a INTERNET.' },
      { p: 'No encuentro la puerta', r: 'Volteen poco a poco: las seis puertas están alrededor del Operador, una arriba al frente, y cada una tiene su dibujo. En el nivel 3 cambian de lugar después de cada paquete.' },
    ],
  },
  {
    id: 'arma',
    numero: 2,
    nombre: 'Arma a Ultrón',
    area: 'Robótica',
    minutos: 5,
    video: VIDEOS + 'reel_arma.mp4',
    pista: '4 piezas bien puestas en una ronda dan el 3.er número de la IP.',
    minimo: 4,
    unidad: 'piezas',
    explicacion: 'En Arma a Ultrón atraparon un robot de Ultrón: su cuerpo está completo, pero le sacaron lo de adentro. Enfrente del Operador está el robot con el pecho abierto y ocho lugares numerados para sus piezas: el núcleo de energía, el procesador, la memoria RAM, el disco, la batería, el ventilador, el módulo de red y la tarjeta de video. Hay tres modelos y el visor no dice cuál es: el Operador describe los hombros, el emblema del pecho y de qué lado tiene el brazo cañón, y el equipo adivina el modelo con su manual. Luego el Operador toma una pieza, la describe, y el equipo le dice en qué número va según el plano de ese modelo. Con cuatro piezas bien puestas ganan el tercer número de la IP.',
    pasos: [
      'El Operador describe el robot por fuera: los hombros, el emblema del pecho y de qué lado está el brazo cañón.',
      'El equipo adivina el modelo (A, B o C) con la tabla del manual.',
      'El Operador toma una pieza (apunta y aprieta el gatillo) y la describe sin adivinar su nombre.',
      'El equipo busca su número en el plano de ese modelo y el Operador apunta a ese número.',
    ],
    reglas: 'Ronda de 5 minutos. El 1.er robot pide 4 piezas; el 2.º, 6; desde el 3.º, 7 (siempre queda una puesta). +1 por pieza bien puesta; lugar equivocado o saltar: 5 segundos de bloqueo. Al completarlo, el robot se enciende y dice qué modelo era.',
    dudas: [
      { p: '¿Cómo sabemos qué modelo es?', r: 'Por fuera: los hombros (redondos, con picos o cuadrados), el emblema del centro del pecho (círculo, triángulo o hexágono) y de qué lado tiene el brazo cañón. Las piezas que ya están puestas también ayudan: en cada modelo van en otro lugar.' },
      { p: '¿Por qué cada modelo acomoda distinto?', r: 'Por su trabajo: el Explorador lleva el módulo de red arriba para tener señal, el Guardián protege su núcleo arriba al centro y el Infiltrado esconde su núcleo abajo, donde no se ve el brillo.' },
      { p: '¿Cómo describo una pieza?', r: 'Digan lo que ven: colores, si es larga o cuadrada, si tiene ventiladores, pilas, una antena, chips negros o un círculo que brilla. El equipo compara con los dibujos del catálogo.' },
      { p: 'No encuentro las piezas', r: 'Flotan alrededor del Operador, un poco arriba de la altura de los ojos, de los dos lados. No hace falta voltear hacia atrás.' },
    ],
  },
  {
    id: 'carrera',
    numero: 3,
    nombre: 'Carrera de palabras',
    area: 'Binario',
    minutos: 5,
    video: VIDEOS + 'reel_carrera.mp4',
    pista: '3 palabras descifradas en una ronda dan el 4.º número de la IP.',
    minimo: 3,
    unidad: 'palabras',
    explicacion: 'En Carrera de palabras, Ultrón manda mensajes en binario. El Operador ve una palabra escrita con ceros y unos: cada letra es un byte, es decir, ocho bits. El Operador le dicta cada byte al equipo, el equipo busca esa letra en la tabla del manual y se la dice, y el Operador la escribe. Cada palabra trae un consejo para cuidar el agua. Con tres palabras descifradas ganan el cuarto número de la IP.',
    pasos: [
      'El Operador dicta el primer byte (8 ceros y unos) de la palabra.',
      'El equipo busca ese byte en la tabla del manual y dice la letra.',
      'El Operador escribe la letra y sigue con el siguiente byte.',
      'Al completar la palabra, lean el consejo del agua y vayan por la siguiente.',
    ],
    reglas: 'Ronda de 5 minutos. +1 por palabra; error o saltar: 5 segundos de bloqueo. Cada 5 palabras sube el nivel: palabras de 3, 4 y 5 letras.',
    dudas: [
      { p: '¿Cómo leo un byte rápido?', r: 'Díctenlo en dos partes de cuatro: por ejemplo "cero uno cero cero, cero cero cero uno". Al equipo le es más fácil buscarlo así.' },
      { p: '¿Qué es un byte?', r: 'Son ocho bits, ocho ceros y unos. Con ocho bits hay 256 combinaciones: alcanzan para todas las letras.' },
      { p: 'Nos equivocamos de letra', r: 'No pasa nada: son 5 segundos de bloqueo. Revisen que el byte se haya dictado completo, con sus ocho dígitos.' },
    ],
  },
  {
    id: 'robot',
    numero: 4,
    nombre: 'Misión final · Robot programado',
    area: 'Misión final',
    minutos: 5,
    video: VIDEOS + 'reel_robot.mp4',
    pista: 'Cada vez que Ultrón cae al agua en una ronda ganan una parte del GPS: la 1.ª vez la latitud y la 2.ª la longitud.',
    minimo: 1,
    unidad: 'caídas al agua',
    explicacion: 'En la misión final, con la IP ya hackearon el sistema de navegación de Ultrón. El Operador ve un tablero de cinco por cinco con Ultrón, pero no ve sus antenas ni la presa. El equipo tiene los doce sectores impresos con las antenas y la presa, pero no sabe dónde está Ultrón. Primero el Operador dice el número de sector y la casilla donde empieza, por ejemplo: sector tres, empieza en B5. Luego el equipo dicta una instrucción a la vez: una flecha y cuántas casillas, como dos hacia arriba. El Operador apunta a esa casilla en el tablero, siempre en línea recta como la torre del ajedrez, presiona Mover y dice listo. Si Ultrón pisa una antena o se sale, escapa. Si llega a la presa, cae al agua y ganan una parte del GPS.',
    pasos: [
      'El Operador dice el número de sector y la casilla de inicio (por ejemplo: "sector 3, B5").',
      'El equipo busca ese sector en el manual y pone una moneda en la casilla.',
      'El equipo dicta una instrucción: flecha y número de casillas (1 a 4).',
      'El Operador apunta a la casilla de destino (en línea recta, como la torre del ajedrez), presiona Mover y dice "¡LISTO!"; el equipo mueve la moneda y dicta la siguiente.',
    ],
    reglas: 'Ronda de 5 minutos. "Arriba" es la fila 1, el lado del tablero más lejos del Operador. Las columnas son letras (A a E) y las filas números (1 a 5). Si Ultrón pisa una antena o se sale del sector, escapa: se ve el sector completo y sigue otro del mismo nivel. Si llega a la presa: +1 y siguiente nivel.',
    dudas: [
      { p: '¿Dónde es arriba?', r: 'Arriba es la fila 1, el lado del tablero más lejos del Operador. Así lo ven igual en el visor y en el manual.' },
      { p: 'Ultrón se escapó', r: 'Pisó una antena o se salió del sector. Miren el sector completo que aparece para entender qué pasó y sigan con el siguiente. Usen una moneda para no perder la posición.' },
      { p: '¿Cuántas casillas puedo mover?', r: 'De 1 a 4 casillas por instrucción, en una sola dirección. Para dar vuelta, se manda otra instrucción.' },
    ],
  },
];

export const GUION_VR = [
  { min: 0, titulo: 'Bienvenida', di: 'Bienvenidos a Ghost Network. Ultrón se escondió en la red de agua de la ciudad. En los próximos cuarenta minutos van a conseguir su dirección IP y su ubicación GPS. Una persona lleva el visor: el Operador. Los demás tienen el manual. Nadie puede resolverlo solo.', accion: 'Pongan los videos de los juegos.' },
  { min: 5, titulo: 'Equipos y visores', di: 'Elijan quién empieza como Operador. En el visor, elijan su número de equipo y toquen Nuevo equipo. Tengan a la mano la Bitácora y los manuales.', accion: 'Repartir Bitácora y manuales.' },
  { min: 8, titulo: 'Router humano', di: 'Primer juego: Router humano. Tres minutos. Ultrón inunda la red: manden cada paquete a su lugar. Necesitan tres paquetes bien entregados para ganar los dos primeros números de la IP.', juego: 'router' },
  { min: 14, titulo: 'Arma a Ultrón', di: 'Segundo juego: Arma a Ultrón. Cinco minutos. Le sacaron lo de adentro: reconéctenlo. Primero adivinen qué modelo es, por sus hombros, su emblema y el lado del cañón. Con cuatro piezas bien puestas ganan el tercer número de la IP. Cambien de Operador.', juego: 'arma' },
  { min: 21, titulo: 'Carrera de palabras', di: 'Tercer juego: Carrera de palabras. Cinco minutos. Tres palabras en binario les dan el cuarto número de la IP. Cambien de Operador.', juego: 'carrera' },
  { min: 28, titulo: 'Misión final', di: 'Misión final. Con la IP ya hackearon a Ultrón. Llévenlo hasta la presa: la primera vez que caiga al agua ganan la latitud y la segunda, la longitud. Cinco minutos.', juego: 'robot' },
  { min: 35, titulo: 'Cierre', di: 'Anoten en la Bitácora la IP y el GPS de Ultrón: los van a necesitar en el reto final. Y antes de irse: ¿qué consejo del agua van a cumplir en casa?', accion: 'Registrar los resultados de cada equipo.' },
];
