// Catálogo de personajes: 12 retratos (6 hombres y 6 mujeres de época), cada uno con su nombre fijo. Los retratos son
// imágenes generadas para el juego (recortadas de `prototipos/personajes.png`), con la ropa en cada color de asiento:
// `public/personajes/<id>-<color>.webp` (el rojo del dibujo original recoloreado; el blanco, un gris cálido para que se vea
// sobre el fondo crema). El color de asiento (la ropa, el aro del avatar y las piezas) depende de la posición en la mesa, no
// del personaje: así dos personas pueden elegir el mismo personaje sin confundirse en el tablero.

export interface Character {
  id: string;
  /** Nombre fijo: es el del bot que sale con este retrato (en la mesa local y en línea, el del asiento por defecto). */
  name: string;
}

export const CHARACTERS: Character[] = [
  { id: 'juan', name: 'Juan' },
  { id: 'manuel', name: 'Manuel' },
  { id: 'jacinto', name: 'Jacinto' },
  { id: 'jose', name: 'José' },
  { id: 'eusebio', name: 'Eusebio' },
  { id: 'leandro', name: 'Leandro' },
  { id: 'manuela', name: 'Manuela' },
  { id: 'remedios', name: 'Remedios' },
  { id: 'juana', name: 'Juana' },
  { id: 'encarnacion', name: 'Encarnación' },
  { id: 'mercedes', name: 'Mercedes' },
  { id: 'francisca', name: 'Francisca' },
];

export const DEFAULT_CHARACTER_ID = CHARACTERS[0].id;

/** Elenco de la mesa local y de las salas online (por asiento), que no tienen selector. */
export const DEFAULT_CAST = ['juan', 'manuela', 'jacinto', 'mercedes'];

export const characterById = (id: string | null | undefined): Character | undefined => CHARACTERS.find((c) => c.id === id);

/** Colores de asiento con retrato (los `id` de `SEAT_COLORS` en `board/markup.js`). */
export const PORTRAIT_COLORS = ['red', 'blue', 'orange', 'white'];

/** Ruta del retrato con la ropa del color de asiento `color`. */
export const portraitURL = (id: string, color = 'red'): string => `/personajes/${id}-${PORTRAIT_COLORS.includes(color) ? color : 'red'}.webp`;

/** El retrato listo para meter en el HTML de la mesa (va dentro de un `.av` redondo con el aro del color del asiento). */
export const portraitHTML = (id: string, color?: string): string => `<img src="${portraitURL(id, color)}" alt="" draggable="false">`;

/**
 * Los personajes de los bots en la partida contra bots: `count` distintos entre sí, sin el tuyo ni uno que se llame como vos
 * (así no hace falta «… (bot)»). El nombre de cada bot es el de su retrato.
 */
export function drawBotCharacters(count: number, myId: string, myName: string, rng: () => number = Math.random): Character[] {
  const plain = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); // «Jose» también tapa a José
  const pool = CHARACTERS.filter((c) => c.id !== myId && plain(c.name) !== plain(myName));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
