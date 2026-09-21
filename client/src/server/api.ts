// Capa HTTP del servicio de salas: lee la petición, llama al servicio y arma la respuesta. Los Route Handlers de Next
// (src/app/api/rooms/**) son una línea cada uno y delegan acá, así todo se prueba con Request/Response sin levantar Next.
//
// El token viaja en `Authorization: Bearer <token>` (no en la URL, para que no quede en registros ni historiales).

import { RESOURCES } from '../engine';
import type { Command, Hand, Resource } from '../engine';
import { addBot, createRoom, getView, joinRoom, startGame, submitCommand, type Res, type ServiceError } from './rooms';
import type { RoomStore } from './store';

const STATUS: Partial<Record<ServiceError['code'], number>> = {
  'room-not-found': 404,
  'not-in-room': 401,
  'not-host': 403,
  conflict: 409,
};

function respond<T>(res: Res<T>): Response {
  const headers = { 'Cache-Control': 'no-store' }; // el estado de una sala cambia todo el tiempo
  if (res.ok) return Response.json(res.value, { headers });
  return Response.json({ error: res.error }, { status: STATUS[res.error.code] ?? 400, headers });
}

const badRequest = (message: string): Response => respond({ ok: false, error: { code: 'invalid-command', message } });

const tokenOf = (req: Request): string => /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1] ?? '';
const roomIdOf = (id: string): string => id.trim().toUpperCase(); // el código se puede escribir en minúsculas
const readBody = (req: Request): Promise<Record<string, unknown> | null> =>
  req.json().then((b: unknown) => (b && typeof b === 'object' ? (b as Record<string, unknown>) : null), () => null);

// ---------------------------------------------------------------- validación de comandos
// El motor valida las reglas; acá solo se asegura la FORMA (tipos y campos), porque llega de la red.
// El campo `player` no se usa: el servidor lo reemplaza por el asiento del token.

const isInt = (x: unknown): x is number => Number.isInteger(x);
const isResource = (x: unknown): x is Resource => RESOURCES.includes(x as Resource);

export function parseCommand(raw: unknown): Command | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const player = 0;
  switch (c.type) {
    case 'placeSettlement':
    case 'buildSettlement':
    case 'buildCity':
      return isInt(c.vertex) ? { type: c.type, player, vertex: c.vertex } : null;
    case 'placeRoad':
    case 'buildRoad':
      return isInt(c.edge) ? { type: c.type, player, edge: c.edge } : null;
    case 'moveRobber':
      return isInt(c.tile) ? { type: 'moveRobber', player, tile: c.tile } : null;
    case 'steal':
      return isInt(c.victim) ? { type: 'steal', player, victim: c.victim } : null;
    case 'discard': {
      if (!c.cards || typeof c.cards !== 'object') return null;
      const cards: Partial<Hand> = {};
      for (const [k, v] of Object.entries(c.cards)) {
        if (!isResource(k) || !isInt(v) || v < 0) return null;
        cards[k] = v;
      }
      return { type: 'discard', player, cards };
    }
    case 'bankTrade':
      return isResource(c.give) && isResource(c.get) ? { type: 'bankTrade', player, give: c.give, get: c.get } : null;
    case 'rollDice':
    case 'endTurn':
      return { type: c.type, player };
    default:
      return null;
  }
}

// ---------------------------------------------------------------- endpoints

export const api = {
  /** POST /api/rooms  { name } → { roomId, token } */
  async create(store: RoomStore, req: Request): Promise<Response> {
    const body = await readBody(req);
    return respond(await createRoom(store, typeof body?.name === 'string' ? body.name : ''));
  },

  /** POST /api/rooms/:id/join  { name } → { token, seat } */
  async join(store: RoomStore, req: Request, id: string): Promise<Response> {
    const body = await readBody(req);
    return respond(await joinRoom(store, roomIdOf(id), typeof body?.name === 'string' ? body.name : ''));
  },

  /** POST /api/rooms/:id/bots → vista (solo el anfitrión, en el lobby) */
  async addBot(store: RoomStore, req: Request, id: string): Promise<Response> {
    return respond(await addBot(store, roomIdOf(id), tokenOf(req)));
  },

  /** POST /api/rooms/:id/start → vista (solo el anfitrión) */
  async start(store: RoomStore, req: Request, id: string): Promise<Response> {
    return respond(await startGame(store, roomIdOf(id), tokenOf(req)));
  },

  /** POST /api/rooms/:id/command  { command } → vista con los eventos que produjo */
  async command(store: RoomStore, req: Request, id: string): Promise<Response> {
    const body = await readBody(req);
    const cmd = parseCommand(body?.command);
    if (!cmd) return badRequest('El comando no tiene un formato válido.');
    return respond(await submitCommand(store, roomIdOf(id), tokenOf(req), cmd));
  },

  /** GET /api/rooms/:id?since=N → vista con los eventos posteriores a la versión N */
  async view(store: RoomStore, req: Request, id: string): Promise<Response> {
    const since = Number(new URL(req.url).searchParams.get('since') ?? 0);
    return respond(await getView(store, roomIdOf(id), tokenOf(req), Number.isInteger(since) && since > 0 ? since : 0));
  },
};
