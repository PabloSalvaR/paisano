// Catálogo de personajes elegibles como avatar: 4 gauchos (con sombrero) y 4 criollas (sin sombrero), cada uno con su
// propio tono de piel y de pelo para distinguirse. El color de asiento (el poncho del dibujo, y las piezas del tablero)
// es aparte y depende de la posición en la mesa, no del personaje elegido: así dos personas pueden elegir el mismo
// personaje sin confundirse en el tablero. Arte propio, dibujado a mano en `board.js` (ver `avatarSVG`).

export interface Character {
  id: string;
  label: string;
  skin: string;
  hair: string;
  woman: boolean; // define de qué lista sale el nombre de un bot con este personaje
  hat: boolean; // gaucho con sombrero
  mustache?: boolean;
  headscarf?: boolean; // criolla con pañuelo en vez de pelo suelto
}

export const CHARACTERS: Character[] = [
  { id: 'tomas', label: 'Tomás', skin: '#f1c9a5', hair: '#5a3a22', woman: false, hat: true },
  { id: 'lucia', label: 'Lucía', skin: '#c98f66', hair: '#2b2118', woman: true, hat: false },
  { id: 'mateo', label: 'Mateo', skin: '#8d5a3b', hair: '#2b2118', woman: false, hat: true },
  { id: 'sofia', label: 'Sofía', skin: '#f4d3b5', hair: '#a3402b', woman: true, hat: false },
  { id: 'facundo', label: 'Facundo', skin: '#6b4226', hair: '#7a766e', woman: false, hat: true, mustache: true },
  { id: 'ramon', label: 'Ramón', skin: '#e0ad7c', hair: '#7a4a20', woman: false, hat: true, mustache: true },
  { id: 'rosario', label: 'Rosario', skin: '#a9714a', hair: '#241c12', woman: true, hat: false, headscarf: true },
  { id: 'milagros', label: 'Milagros', skin: '#b97a4f', hair: '#3d2410', woman: true, hat: false },
];

// Nombres de los bots contra los que se juega en `/jugar/bots`: cada bot saca un personaje al azar y después un nombre
// de la lista que corresponde a ese personaje (los rótulos de arriba son solo del selector y de la mesa local).
export const BOT_NAMES = {
  men: ['Juan', 'Manuel', 'Jacinto', 'José', 'Eusebio', 'Leandro'],
  women: ['Manuela', 'Remedios', 'Juana', 'Encarnación', 'Mercedes', 'Francisca'],
};

export const DEFAULT_CHARACTER_ID = CHARACTERS[0].id;

export const characterById = (id: string | null | undefined): Character | undefined => CHARACTERS.find((c) => c.id === id);
