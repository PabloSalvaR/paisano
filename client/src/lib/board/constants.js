// Medidas del tablero y datos fijos (terrenos, recursos y cartas de desarrollo) que comparten la escena y la interfaz.

export const SQ3 = Math.sqrt(3);
export const HEX_R = 1;           // circunradio de la grilla: las casillas se tocan (el bisel deja la línea divisoria)
export const TILE_TOP = 0.4;      // altura de la cara superior de las casillas
export const DECOR_HEIGHT = 0.38; // escala vertical del decorado (para no tapar fichas ni piezas)
export const DICE_BOUNCE = 0.12;  // altura del salto de la ficha al salir su número
export const WATER_Y = 0.16;      // nivel del mar
export const RC = 6.4;            // radio del marco (hexágono grande, vértices en ±x)
// Contorno de las piezas: copia apenas más grande dibujada solo por las caras traseras (ver outlineFor en pieces.js). Si se
// cambia el grosor, revisar EDGE_CLEAR y VERT_CLEAR del decorado (espacio reservado alrededor de caminos y esquinas).
export const OUTLINE_T = 0.008;

// Los nombres de terreno del motor coinciden con estas claves. `ui`: color del recurso en la interfaz.
export const TERRAINS = {
  forest:    { name: 'Bosque',    res: 'Madera',  ui: '#3f8f45' },
  pasture:   { name: 'Llano',     res: 'Vaca',   ui: '#a7d15c' },
  fields:    { name: 'Campo',     res: 'Maíz',    ui: '#e8bf45' },
  hills:     { name: 'Barro',     res: 'Ladrillo', ui: '#c96a3b' },
  mountains: { name: 'Cantera',   res: 'Piedra',  ui: '#8d949c' },
  desert:    { name: 'Desierto',  res: 'Nada',    ui: '#e3c78d' }
};
// Orden de los recursos en el banner, los paneles y las ofertas.
export const HAND_KINDS = ['forest', 'hills', 'pasture', 'fields', 'mountains'];

// Cartas de desarrollo (nombres propios). Lo que se puede jugar y cuándo lo decide el motor (legalActions); acá solo se explica.
export const DEV_ORDER = ['knight', 'monopoly', 'yearOfPlenty', 'roadBuilding', 'victoryPoint'];
export const DEV = {
  knight: { name: 'Gaucho', desc: 'Mové el ladrón y robá una carta.', play: 'playKnight' },
  monopoly: { name: 'Acopio', desc: 'Elegí un recurso: todos te entregan el que tengan.', play: 'playMonopoly' },
  yearOfPlenty: { name: 'Buena cosecha', desc: 'Tomá 2 recursos del banco (o 1 si queda una sola carta).', play: 'playYearOfPlenty' },
  roadBuilding: { name: 'Empedrado', desc: 'Poné 2 caminos gratis.', play: 'playRoadBuilding' },
  victoryPoint: { name: 'Punto de victoria', desc: 'Vale 1 punto. Queda oculta hasta que ganes.', play: null }
};
