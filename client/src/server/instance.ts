// El almacén que usan los Route Handlers. Con las variables de Upstash Redis definidas usa la base (sirve en Vercel);
// sin ellas usa memoria, que solo sirve en desarrollo (en Vercel cada función tiene su propia memoria).
//
// Variables (nunca en el repo: .env.local en desarrollo, Environment Variables en Vercel):
//   UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN  (la integración de Vercel puede llamarlas KV_REST_API_URL / KV_REST_API_TOKEN)

import { MemoryStore, type RoomStore } from './store';
import { UpstashStore } from './upstash';

function createStore(): RoomStore {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) return new UpstashStore({ url, token });
  if (process.env.VERCEL) console.warn('Paisano: faltan las variables de Upstash; las salas se guardan en memoria y no van a funcionar en Vercel.');
  return new MemoryStore();
}

export const store: RoomStore = createStore();
