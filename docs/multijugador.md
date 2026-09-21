# Multijugador, bots y sesiones

Diseño y estado de la parte de red del cliente/servidor de prueba (sept 2026). Todo vive en `client/` y el motor de reglas (`client/src/engine/`) no sabe nada de esto.

## Idea central

El servidor es el único que aplica reglas. El cliente envía **comandos** y dibuja lo que recibe. Hay una sola interfaz entre el tablero 3D y la partida, `GameSession`, con dos implementaciones: local (motor en el navegador) y remota (API de salas con polling).

```
board.js ──► GameSession ──┬─► LocalSession   (motor en el navegador: 4 en la misma pantalla, o 1 humano + 3 bots)
                           └─► RemoteSession  (fetch + polling a /api/rooms/…: partida online por sala)
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
| `lib/remote.ts` | `RemoteSession`: envía comandos por POST y consulta cada 1,5 s. |
| `lib/roomsApi.ts` | Cliente de la API (recibe `fetch`, así se prueba sin red). |
| `lib/identity.ts` | Token y último nombre en `localStorage` (con `try/catch`: puede fallar o venir vacío). |
| `app/sala/**` | Pantallas: crear/unirse (`/sala`), entrar por link, lobby y partida (`/sala/[id]`). |

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

## Partida online (pantallas y flujo)

- **`/sala`:** nombre + «Crear sala», o código + «Unirme» (que solo va a `/sala/CODIGO`). El menú del tablero tiene «Jugar online».
- **`/sala/CODIGO`** (el código se acepta en minúsculas), según lo que responda el servidor:
  1. sin token guardado para esa sala: «Hola, presentate compañero» (nombre y entrar);
  2. lobby: asientos con su color, «Copiar link de la sala», y para el anfitrión «Sumar bot» y «Empezar partida» (mínimo 3 asientos, cuentan los bots); los demás ven «Esperando a que X empiece»;
  3. partida: el tablero 3D conectado a la `RemoteSession`, con «Salir de la sala» en el menú (volver con el mismo link recupera el asiento).
- **Identidad:** el token se guarda en `localStorage` como `paisano:sala:CODIGO`. Si se borran los datos del navegador (o se entra desde otro dispositivo) se pierde el asiento: en el lobby se puede entrar de nuevo con otro nombre, pero en una partida ya empezada no hay forma de recuperarlo (queda como mejora futura: volver a entrar por nombre). Un 401 al reconectar borra el token viejo y vuelve a pedir nombre.
- **Polling:** `RemoteSession.load()` deja la vista lista **sin reproducir** lo ocurrido antes (al recargar se recupera el estado exacto); después consulta con `?since=versión`. Una consulta que arrancó antes de enviar un comando se descarta (`epoch`), y un comando propio no vuelve a llegar por polling: no hay eventos duplicados.
- **Tablero en línea:** `initBoard({ session, seats, seed })`. Los nombres salen de los asientos (el 4.º puesto se oculta en partidas de 3), `VIEWER` es siempre tu asiento, el botón de turno, el de carta y los diálogos de descarte/robo solo aparecen cuando actúa uno, y no hay «Nuevo mapa» ni partidas locales. Lo que hacen los demás entra por `session.subscribe`; si llega mientras se reproduce otra tanda, se encola. El `seed` del decorado (árboles, vacas, rocas) sale del código de la sala, así todos ven el mismo mapa.

## Límites conocidos

- **El almacén en memoria no sirve en Vercel** (cada función tiene su propia memoria): las salas solo funcionan con `npm run dev` o `next start`. Para jugar con amigos fuera de la máquina del desarrollador hace falta el `UpstashStore`. En desarrollo, reiniciar el servidor borra las salas (la pantalla lo avisa: «Esa sala no existe…»).
- El polling es fijo (1,5 s), sin frenar cuando no es tu turno ni cuando la pestaña está oculta; hay que revisar la cuota gratis de Upstash con el ritmo real.
- Si se cae la conexión, el polling sigue intentando; solo un 404 (sala perdida) corta la partida con un mensaje.
- Sin salir de la sala, expulsar, ni cambiar de nombre una vez adentro.
- Probado con Chrome: un jugador con la interfaz y el otro (más un bot) por la API, ronda completa, recarga a mitad de partida, entrar por link, sala inexistente. **No** se probó con dos personas en dos dispositivos ni en un ancho real de celular (no se pudo achicar la ventana).

