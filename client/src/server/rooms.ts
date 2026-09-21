// Servicio de salas: crear, unirse, empezar, jugar y consultar. Funciones sobre un RoomStore, sin nada de Next:
// los Route Handlers son envoltorios finos y todo esto se prueba con Vitest y el almacén en memoria.
//
// Identidad: cada navegador guarda un token secreto; la sala solo guarda su hash. El jugador de cada comando
// sale del asiento del token, nunca de lo que diga el cliente.

import { createHash, randomInt, randomUUID } from 'node:crypto';
import { randomBot, type Bot } from '../bots/random';
import { applyCommand, createGame, legalActions } from '../engine';
import type { Command, ErrorCode, GameConfig, GameEvent, Rng } from '../engine';
import { LOG_LIMIT, MAX_SEATS, MIN_SEATS, type Room } from './room';
import type { RoomStore } from './store';
import { roomView, type RoomView } from './view';

export type RoomErrorCode =
  | 'room-not-found'
  | 'not-in-room'
  | 'not-host'
  | 'room-full'
  | 'already-started'
  | 'not-started'
  | 'not-enough-players'
  | 'invalid-name'
  | 'invalid-command'
  | 'name-taken'
  | 'conflict';

export interface ServiceError {
  code: ErrorCode | RoomErrorCode;
  message: string;
}

export type Res<T> = { ok: true; value: T } | { ok: false; error: ServiceError };

const fail = (code: ServiceError['code'], message: string): { ok: false; error: ServiceError } => ({ ok: false, error: { code, message } });
const ok = <T>(value: T): Res<T> => ({ ok: true, value });

const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin letras ni números que se confunden (0/O, 1/I/L)
const MAX_TRIES = 4;
const MAX_NAME = 20;
const MAX_BOT_STEPS = 2000; // tope de jugadas seguidas de bots en una petición (una partida entera cabe de sobra)

/** Opciones que se inyectan en los tests: semilla y reglas de la partida, azar y elección de los bots. */
export interface PlayOptions {
  seed?: number;
  config?: Partial<GameConfig>;
  rng?: Rng;
  bot?: Bot;
}

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
const newRoomId = (): string => Array.from({ length: 6 }, () => ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]).join('');
const newSeed = (): number => randomInt(1, 2 ** 31);

function cleanName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  return name.length >= 1 && name.length <= MAX_NAME ? name : null;
}

/** Índice del asiento al que pertenece el token, o -1. */
function seatOf(room: Room, token: string): number {
  if (!token) return -1;
  const h = hashToken(token);
  return room.seats.findIndex((s) => s.tokenHash === h);
}

/** Anota los eventos en el log de la sala con su versión y descarta los más viejos. */
function record(room: Room, events: GameEvent[]): void {
  room.log.push(...events.map((event) => ({ version: room.version, event })));
  if (room.log.length > LOG_LIMIT) room.log.splice(0, room.log.length - LOG_LIMIT);
}

/**
 * Mientras le toque a un bot, juega por él con las mismas acciones legales que tendría un jugador.
 * Corre dentro de la misma petición que dejó el turno en manos del bot (en Vercel no hay proceso en segundo plano).
 */
function playBots(room: Room, opts: PlayOptions): void {
  const bot = opts.bot ?? randomBot;
  const rng = opts.rng ?? Math.random;
  for (let i = 0; i < MAX_BOT_STEPS && room.state && room.state.phase.kind !== 'finished' && room.seats[room.state.turn].bot; i++) {
    const me = room.state.turn;
    const legal = legalActions(room.state, me);
    if (!legal.length) return;
    const result = applyCommand(room.state, bot({ me, legal, hand: room.state.players[me].hand }, rng));
    if (!result.ok) return; // un bot que se equivoca no debe trabar la sala: se corta acá
    room.state = result.state;
    record(room, result.events);
  }
}

/**
 * Lee la sala, le sube la versión, corre `change` (que la modifica y puede devolver un error) y guarda solo si nadie
 * la tocó mientras tanto. Si hubo choque, relee y repite: el cambio se vuelve a validar contra el estado nuevo.
 */
async function update(store: RoomStore, id: string, change: (room: Room) => ServiceError | null): Promise<Res<{ room: Room; before: number }>> {
  for (let i = 0; i < MAX_TRIES; i++) {
    const room = await store.get(id);
    if (!room) return fail('room-not-found', 'La sala no existe.');
    const before = room.version;
    room.version = before + 1;
    const error = change(room);
    if (error) return { ok: false, error };
    if (await store.save(room, before)) return ok({ room, before });
  }
  return fail('conflict', 'La sala está muy ocupada, probá de nuevo.');
}

// ---------------------------------------------------------------- lobby

export async function createRoom(store: RoomStore, hostName: string): Promise<Res<{ roomId: string; token: string }>> {
  const name = cleanName(hostName);
  if (!name) return fail('invalid-name', `El nombre tiene que tener entre 1 y ${MAX_NAME} letras.`);
  const token = randomUUID();
  for (let i = 0; i < MAX_TRIES; i++) {
    const room: Room = { id: newRoomId(), status: 'lobby', seats: [{ name, tokenHash: hashToken(token), bot: false }], state: null, log: [], version: 1 };
    if (await store.create(room)) return ok({ roomId: room.id, token });
  }
  return fail('conflict', 'No se pudo crear la sala, probá de nuevo.');
}

export async function joinRoom(store: RoomStore, roomId: string, playerName: string): Promise<Res<{ token: string; seat: number }>> {
  const name = cleanName(playerName);
  if (!name) return fail('invalid-name', `El nombre tiene que tener entre 1 y ${MAX_NAME} letras.`);
  const token = randomUUID();
  let seat = -1;
  const r = await update(store, roomId, (room) => {
    if (room.status !== 'lobby') return { code: 'already-started', message: 'La partida ya empezó.' };
    if (room.seats.length >= MAX_SEATS) return { code: 'room-full', message: 'La sala está llena.' };
    if (room.seats.some((s) => s.name.toLowerCase() === name.toLowerCase())) return { code: 'name-taken', message: 'Ese nombre ya está en la sala.' };
    seat = room.seats.push({ name, tokenHash: hashToken(token), bot: false }) - 1;
    return null;
  });
  return r.ok ? ok({ token, seat }) : r;
}

/** El anfitrión suma un asiento de bot (solo en el lobby). */
export async function addBot(store: RoomStore, roomId: string, token: string): Promise<Res<RoomView>> {
  let me = -1;
  const r = await update(store, roomId, (room) => {
    me = seatOf(room, token);
    if (me < 0) return { code: 'not-in-room', message: 'No estás en esta sala.' };
    if (me !== 0) return { code: 'not-host', message: 'Solo quien creó la sala puede sumar bots.' };
    if (room.status !== 'lobby') return { code: 'already-started', message: 'La partida ya empezó.' };
    if (room.seats.length >= MAX_SEATS) return { code: 'room-full', message: 'La sala está llena.' };
    let n = room.seats.filter((s) => s.bot).length + 1;
    while (room.seats.some((s) => s.name === `Bot ${n}`)) n++;
    room.seats.push({ name: `Bot ${n}`, tokenHash: null, bot: true });
    return null;
  });
  return r.ok ? ok(roomView(r.value.room, me, r.value.before)) : r;
}

/** Solo el anfitrión (asiento 0). La semilla sale de crypto salvo que un test la inyecte. */
export async function startGame(store: RoomStore, roomId: string, token: string, opts: PlayOptions = {}): Promise<Res<RoomView>> {
  let me = -1;
  const r = await update(store, roomId, (room) => {
    me = seatOf(room, token);
    if (me < 0) return { code: 'not-in-room', message: 'No estás en esta sala.' };
    if (me !== 0) return { code: 'not-host', message: 'Solo quien creó la sala puede empezar.' };
    if (room.status !== 'lobby') return { code: 'already-started', message: 'La partida ya empezó.' };
    if (room.seats.length < MIN_SEATS) return { code: 'not-enough-players', message: `Hacen falta al menos ${MIN_SEATS} jugadores.` };
    room.state = createGame(room.seats.map((s) => s.name), opts.seed ?? newSeed(), opts.config);
    room.status = 'playing';
    playBots(room, opts);
    return null;
  });
  return r.ok ? ok(roomView(r.value.room, me, r.value.before)) : r;
}

// ---------------------------------------------------------------- partida

/** Aplica el comando del jugador dueño del token y hace jugar a los bots que sigan. Devuelve su vista con todos los eventos. */
export async function submitCommand(store: RoomStore, roomId: string, token: string, cmd: Command, opts: PlayOptions = {}): Promise<Res<RoomView>> {
  let me = -1;
  const r = await update(store, roomId, (room) => {
    me = seatOf(room, token);
    if (me < 0) return { code: 'not-in-room', message: 'No estás en esta sala.' };
    if (room.status !== 'playing' || !room.state) return { code: 'not-started', message: 'La partida todavía no empezó.' };
    const result = applyCommand(room.state, { ...cmd, player: me }); // el jugador lo decide el token, no el cliente
    if (!result.ok) return result.error;
    room.state = result.state;
    record(room, result.events);
    playBots(room, opts);
    return null;
  });
  return r.ok ? ok(roomView(r.value.room, me, r.value.before)) : r;
}

/** Lo que ve el dueño del token; `since` (versión que ya tiene el cliente) limita los eventos que se devuelven. */
export async function getView(store: RoomStore, roomId: string, token: string, since = 0): Promise<Res<RoomView>> {
  const room = await store.get(roomId);
  if (!room) return fail('room-not-found', 'La sala no existe.');
  const me = seatOf(room, token);
  if (me < 0) return fail('not-in-room', 'No estás en esta sala.');
  return ok(roomView(room, me, since));
}
