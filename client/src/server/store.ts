// Almacén de salas. La interfaz es lo que necesita el servicio; hoy hay una implementación en memoria (desarrollo y tests)
// y más adelante otra sobre Upstash Redis con las mismas operaciones.

import type { Room } from './room';

export interface RoomStore {
  get(id: string): Promise<Room | null>;
  /** Crea la sala; false si ya existe una con ese id. */
  create(room: Room): Promise<boolean>;
  /** Guarda la sala solo si la versión guardada sigue siendo `expectedVersion`; false si alguien la cambió antes. */
  save(room: Room, expectedVersion: number): Promise<boolean>;
}

// Se copia al entrar y al salir (como haría un almacén externo): nadie comparte objetos con lo guardado.
const copy = (room: Room): Room => JSON.parse(JSON.stringify(room)) as Room;

const globalRooms = globalThis as { __paisanoRooms?: Map<string, Room> };

export class MemoryStore implements RoomStore {
  // Por defecto en `globalThis`: el modo desarrollo de Next recarga módulos y las salas no deben perderse.
  constructor(private rooms: Map<string, Room> = (globalRooms.__paisanoRooms ??= new Map())) {}

  async get(id: string): Promise<Room | null> {
    const room = this.rooms.get(id);
    return room ? copy(room) : null;
  }

  async create(room: Room): Promise<boolean> {
    if (this.rooms.has(room.id)) return false;
    this.rooms.set(room.id, copy(room));
    return true;
  }

  async save(room: Room, expectedVersion: number): Promise<boolean> {
    const stored = this.rooms.get(room.id);
    if (!stored || stored.version !== expectedVersion) return false;
    this.rooms.set(room.id, copy(room));
    return true;
  }
}
