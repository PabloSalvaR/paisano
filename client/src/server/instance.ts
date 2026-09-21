// El almacén que usan los Route Handlers. Hoy en memoria (sirve en desarrollo, no en Vercel: cada función tiene su
// propia memoria). Más adelante acá se elige Upstash según las variables de entorno.

import { MemoryStore, type RoomStore } from './store';

export const store: RoomStore = new MemoryStore();
