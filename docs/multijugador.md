# Multijugador, bots y sesiones

Diseño y estado de la parte de red del cliente/servidor de prueba (sept 2026). Todo vive en `client/` y el motor de reglas (`client/src/engine/`) no sabe nada de esto.

## Idea central

El servidor es el único que aplica reglas. El cliente envía **comandos** y dibuja lo que recibe. Hay una sola interfaz entre el tablero 3D y la partida, `GameSession`, con dos implementaciones: local (motor en el navegador) y remota (API de salas con polling).

```
board/   ──► GameSession ──┬─► LocalSession   (motor en el navegador: 4 en la misma pantalla, o 1 humano + 3 bots)
                           └─► RemoteSession  (fetch + polling a /api/rooms/…: partida online por sala)
```

**Dónde vive cada cosa (partida online), en detalle:** quien hace polling es **el navegador** (`RemoteSession`), no el servidor. Todo el proyecto se despliega junto en Vercel, pero el navegador (front) y los Route Handlers (backend) son dos ámbitos distintos que corren en dos lugares distintos — comparten repo y despliegue, no memoria ni proceso. Por eso hace falta Upstash: una función serverless no recuerda nada de un pedido al siguiente.

```
 ┌────────────────────────┐
 │  NAVEGADOR (front)      │
 │  board/ + RemoteSession  │
 └───────────┬─────────────┘
             │ (1) fetch POST /api/rooms/:id/command  { command }   ← cuando VOS jugás
             │ (2) fetch GET  /api/rooms/:id?since=N               ← polling, cada 1,5 s SIEMPRE
             ▼
 ┌──────────────────────────────────────────┐
 │  VERCEL — Route Handlers (BACKEND)        │
 │  app/api/rooms/** → server/api.ts         │
 │  → server/rooms.ts                        │
 │  el MOTOR corre ACÁ (autoritativo):       │
 │  valida el token, aplica el comando,      │
 │  arma la RoomView filtrada                │
 └───────────┬────────────────────────────────┘
             │ fetch REST (Upstash)
             ▼
 ┌──────────────────────────────────────────┐
 │  UPSTASH REDIS (fuera de Vercel)          │
 │  paisano:sala:CODIGO   (doc JSON)         │
 │  paisano:sala:CODIGO:v (versión)          │
 └───────────┬────────────────────────────────┘
             │ devuelve el doc (o guarda si la versión no cambió)
             ▼
 Route Handler arma la RoomView y responde JSON
             │
             ▼
 NAVEGADOR: playEvents() dibuja lo nuevo en el tablero

 ⟲ el paso (2) se repite solo cada 1,5 s mientras la pestaña esté en la partida
```

En el modo bots no hay nada de esto: el motor corre directo en el navegador (`LocalSession`), así que no toca Route Handlers ni Upstash para nada.

## Módulos (`client/src/`)

| Módulo | Qué hace |
|---|---|
| `server/room.ts` | Documento JSON de una sala: asientos (nombre, hash del token, `bot`), estado del motor, log de eventos con versión, número de versión. |
| `server/store.ts` | Interfaz `RoomStore` (`get`, `create`, `save(sala, versiónEsperada)`) y `MemoryStore` (en `globalThis`, copia al entrar y salir; solo desarrollo). |
| `server/upstash.ts` | `UpstashStore`: el mismo contrato sobre Upstash Redis, por su API REST con `fetch` (sin librería). |
| `server/rooms.ts` | Servicio: `createRoom`, `joinRoom`, `addBot`, `startGame`, `submitCommand`, `getView`. Sin nada de Next: se prueba con Vitest. |
| `server/view.ts` | Vista filtrada de un jugador (`RoomView`). Es lo único que sale del servidor. |
| `server/api.ts` | Capa HTTP (Request → Response) y validación de la forma de los comandos (`parseCommand`). |

Cartas de desarrollo (sept 2026): `parseCommand` acepta `buyDevCard`, `playKnight`, `playMonopoly {resource}`, `playYearOfPlenty {resources: [a, b]}` y `playRoadBuilding`. `RoomView.game` suma `dev` (tus cartas y cuáles son nuevas), `deckCount`, `longestRoad`, `largestArmy` y, por jugador, `devCount` y `knights`; **no** sale el mazo ni las cartas ajenas, y los `points` de los demás no incluyen sus Estancias. Un `DevCardBought` ajeno llega con `kind: null`.
| `server/instance.ts` | El almacén que usan las rutas: Upstash si están las variables de entorno, si no memoria. |
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

Un bot es una función `(BotInput, rng) => Command`, con `BotInput = { me, legal, hand, state? }`: usa la misma interfaz que un jugador y elige entre las acciones legales. Hay dos: `randomBot` (`bots/random.ts`: prefiere construir a terminar el turno y decide el resto al azar; sirve para simulaciones) y **`smartBot`** (`bots/smart.ts`, el que usan por defecto la sala y la partida local): puntúa vértices (probabilidad de las fichas, variedad, puerto), sube estancias antes que nada, mueve el ladrón contra el que va ganando, descarta lo que más le sobra y solo comercia con el banco si con un cambio completa una compra. Necesita `state` (el estado completo, solo lo tiene el servidor o la partida local); sin él cae al aleatorio.

**Comercio entre jugadores:** un bot responde cuando lo consultan aunque no sea su turno. `nextBot(estado, esBot)` decide quién actúa: con una oferta abierta responden primero los bots consultados; si falta una persona, `playBots` se detiene (la respuesta humana llega como un comando más y retoma a los bots); y cuando ya respondieron todos concreta quien propuso, si es un bot. El bot acepta si el cambio lo acerca a una compra y quien propone no está por ganar; propone 1 carta que le sobra por 1 que le falta (a 1 o 2 cartas de una compra), **máximo 3 ofertas por turno** (`BOT_MAX_OFFERS`; el tope de las reglas para cualquiera es `GameConfig.trade.maxOffersPerTurn` = 5).

`playBots(estado, esBot, rng)` juega mientras le toque a un bot (tope de 2000 jugadas) y devuelve el estado nuevo y los eventos en orden. En el servidor corre **dentro de la misma petición** que dejó el turno en manos de un bot (en Vercel no hay proceso en segundo plano); en la partida local, dentro de `LocalSession.send`. Si un bot devuelve un comando ilegal, se corta la tanda sin trabar la sala.

## Cómo se reproducen los eventos en el tablero

Después de un comando llega una lista de eventos (los propios y, con bots o en línea, los de los demás). `playEvents` (en `board/replay.js`) los reproduce en orden, con pausas cuando actúa otro (650 ms por pieza, 800 el ladrón, 450 el cambio de turno). Mientras tanto `game` (la vista) queda como estaba y `shown` (piezas y ladrón), `counts`, `myHand` y `vps` avanzan al ritmo de la animación; al terminar se hace `pull()` y se corrige todo con el estado real. Detalle a tener en cuenta al tocar esa parte: `syncPieces` dibuja desde `shown`, no desde `game`.

## Partida online (pantallas y flujo)

- **`/sala`:** nombre + «Crear sala», o código + «Unirme» (que solo va a `/sala/CODIGO`). El menú del tablero tiene «Jugar online».
- **`/sala/CODIGO`** (el código se acepta en minúsculas), según lo que responda el servidor:
  1. sin token guardado para esa sala: «Hola, presentate compañero» (nombre y entrar);
  2. lobby: asientos con su color, «Copiar link de la sala», y para el anfitrión «Sumar bot» y «Empezar partida» (mínimo 3 asientos, cuentan los bots); los demás ven «Esperando a que X empiece»;
  3. partida: el tablero 3D conectado a la `RemoteSession`, con «Salir de la sala» en el menú (volver con el mismo link recupera el asiento).
- **Identidad:** el token se guarda en `localStorage` como `paisano:sala:CODIGO`. Si se borran los datos del navegador (o se entra desde otro dispositivo) se pierde el asiento: en el lobby se puede entrar de nuevo con otro nombre, pero en una partida ya empezada no hay forma de recuperarlo (queda como mejora futura: volver a entrar por nombre). Un 401 al reconectar borra el token viejo y vuelve a pedir nombre.
- **Polling:** `RemoteSession.load()` deja la vista lista **sin reproducir** lo ocurrido antes (al recargar se recupera el estado exacto); después consulta con `?since=versión`. Una consulta que arrancó antes de enviar un comando se descarta (`epoch`), y un comando propio no vuelve a llegar por polling: no hay eventos duplicados. **Ahorro de consultas:** con la pestaña oculta se consulta cada 20 s (`HIDDEN_POLL_MS`) y al volver a verla, enseguida (`setHidden`, conectado a `visibilitychange` en `/sala/[id]`); el polling se detiene solo cuando la partida terminó y cuando el servidor responde 404 (sala perdida) o 401 (token que ya no vale).
- **Tablero en línea:** `initBoard({ session, seats, seed })`. Los nombres salen de los asientos (el 4.º puesto se oculta en partidas de 3), `VIEWER` es siempre tu asiento, el botón de turno, el de carta y los diálogos de descarte/robo solo aparecen cuando actúa uno, y no hay «Nuevo mapa»; la partida sin red usa `initBoard({ mode: "bots" | "local" })` desde `/jugar/[modo]`. Lo que hacen los demás entra por `session.subscribe`; si llega mientras se reproduce otra tanda, se encola. El `seed` del decorado (árboles, vacas, rocas) sale del código de la sala, así todos ven el mismo mapa.

## Almacén en Upstash Redis

- **Variables** (nunca en el repo): `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` (con la integración de Vercel pueden llamarse `KV_REST_API_URL` / `KV_REST_API_TOKEN`; se aceptan las dos). En desarrollo van en `client/.env.local` (Git lo ignora; hay que reiniciar `npm run dev` al cambiarlo); en Vercel, en Settings → Environment Variables (Production y Preview).
- **Datos:** cada sala son dos claves, `paisano:sala:CODIGO` (el documento JSON) y `paisano:sala:CODIGO:v` (su versión). Crear y guardar-si-la-versión-no-cambió son **scripts Lua atómicos** (`CREATE_SCRIPT`, `SAVE_SCRIPT`); las salas vencen a las **6 horas** sin actividad (cada guardado renueva el plazo).
- **Configuración de la base:** Redis gratuito, región cerca de donde corren las funciones de Vercel (por defecto Washington D.C., o sea US East), sin read regions, TLS activado y **eviction desactivada**: con eviction, una base llena borraría salas en silencio; sin ella, el error se ve (503).
- **Errores:** si la base falla (caída, credenciales mal puestas), la API responde **503** con `{ error: { code: 'storage' } }` en vez de un error sin cuerpo.
- **Pruebas:** `upstash.test.ts` corre en `npm test` contra un Upstash simulado. `upstash.live.test.ts` corre contra la base real con **`npm run test:upstash`** (lee `.env.local`; usa un prefijo propio y salas que vencen en 2 minutos; incluye ocho guardados simultáneos donde tiene que ganar uno solo). Se salta sola si no hay credenciales.
- **Límites del plan Free (visto en el panel y en la tabla de precios, sept 2026):** 500.000 comandos al mes, 256 MB de datos y **10 GB de ancho de banda al mes según la tabla de precios** (el panel de la base mostraba 50 GB: se toma el más chico). Una sala mide **~2,6 KB al empezar y ~20 KB** desde los ~60 movimientos (el log de eventos tiene tope de 200). Con eso, una partida de 4 durante 2 horas gasta ~19.200 comandos y ~380 MB: **unas 26 partidas al mes** por cualquiera de los dos límites. Plan de pago «pay as you go»: 0,20 USD cada 100.000 comandos (≈ 4 centavos por esa partida), ancho de banda gratis hasta 200 GB, primer GB de datos gratis. **Sin confirmar:** qué hace Upstash exactamente al llegar al tope del plan gratis (leer su FAQ antes de invitar a mucha gente).
- **Costo por consulta:** cada consulta de polling es un comando (`GET`). A 1,5 s son unos **2.400 comandos por hora y por jugador**: una partida de 4 personas durante 2 horas ronda los 19.000. Comparar con el límite del plan gratis (cambia con el tiempo). Ya hecho: pestaña oculta, partida terminada, **tu turno** (con jugadas legales solo vos podés mover: consulta de respaldo cada 15 s, y al enviar un comando se reprograma enseguida) e **inactividad** (5 min sin mouse, toque ni teclado pausan el polling; cualquier actividad o volver a la pestaña lo retoma con una consulta inmediata). Medido en sept 2026: unos 661 comandos en una tarde corta de pruebas, 78 % lecturas; en tu turno, 0 consultas en 10 s. Queda a mano, si hace falta: consultar solo la clave de versión (baja el ancho de banda casi a cero, no los comandos, y complica la autenticación de la consulta) y subir el intervalo visible a 2 s (un tercio menos).

## Límites conocidos

- **Sin las variables de Upstash el almacén es la memoria del proceso**: no sirve en Vercel (cada función tiene la suya) y reiniciar el servidor borra las salas (la pantalla lo avisa: «Esa sala no existe…»). Con Upstash, las salas sobreviven a los reinicios (probado: se reinició el servidor y la partida seguía en el mismo estado).
- El polling visible es fijo (1,5 s), aunque no sea tu turno; ver el costo por consulta en la sección de Upstash. **No hay tiempo límite por turno:** si alguien deja de responder, la partida queda esperándolo (diseño pendiente: reloj de turno y reemplazo por un bot, ver `CLAUDE.md`).
- Si se cae la conexión, el polling sigue intentando; solo un 404 (sala perdida) corta la partida con un mensaje.
- Sin salir de la sala, expulsar, ni cambiar de nombre una vez adentro.
- Probado con Chrome: un jugador con la interfaz y el otro (más un bot) por la API, ronda completa, recarga a mitad de partida, entrar por link, sala inexistente. Probado contra Upstash real: tests en vivo y una partida por la API con el servidor reiniciado. **No** se probó con dos personas en dos dispositivos, ni en Vercel, ni en un ancho real de celular (no se pudo achicar la ventana).

## Diseño propuesto: tiempo límite por turno y reemplazo por un bot (SIN implementar, pendiente de confirmar)

Pedido por el desarrollador (sept 2026): si alguien deja de responder, la partida no puede quedar colgada; se lo echa y lo reemplaza un bot. Propuesta de Claude, a confirmar en la próxima sesión:

- **Qué es «no responde»: reloj de turno**, no presencia. Si quien tiene el turno no actúa en T, se lo reemplaza. Medir presencia (que no consulte más) falla con lo que ya hicimos: una pestaña oculta consulta cada 20 s y un celular en otra app parece ausente sin haberse ido.
- **Dónde corre:** el servidor lo evalúa **al atender cualquier consulta o comando de esa sala** (Vercel no tiene procesos en segundo plano; los demás jugadores consultan todo el tiempo, así que alguien lo dispara). La sala guarda desde cuándo espera el turno actual (`turnSince`, en milisegundos del servidor, **fuera del estado del motor**, que sigue puro y determinista); se reinicia cuando cambia `state.turn` o la fase (incluye la colocación inicial y los descartes por un 7). Normalmente no gasta comandos extra: solo se escribe cuando vence. Debe usar un reloj inyectable para poder probarlo.
- **Cuando vence:** el asiento pasa a `bot: true` (conserva el nombre y queda marcado como reemplazado); el bot juega lo que le tocaba y sigue mientras le toque (`playBots`); se registra un evento nuevo de sala (p. ej. `PlayerReplaced`, que no viene del motor y hay que sumar a `ViewEvent`) y los demás ven un aviso («Beto tardó demasiado: lo reemplaza un bot»). El token del expulsado deja de valer: hay que devolver un código propio (p. ej. `replaced`, 403) para mostrarle un mensaje claro en vez del genérico (hoy un 401 lo manda a «Hola, presentate compañero», donde falla con «la partida ya empezó»).
- **Seguridad:** **nunca se reemplaza al último humano** (si no, una sola petición podría jugar la partida entera entre bots; `playBots` corta a las 2000 jugadas pero no es lo que se quiere).
- **Duración configurable por sala** (encaja con «el anfitrión configura las reglas»): opción de la sala, no del motor (`Room.options.turnSeconds`, p. ej. viajando en el cuerpo de `start`), con un selector para el anfitrión en el lobby: sin límite, 1, 2, 3 o 5 minutos. Sugerido por defecto: 3 minutos.
- **Aviso previo (opcional):** la vista trae los segundos que quedan (calculados en el servidor, para no depender del reloj del navegador) y el tablero muestra un contador cuando faltan 30 s.
- **Tests primero:** reloj inyectable; vence y reemplaza; no vence si actúa a tiempo; se reinicia al cambiar de turno/fase; no reemplaza al último humano; el token expulsado recibe `replaced`; el reemplazo no rompe la concurrencia (`save` con versión).

**Preguntas abiertas para el desarrollador** (con la recomendación de Claude):
1. ¿Reloj de turno o presencia? → reloj de turno.
2. ¿Duración por defecto y opciones? → 3 minutos por defecto; sin límite / 1 / 2 / 3 / 5.
3. ¿Reemplazo permanente («lo echa») o el humano puede recuperar su asiento si vuelve? → permanente en la primera versión; recuperar el asiento queda como mejora futura (volver a entrar por nombre).
4. ¿Aviso previo con contador a los 30 s? → sí, aunque puede ir en una segunda etapa.

## Fin del flujo hoy, y qué falta para escalar (sept 2026, análisis, sin implementar)

Pedido por el desarrollador: dejar anotado qué pasa hoy cuando termina una partida y qué haría falta si el juego crece más allá de "probar con amigos" — por ejemplo, para publicarlo en la Play Store.

**Qué pasa hoy al terminar una partida (en los dos modos):**
- **Contra bots:** nada persiste. Todo vive en la pestaña (`LocalSession`, motor en el navegador); al cerrarla o recargar se pierde la partida entera. No hay historial ni estadísticas: es coherente con el alcance recortado actual (una sola instancia, sin base de datos para esto).
- **Online:** la sala queda en Upstash sin ningún paso de "cierre" o archivado; vence sola con las demás a las 6 horas sin actividad, haya terminado o no. No hay historial de partidas, estadísticas por jugador ni revancha con un clic (hay que crear sala de nuevo). El panel de resumen (ver «Decisiones tomadas» en `CLAUDE.md`) es puramente del cliente: no queda guardado en ningún lado.
- En síntesis: hoy "termina la partida" es *el final*, no un cierre con memoria. Alcanza para el objetivo actual; es la primera limitación real si el juego escala.

**Qué haría falta para escalar de verdad**, de más a menos urgente:

1. **Tiempo real sin polling.** El polling de 1,5 s gasta cuota de Upstash todo el tiempo que alguien está conectado, juegue o no; con más gente simultánea es el primer cuello de botella. Es lo que ya preveía el plan original (Spring WebSocket) o, sin volver a Java, un servicio de tiempo real (Upstash con plan pago, o algo tipo Ably/Pusher/Supabase Realtime).
2. **Backend y persistencia reales.** Salir del free tier de Upstash (o migrar a Postgres, el plan original: "snapshots y eventos de partida") y, sobre todo, empezar a **guardar algo que sobreviva a la partida** — hoy no existe historial ni estadísticas en absoluto.
3. **Cuentas de verdad.** Nombre + token en `localStorage` no sobrevive un desinstalado de la app ni un cambio de dispositivo. Una app de tienda casi siempre pide login (Google Sign-In es lo natural en Android).
4. **Notificaciones.** Sin tiempo real ni push, "es tu turno" solo lo sabe quien tiene la app abierta — casi obligatorio en una app de celular, y se conecta con el reloj de turno pendiente (sección de arriba).
5. **Moderación básica.** Hoy cualquiera con el link entra con el nombre que quiera, sin límites ni forma de bloquear o reportar a alguien.
6. **Empaquetar para Android (la parte fácil):** como el servidor ya es autoritativo y el cliente es intercambiable (misma razón por la que se anotó un posible cliente Unity para Steam en `CLAUDE.md`), **no hace falta reescribir el motor** para llegar a la Play Store. El camino corto es envolver la web actual como **TWA** (*Trusted Web Activity*) o con **Capacitor**: la app de la tienda abre esta misma web. Un cliente nativo o Unity quedaría solo si algún día se quisiera algo gráfico que el navegador no puede dar.
7. **Trámites y políticas de la tienda.** Cuenta de desarrollador de Google (pago único), política de privacidad publicada (hoy no existe: se guardan nombres y tokens, hay que declararlo igual), formulario de seguridad de datos de Google Play.
8. **Costos.** Todo lo anterior probablemente rompe el "gratis" actual (Vercel Hobby + Upstash free); escalar implica aceptar un costo mensual o revisar la decisión de "sin monetización" (ver "Decisiones tomadas" en `CLAUDE.md`). No hace falta resolverlo ahora, pero es una bifurcación futura a tener presente, no algo que se resuelve solo.

Nada de esto es urgente ni bloquea nada hoy: queda como mapa de ruta para cuando (si) haga falta.
