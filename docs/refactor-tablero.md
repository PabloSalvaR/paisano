# Refactor del tablero (`client/src/lib/board/`)

Propuesto el 23 sept 2026. **Etapa 1 hecha el 24 sept 2026**; las etapas 2 y 3 siguen pendientes.

## Por qué

`board.js` tenía ~2750 líneas y era **una sola función** (`initBoard`) que mezclaba la escena 3D, la interfaz de encima
(armada con strings e `innerHTML`), la reproducción de eventos y las animaciones. Todo compartía las variables internas de
esa función (escena, cámara, `game`, `legal`, `busy`, manos, puestos…), así que para entender o cambiar una parte había que
leer casi todo.

## Plan en tres etapas

1. **Dividir en módulos** (sin cambiar comportamiento ni aspecto). — **hecha**
2. **Pasar la interfaz de encima a componentes de React** (puestos, banner, paneles de comercio y cartas, resumen). Ahí se
   hace la mayoría de los cambios de interfaz; no toca el 3D ni three.js.
3. **React Three Fiber para la escena**, solo si se quiere después. Obliga a actualizar three.js (R3F pide ≥ 0.156; el
   proyecto usa 0.128 fija porque cambian el color y la intensidad de las luces): hay que recalibrar el aspecto en una sesión
   dedicada. La recomendación (24 sept 2026) es no hacerla por ahora: con la etapa 1 el 3D ya queda en módulos claros de
   three.js y R3F no mejora la velocidad.

## Etapa 1: cómo quedó

`page.tsx` y `OnlineBoard.tsx` siguen importando `MARKUP`, `SEAT_COLORS` e `initBoard` desde `@/lib/board` (ahora
`board/index.js`). Los módulos ya no llevan `@ts-nocheck` ni `eslint-disable`: `npx eslint src/lib/board/` pasa (queda un
aviso previo por `window.location.assign`).

**Estado compartido:** `initBoard` arma un objeto `ctx` con la escena, la partida (`session`, `game`, `legal`, `me`,
`shown`, `busy`, `sending`, `playing`), lo que muestra la interfaz (`VIEWER`, `turn`, `myHand`, `counts`, `vps`…) y los
paneles (`buildMode`, `pendingCmd`, `tradeUI`, `cardsUI`, `summaryUI`, `offerShown`); cada campo está comentado en
`index.js`. Cada módulo es una función `createX(ctx)` que devuelve sus funciones públicas, y se registra en `ctx` con su
nombre: las llamadas entre módulos dicen de dónde vienen (`ctx.hud.renderSeats()`, `ctx.replay.dispatch(cmd)`,
`ctx.map.syncPieces()`). Lo que un módulo solo usa por dentro queda adentro (por ejemplo, los temporizadores de la oferta
en `hud.js` o las mallas del tablero en `map.js`, que se piden con `ctx.map.tiles()`).

| Archivo | Qué tiene |
|---|---|
| `index.js` | `initBoard`: arma `ctx`, conecta los módulos, partida nueva, bucle y `dispose` |
| `markup.js` | `MARKUP`, `SEAT_COLORS` y los íconos de los recursos (`RES_ICONS`) |
| `constants.js` | medidas del tablero, terrenos, recursos y cartas de desarrollo |
| `util.js` | azar con semilla, colores, lienzos, `reduced`, `sumOf`, `pressed` |
| `scene.js` | renderer, cámara y controles (vista por defecto, giro final), mapa de entorno, tamaño |
| `lights.js` | luces y momentos del día |
| `materials.js` | fábrica de materiales y texturas (`createKit`) y materiales de los asientos |
| `textures.js` | texturas procedurales de mesa, mar y terrenos |
| `table.js`, `decor.js` | mesa, marco y mar; mate, pava, naipes, facón y farol |
| `terrain.js`, `ports.js`, `pieces.js` | casillas y su decorado, fichas; puertos; casas, estancias, caminos y ladrón |
| `map.js` | el tablero de la partida: armado, piezas, pieza a confirmar, marcadores, ladrón y animación por cuadro |
| `input.js` | cartel del terreno bajo el puntero y toques sobre los marcadores |
| `dice.js` | dados, chip y estadística |
| `players.js` | asientos: nombre, personaje, color y sorteo de los bots |
| `hud.js` | interfaz de encima: puestos, banner, botones, estado y paneles (lo que pasará a React) |
| `fx.js` | animaciones de la interfaz (recursos que vuelan, cartas, placas, copa) |
| `opening.js` | sorteo de quién abre |
| `replay.js` | comandos a la sesión y reproducción de eventos |
| `bar.js`, `debug.js` | barra de controles; «Partida rápida» y gancho `?debug` |

**Diferencias con el plan original:** la interfaz quedó en un solo `hud.js` (más `fx.js` con las animaciones) en vez de seis
`hud/*.js`, porque la etapa 2 la reescribe entera en React; se sumaron `constants.js`, `util.js`, `players.js`, `fx.js`,
`bar.js` y `debug.js`. Se hizo en un solo commit (los pasos intermedios habrían pedido código de transición). Además:
`?debug&seed=N` fija el mapa (para comparar capturas) y `seeded()` del mate se unificó con `mulberry32` (era el mismo
algoritmo).

**Verificación (24 sept 2026):** `npm test` (262), `tsc`, `eslint` y `npm run build`; el HTML de `MARKUP` es idéntico al
anterior; capturas antes y después con `?debug&seed=12345` (tablero de día: 58 píxeles distintos sobre 1,1 millones, todos
del salto del ladrón; noche con «Mis cartas», igual); con clics reales: Acopio, construir un camino con ✓, pasar y tirar,
descarte, resumen final, sorteo contra bots, ofertas de bots (aceptar y el ✕ inmediato), varios turnos de bots y una sala
online (en memoria) con bots.

## Etapa 2: ideas para empezar

- El puente es un store chico en el cliente al que React se suscribe con `useSyncExternalStore`; la reproducción de eventos
  (`replay.js`) y `fx.js` lo actualizan en vez de tocar el DOM. Los campos de `ctx` que lee `hud.js` son justamente ese
  estado.
- Ir de a un panel (por ejemplo, primero el resumen final o «Mis cartas», que son los más aislados) y dejar las animaciones
  de `fx.js` como están (son imperativas y conviene que sigan así).
- **Error latente encontrado al verificar** (existía antes del refactor): si una animación de recursos que vuelan termina
  tarde (pasa con la pestaña en segundo plano, donde Chrome frena las animaciones pero no los temporizadores), su `gain()`
  suma sobre la mano ya sincronizada, a veces la del siguiente jugador en la mesa local; el banner queda mal hasta el
  próximo refresco. Con la interfaz en React conviene que el vuelo solo anime y que los números salgan del estado.

## Performance (consulta del desarrollador)

- Separar en módulos **no cambia la velocidad**: Next junta los módulos en pocos archivos al compilar y llamar una función de
  otro módulo cuesta lo mismo.
- R3F bien usado rinde igual (las animaciones van con `useFrame`, sin pasar por el estado de React); mal usado (estado de React
  que cambia en cada cuadro) empeora. Suma ~40–50 KB comprimidos.
- Lo que sí pesa: el trabajo de cada cuadro (hoy se redibuja siempre, aunque nada cambie; redibujar solo cuando hace falta
  ahorraría batería en el celular, con o sin R3F) y el armado inicial de la mesa (geometría y texturas por código: el par de
  segundos de «Armando la mesa…»).
