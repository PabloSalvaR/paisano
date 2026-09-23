# Refactor del tablero (`client/src/lib/board.js`): pendiente

Propuesto el 23 sept 2026 y dejado para más adelante, a pedido del desarrollador. **No está empezado.**

## Por qué

`board.js` tiene ~2750 líneas y es **una sola función** (`initBoard`, de la línea ~151 al final) que mezcla la escena 3D, la
interfaz de encima (armada con strings e `innerHTML`), la reproducción de eventos y las animaciones. Todo comparte las
variables internas de esa función (escena, cámara, `game`, `legal`, `busy`, manos, puestos…), así que para entender o cambiar
una parte hay que leer casi todo.

## Plan en tres etapas

1. **Dividir en módulos** (sin cambiar comportamiento ni aspecto). Es la que más ayuda a leerlo, casi sin riesgo.
2. **Pasar la interfaz de encima a componentes de React** (puestos, banner, paneles de comercio y cartas, resumen). Ahí se
   hace la mayoría de los cambios de interfaz; no toca el 3D ni three.js.
3. **React Three Fiber para la escena**, solo si se quiere después. Obliga a actualizar three.js (R3F pide ≥ 0.156; el
   proyecto usa 0.128 fija porque cambian el color y la intensidad de las luces): hay que recalibrar el aspecto en una sesión
   dedicada. Con las etapas 1 y 2 hechas, queda chica.

## Etapa 1 en detalle

**Estado compartido:** `initBoard` arma un objeto `ctx` con lo que hoy son variables compartidas; cada módulo es una función
`crearX(ctx)` que devuelve sus funciones públicas (por ejemplo `crearPuestos(ctx)` → `{ renderSeats, … }`). Así cada archivo
dice qué usa. Las funciones que se llaman entre la interfaz y la reproducción se registran en `ctx` después de crear los módulos.

**Archivos** (en `client/src/lib/board/`; `page.tsx` sigue importando desde `@/lib/board`):

| Archivo | Qué tiene |
|---|---|
| `index.js` | `initBoard`: arma `ctx`, conecta los módulos, `dispose` |
| `markup.js` | `MARKUP` y `SEAT_COLORS` |
| `scene.js` | renderer, cámara, luces, mapa de entorno, tamaño y bucle |
| `textures.js` | texturas procedurales |
| `materials.js` | geometrías y materiales compartidos |
| `table.js` | mesa, marco y mar |
| `decor.js` | mate, facón, farol, pava, naipe, botes |
| `terrain.js` | decoración por terreno (árboles, vacas, rocas…) |
| `ports.js` | puertos |
| `map.js` | armado del tablero (casillas, fichas, vértices, marcadores) |
| `pieces.js` | casas, estancias, caminos, ladrón y `syncPieces` |
| `input.js` | clics y toques sobre el tablero |
| `dice.js` | dados |
| `hud/seats.js`, `hud/hand.js`, `hud/dialogs.js`, `hud/trade.js`, `hud/cards.js`, `hud/summary.js` | interfaz de encima |
| `opening.js` | sorteo de quién abre |
| `replay.js` | reproducción de eventos |

**Orden (un commit por paso):** 1) 3D estático (texturas, materiales, mesa, adornos, terreno, puertos); 2) escena y tablero
(renderer, cámara, bucle, tamaño, mapa, piezas, clics, dados); 3) interfaz y sorteo; 4) reproducción de eventos e `index.js` liviano.

**Verificación en cada paso:** `npm test`, `tsc`, `npm run build`; capturas antes y después con un mapa fijo (sumar
`?seed=` al modo `?debug`): tablero de día y de noche, puestos, oferta, cartas y resumen; y una partida rápida con clics reales.

**Fuera de la etapa 1:** pasar a TypeScript (después, de a un módulo, sacando el `@ts-nocheck`).

**Riesgos:** el orden de inicialización (hoy se usan funciones antes de declararlas dentro de la misma función); las llamadas
cruzadas entre interfaz y reproducción. Estimado: dos o tres sesiones, casi todo de verificación.

## Performance (consulta del desarrollador)

- Separar en módulos **no cambia la velocidad**: Next junta los módulos en pocos archivos al compilar y llamar una función de
  otro módulo cuesta lo mismo.
- R3F bien usado rinde igual (las animaciones van con `useFrame`, sin pasar por el estado de React); mal usado (estado de React
  que cambia en cada cuadro) empeora. Suma ~40–50 KB comprimidos.
- Lo que sí pesa: el trabajo de cada cuadro (hoy se redibuja siempre, aunque nada cambie; redibujar solo cuando hace falta
  ahorraría batería en el celular, con o sin R3F) y el armado inicial de la mesa (geometría y texturas por código: el par de
  segundos de «Armando la mesa…»).
