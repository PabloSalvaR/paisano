# Multijugador, bots y sesiones

Diseño y estado de la parte de red del cliente/servidor de prueba (sept 2026). Todo vive en `client/` y el motor de reglas (`client/src/engine/`) no sabe nada de esto.

## Idea central

El servidor es el único que aplica reglas. El cliente envía **comandos** y dibuja lo que recibe. Hay una sola interfaz entre el tablero 3D y la partida, `GameSession`, con dos implementaciones: local (motor en el navegador) y remota (API de salas con polling).

```
board.js ──► GameSession ──┬─► LocalSession   (motor en el navegador: 4 en la misma pantalla, o 1 humano + 3 bots)
                           └─► RemoteSession  (fetch + polling a /api/rooms/…)   ← 6b
```

## Módulos (`client/src/`)

| Módulo | Qué hace |
|---|---|
| `server/room.ts` | Documento JSON de una sala: asientos (nombre, hash del token, `bot`), estado del motor, log de eventos con versión, número de versión. |
| `server/store.ts` | Interfaz `RoomStore` (`get`, `create`, `save(sala, versiónEsperada)`) y `MemoryStore` (en `globalThis`, copia al entrar y salir). Después: `UpstashStore` con las mismas operaciones. |
| `server/rooms.ts` | Servicio: `createRoom`, `joinRoom`, `addBot`, `startGame`, `submitCommand`, `getView`. Sin nada de Next: se prueba con Vitest. |
| `server/view.ts` | Vista filtrada de un jugador (`RoomView`). Es lo único que sale del servidor. |
| `server/api.ts` | Capa HTTP (Request → Response) y validación de la forma de los comandos (`parseCommand`). |
| `server/instance.ts` | El almacén que usan las rutas (hoy en memoria). |
| `app/api/rooms/**` | Route Handlers de una línea, delegan en `api.ts`. |
| `bots/random.ts`, `bots/play.ts` | Bot aleatorio (`Bot`) y `playBots` (puro: lo usan la sala y la partida local). |
| `lib/session.ts` | `GameSession` y `LocalSession`. |

## API

Token en `Authorization: Bearer <token>` (no en la URL). Respuestas con `Cache-Control: no-store`.

| Ruta | Qué hace |
|---|---|
| `POST /api/rooms` `{name}` | Crea la sala. Devuelve `{roomId, token}` (el creador es el asiento 0, anfitrión). |
| `POST /api/rooms/:id/join` `{name}` | Se une (solo en el lobby, hasta 4, nombres únicos). Devuelve `{token, seat}`. |
| `POST /api/rooms/:id/bots` | El anfitrión suma un asiento de bot (lobby). |
| `POST /api/rooms/:id/start` | El anfitrión empieza (mínimo 3 asientos, cuentan los bots). |
| `POST /api/rooms/:id/command` `{command}` | Aplica el comando; devuelve la vista con los eventos que produjo (incluidos los de los bots). |
| `GET /api/rooms/:id?since=N` | Vista con los eventos posteriores a la versión N (es lo que se consulta con polling). |

Códigos: 404 sala inexistente, 401 token ausente o ajeno, 403 no es el anfitrión, 409 choque de versiones, 400 el resto (comando mal formado o ilegal; el código del motor va en el cuerpo). El código de sala (6 caracteres sin letras ambiguas) se acepta en minúsculas.

## Reglas de seguridad (con test)

- **El jugador de un comando sale del token**, nunca del campo `player` que mande el cliente.
- **La sala guarda solo el hash del token** (SHA-256).
- **La vista no lleva las semillas** de dados y robos (permitirían predecir el azar) ni las manos ajenas (solo su cantidad). La vista copia una lista explícita de campos: un campo nuevo del estado no sale por defecto.
- **El recurso robado** solo lo ven el ladrón y la víctima (`Stolen.resource` llega `null` a los demás).
- **Choque de versiones:** `save` solo guarda si la versión no cambió; si chocó, se relee y el comando se revalida contra el estado nuevo (hasta 4 intentos, después 409).

## Bots

Un bot es una función `(BotInput, rng) => Command`, con `BotInput = { me, legal, hand }`: usa la misma interfaz que un jugador y elige entre las acciones legales. El actual (`randomBot`) prefiere construir a terminar el turno y decide el resto al azar; sirve para probar. Para uno mejor basta otra función con la misma firma.

`playBots(estado, esBot, rng)` juega mientras le toque a un bot (tope de 2000 jugadas) y devuelve el estado nuevo y los eventos en orden. En el servidor corre **dentro de la misma petición** que dejó el turno en manos de un bot (en Vercel no hay proceso en segundo plano); en la partida local, dentro de `LocalSession.send`. Si un bot devuelve un comando ilegal, se corta la tanda sin trabar la sala.

## Cómo se reproducen los eventos en el tablero

Después de un comando llega una lista de eventos (los propios y, con bots o en línea, los de los demás). `playEvents` (en `board.js`) los reproduce en orden, con pausas cuando actúa otro (650 ms por pieza, 800 el ladrón, 450 el cambio de turno). Mientras tanto `game` (la vista) queda como estaba y `shown` (piezas y ladrón), `counts`, `myHand` y `vps` avanzan al ritmo de la animación; al terminar se hace `pull()` y se corrige todo con el estado real. Detalle a tener en cuenta al tocar esa parte: `syncPieces` dibuja desde `shown`, no desde `game`.

## Pendiente de la parte online (6b)

Ver «Estado actual» en `CLAUDE.md`.
