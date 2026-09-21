// Identidad en el navegador: el token de cada sala (y el último nombre usado) se guardan en localStorage.
// Puede fallar o venir vacío (ventana privada, datos borrados): todo va con try/catch y la app funciona sin esto,
// solo que hay que volver a presentarse.

export interface Identity {
  token: string;
  name: string;
}

const roomKey = (roomId: string): string => `paisano:sala:${roomId.toUpperCase()}`;
const NAME_KEY = 'paisano:nombre';

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
