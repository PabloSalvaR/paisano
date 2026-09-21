// Bots dentro de la sala: asientos, jugada automática hasta que le toca a un humano y partidas completas por el servicio.

import { describe, expect, it } from 'vitest';
import { randomBot } from '../bots/random';
import { mulberry32 } from '../engine';
import { expectConserved } from '../engine/testutil';
import { addBot, createRoom, getView, joinRoom, startGame, submitCommand, type Res } from './rooms';
import { MemoryStore } from './store';

const newStore = () => new MemoryStore(new Map());

function val<T>(r: Res<T>): T {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.value;
}
const code = <T>(r: Res<T>): string => (r.ok ? 'ok' : r.error.code);

async function roomWithBots(bots: number) {
  const store = newStore();
  const { roomId, token } = val(await createRoom(store, 'Ana'));
  for (let i = 0; i < bots; i++) val(await addBot(store, roomId, token));
  return { store, roomId, token };
}

/** El anfitrión juega con el bot aleatorio; los demás asientos (bots) juegan solos. Comprueba las invariantes en cada paso. */
async function playThrough(seed: number, bots: number, victoryPoints: number) {
  const { store, roomId, token } = await roomWithBots(bots);
  const rng = mulberry32(seed);
  val(await startGame(store, roomId, token, { seed, config: { victoryPoints }, rng }));
  let commands = 0;
  for (; commands < 2500; commands++) {
    const view = val(await getView(store, roomId, token));
    const game = view.game!;
    if (game.phase.kind === 'finished') break;
    expect(game.turn).toBe(0); // los bots ya jugaron todo lo suyo: solo queda esperar al anfitrión
    expect(view.legal.length).toBeGreaterThan(0);
    val(await submitCommand(store, roomId, token, randomBot({ me: 0, legal: view.legal, hand: game.hand }, rng), { rng }));
    expectConserved((await store.get(roomId))!.state!);
  }
  return { finished: commands < 2500 };
}

describe('asientos de bot', () => {
  it('el anfitrión suma bots con nombre propio, hasta llenar la sala', async () => {
    const { store, roomId, token } = await roomWithBots(2);
    const view = val(await getView(store, roomId, token));
    expect(view.seats).toEqual([
      { name: 'Ana', bot: false },
      { name: 'Bot 1', bot: true },
      { name: 'Bot 2', bot: true },
    ]);
    val(await addBot(store, roomId, token));
    expect(code(await addBot(store, roomId, token))).toBe('room-full');
    expect((await store.get(roomId))!.seats[1].tokenHash).toBeNull(); // un bot no tiene token: nadie puede actuar por él
  });

  it('solo el anfitrión, y solo antes de empezar', async () => {
    const { store, roomId, token } = await roomWithBots(2);
    const beto = val(await joinRoom(store, roomId, 'Beto'));
    expect(code(await addBot(store, roomId, beto.token))).toBe('not-host');
    expect(code(await addBot(store, roomId, 'token-ajeno'))).toBe('not-in-room');
    val(await startGame(store, roomId, token, { seed: 1 }));
    expect(code(await addBot(store, roomId, token))).toBe('already-started');
  });

  it('los bots cuentan para el mínimo de jugadores', async () => {
    const { store, roomId, token } = await roomWithBots(1);
    expect(code(await startGame(store, roomId, token))).toBe('not-enough-players');
  });
});

describe('los bots juegan en la sala', () => {
  it('al terminar el turno del anfitrión juegan los bots y se frenan cuando le toca a un humano', async () => {
    const store = newStore();
    const { roomId, token } = val(await createRoom(store, 'Ana'));
    const beto = val(await joinRoom(store, roomId, 'Beto'));
    val(await addBot(store, roomId, token)); // asientos: Ana (0), Beto (1), Bot 1 (2)
    val(await startGame(store, roomId, token, { seed: 8, rng: mulberry32(1) }));

    // colocación inicial: Ana, Beto, Bot 1, Bot 1, Beto, Ana; los bots juegan solos cuando les toca
    const rng = mulberry32(2);
    const play = async (t: string) => {
      const v = val(await getView(store, roomId, t));
      return val(await submitCommand(store, roomId, t, randomBot({ me: v.me, legal: v.legal, hand: v.game!.hand }, rng), { rng: mulberry32(3) }));
    };
    await play(token); // Ana: poblado
    await play(token); // Ana: camino
    await play(beto.token); // Beto: poblado
    const afterBeto = await play(beto.token); // Beto: camino → juega el Bot 1 sus dos colocaciones seguidas → vuelve Beto
    expect(afterBeto.game!.turn).toBe(1);
    const botEvents = afterBeto.events.filter((e) => e.event.type === 'SettlementBuilt' && e.event.player === 2);
    expect(botEvents).toHaveLength(2); // el Bot 1 puso sus dos poblados (en el mismo cambio de versión)
    expect(new Set(afterBeto.events.map((e) => e.version)).size).toBe(1);
  });
});

describe('partidas completas por el servicio de salas', () => {
  it('anfitrión y bots juegan sin trabarse, con los recursos siempre conservados', async () => {
    let finished = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const r = await playThrough(seed, 2 + (seed % 2), 5);
      if (r.finished) finished++;
    }
    expect(finished).toBeGreaterThan(0); // al menos alguna llegó al final
  }, 240000);
});
