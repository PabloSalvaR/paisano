// Identidad en el navegador: el token de cada sala (y el último nombre usado) se guardan en localStorage.
// Puede fallar o venir vacío (ventana privada, datos borrados): todo va con try/catch y la app funciona sin esto,
// solo que hay que volver a presentarse.

import { DEFAULT_CHARACTER_ID } from './characters';

export interface Identity {
  token: string;
  name: string;
}

const roomKey = (roomId: string): string => `paisano:sala:${roomId.toUpperCase()}`;
const NAME_KEY = 'paisano:nombre';
const CHARACTER_KEY = 'paisano:personaje';
const COLOR_KEY = 'paisano:color';
const PLAYERS_KEY = 'paisano:jugadores';
/** El id de `SEAT_COLORS[0]` en `board.js` (rojo): mismo valor por defecto que ya tenía la persona antes de poder elegir. */
export const DEFAULT_COLOR_ID = 'red';

export function loadIdentity(roomId: string, storage: Pick<Storage, 'getItem'> | null = safeStorage()): Identity | null {
  try {
    const raw = storage?.getItem(roomKey(roomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    return typeof parsed.token === 'string' && typeof parsed.name === 'string' ? { token: parsed.token, name: parsed.name } : null;
  } catch {
    return null;
  }
}

export function saveIdentity(roomId: string, identity: Identity, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(roomKey(roomId), JSON.stringify(identity));
    storage?.setItem(NAME_KEY, identity.name);
  } catch {
    /* sin almacenamiento: se sigue jugando esta sesión */
  }
}

/** Guarda solo el nombre (para la partida contra bots, que no tiene sala ni token). */
export function saveName(name: string, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(NAME_KEY, name);
  } catch {
    /* sin almacenamiento: se sigue jugando */
  }
}

export function forgetIdentity(roomId: string, storage: Pick<Storage, 'removeItem'> | null = safeStorage()): void {
  try {
    storage?.removeItem(roomKey(roomId));
  } catch {
    /* nada que hacer */
  }
}

export function lastName(storage: Pick<Storage, 'getItem'> | null = safeStorage()): string {
  try {
    return storage?.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

/** El personaje elegido para el avatar (solo partida contra bots, por ahora): se guarda junto con el nombre. */
export function saveCharacter(id: string, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(CHARACTER_KEY, id);
  } catch {
    /* sin almacenamiento: se sigue jugando */
  }
}

export function lastCharacter(storage: Pick<Storage, 'getItem'> | null = safeStorage()): string | null {
  try {
    return storage?.getItem(CHARACTER_KEY) ?? null;
  } catch {
    return null;
  }
}

/** El color de asiento elegido (solo partida contra bots, por ahora): se guarda junto con el nombre y el personaje. */
export function saveColor(id: string, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(COLOR_KEY, id);
  } catch {
    /* sin almacenamiento: se sigue jugando */
  }
}

export function lastColor(storage: Pick<Storage, 'getItem'> | null = safeStorage()): string | null {
  try {
    return storage?.getItem(COLOR_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Cuántos juegan contra bots (3 o 4): se guarda junto con el nombre, el personaje y el color. */
export function savePlayerCount(n: number, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(PLAYERS_KEY, String(n));
  } catch {
    /* sin almacenamiento: se sigue jugando */
  }
}

/** La última cantidad elegida; 4 (el juego base) si no hay o no es válida. */
export function lastPlayerCount(storage: Pick<Storage, 'getItem'> | null = safeStorage()): number {
  try {
    return storage?.getItem(PLAYERS_KEY) === '3' ? 3 : 4;
  } catch {
    return 4;
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // el acceso mismo puede lanzar (permisos bloqueados)
  }
}

/** Para React: el último nombre usado en este navegador ("" en el servidor y hasta que se lee). Sin suscripciones: no cambia solo. */
export const nameStore = {
  subscribe: (): (() => void) => () => {},
  get: (): string => lastName(),
  getServer: (): string => '',
};

/** Para React: el último personaje elegido (o `DEFAULT_CHARACTER_ID` la primera vez). Mismo patrón que `nameStore`. */
export const characterStore = {
  subscribe: (): (() => void) => () => {},
  get: (): string => lastCharacter() ?? DEFAULT_CHARACTER_ID,
  getServer: (): string => DEFAULT_CHARACTER_ID,
};

/** Para React: el último color elegido (o `DEFAULT_COLOR_ID` la primera vez). Mismo patrón que `nameStore`. */
export const colorStore = {
  subscribe: (): (() => void) => () => {},
  get: (): string => lastColor() ?? DEFAULT_COLOR_ID,
  getServer: (): string => DEFAULT_COLOR_ID,
};

/** Para React: la última cantidad de jugadores elegida contra bots (4 la primera vez). Mismo patrón que `nameStore`. */
export const playerCountStore = {
  subscribe: (): (() => void) => () => {},
  get: (): number => lastPlayerCount(),
  getServer: (): number => 4,
};
