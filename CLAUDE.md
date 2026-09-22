# Proyecto: Paisano — «Piedra y camino»

Juego de estrategia multijugador en 3D para jugar con amigos en el navegador, inspirado en los juegos de colonización por recursos. Objetivo doble: divertirse con amigos y servir de proyecto de portfolio.

Diferenciador principal: **el anfitrión configura las reglas libremente** (variantes y expansiones como módulos activables por sala), sin bloqueos por compra.

## Contexto y entorno del desarrollador

- Desarrollador **fullstack** (Next.js y Spring Boot). Quiere **entender y revisar** el diseño: explicar las decisiones importantes de forma breve y clara, sin volcar código enorme sin contexto.
- Motivación del proyecto: el juego digital de referencia resulta restrictivo con sus expansiones (contenido bloqueado por compra). Aquí todo debe poder activarse libremente. Meta visual: acercarse a la calidad de ese juego (colores vivos, iluminación cuidada, animaciones).
- Sistema: **Windows 11**. Los comandos se dan en **PowerShell** (rutas con `\`, varias carpetas con `mkdir a, b`). Instalación de herramientas con `winget`. El desarrollador corre el servidor de desarrollo desde **Git Bash** (en PowerShell `npm.ps1` está bloqueado por la política de ejecución; alternativa: `npm.cmd`). Preferir comandos que funcionen en ambos shells (por ejemplo `cd client; npm run dev`).
- Sin `gh` CLI: el repo se maneja con `git` y autenticación por navegador. `git push` lo corre el desarrollador en su terminal (desde Claude Code no hay interacción para autenticar).
- Ya instalado: Node 24 + npm (`/client`), JDK 21 (Temurin), Git, IntelliJ IDEA (por si se retoma `/server`) y VS Code (para `/client`).
- Aún **no** instalado: Docker Desktop (solo si se retoma el backend Java). Avisar antes de necesitarlo.
- Al usar Maven o Gradle, usar siempre el **wrapper** (`mvnw` / `gradlew`), sin exigir instalación global.

## Reglas de trabajo con Claude Code

- Trabajar **una fase a la vez** (ver "Hoja de ruta"). No adelantar fases sin que se pida.
- **Tests primero** en el motor de reglas. Ningún cambio de reglas sin test que lo cubra.
- **Commits conceptuales y agrupados:** uno por paso lógico completo, no uno por retoque, para que el historial se pueda leer. Mensaje descriptivo, con la lista de lo que trae. **Si el desarrollador hace varios pedidos chicos seguidos, no commitear cada uno:** esperar a que lo pida o a cerrar un bloque grande (se le tuvo que corregir esto varias veces).
- Antes de cambios grandes (nuevas dependencias, cambios de arquitectura, refactors amplios), **proponer el plan y esperar confirmación**.
- No introducir frameworks ni librerías nuevas sin justificarlo.
- Si una decisión no está en este archivo, preguntar en vez de asumir.
- **Al empezar cada fase, proponer primero el diseño** (clases, responsabilidades, riesgos) y esperar confirmación antes de escribir código.
- Responder y comentar en español; identificadores de código en inglés.
- Al cerrar cada fase o sesión importante, **actualizar "Estado actual" y "Decisiones tomadas"** en este archivo. Es la memoria del proyecto entre sesiones.
- Mantener `.gitignore` al día (`target/`, `build/`, `.idea/`, `node_modules/`, `.next/`, `*.log`). **Nunca** commitear contraseñas, tokens ni claves; usar variables de entorno.
- Este archivo tiene que quedar corto: el detalle va a `docs/` (ver abajo). Se referencia por **ruta simple, sin `@`**: un `@archivo` se carga entero en cada sesión y no ahorra contexto.

## Documentación detallada (`docs/`)

Leer el archivo que corresponda **antes de tocar ese tema**:

- `docs/multijugador.md`: sesiones (`GameSession`), salas, API, bots, reglas de seguridad y reproducción de eventos en el tablero.
- `docs/referencia-visual.md`: especificación del tablero 3D (medidas, colores, piezas, luces, cámara, banner, dados). El código de `client/src/lib/board.js` manda si difiere.
- `docs/decisiones-interfaz.md`: decisiones de interfaz y su porqué (confirmar construcciones, sonido, botón de turno, textos en voseo, comercio con el banco, adornos de la mesa).

## Propiedad intelectual

Las mecánicas no están protegidas, pero el nombre, el arte, los textos y la marca sí. **No usar** el nombre "Catan", ni sus textos, ni sus ilustraciones, ni su iconografía. Todo el arte y los textos deben ser propios o con licencia libre (CC0/CC-BY, registrando la atribución).

## Stack

**Vigente hoy (prueba gratis):** Next.js + TypeScript en Vercel Hobby, three r128 fijo, motor de reglas en TypeScript dentro de Next (API routes), y para multijugador Upstash Redis o Neon + polling cada 1-2 s. La tabla siguiente es el **stack objetivo original** (Java/Spring), pospuesto hasta validar el juego.

| Capa | Tecnología |
|---|---|
| Servidor | Java 21 + Spring Boot (virtual threads) |
| Tiempo real | Spring WebSocket (STOMP opcional) |
| API auxiliar | REST (salas, lobby, perfiles, historial) |
| Persistencia | PostgreSQL (snapshots y eventos de partida) |
| Cliente | Next.js + React + TypeScript |
| 3D | React Three Fiber + drei (three.js) |
| Animación UI | react-spring o GSAP |
| Build backend | Maven o Gradle (**por decidir**) |
| CI / deploy | GitHub Actions + Docker Compose |

Alcance deliberadamente recortado: **sin** matchmaking, rankings, anti-trampas avanzado, escalado horizontal ni Redis. Una sola instancia con estado en memoria y snapshots en Postgres.

## Estructura del repositorio (monorepo)

```
/client          Next.js: tablero 3D, interfaz y, por ahora, el servidor de la prueba — es lo único activo hoy
  src/engine     motor de reglas (TypeScript puro: sin React, Next ni red) y sus tests (Vitest)
  src/server     salas, almacén, vista filtrada y capa HTTP (sin Next: se prueba con Vitest)
  src/bots       bots: misma interfaz que un jugador (elige entre las acciones legales)
  src/lib        tablero 3D (board.js), láminas de las cartas (cardart.js), audio y GameSession (sesión local y remota)
  src/app        páginas y Route Handlers (/api/rooms/**)
/docs            documentación detallada (ver arriba)
/prototipos      referencias visuales del desarrollador (láminas, capturas, logo, manual). Fuera de git por copyright: solo de inspiración, el arte se dibuja propio
/server          (pospuesto, sin contenido) Spring Boot: motor de reglas + red, si se retoma el backend Java
```

El **motor de reglas** vive aislado, **sin dependencias de UI, red ni base de datos**, para poder testearlo por separado. Hoy es TypeScript puro en `client/src/engine/`; si se porta a Java, el diseño es un paquete/módulo Java puro.

## Arquitectura

### Principios

1. **Servidor autoritativo.** El cliente nunca decide nada: envía *intenciones* (comandos) y renderiza lo que el servidor confirma.
2. **Comandos → validación → eventos.** Cada acción del jugador es un comando; el motor lo valida y emite eventos (`ResourcesDistributed`, `SettlementBuilt`, ...). El estado se puede reconstruir reproduciendo eventos.
3. **El servidor envía las acciones legales.** No duplicar reglas en TypeScript: el cliente solo muestra lo que el servidor declara permitido en cada momento.
4. **Los bots usan la misma interfaz que los jugadores.** Un bot es un cliente que elige entre las acciones legales.
5. **Reglas modulares.** Variantes y expansiones son módulos activables mediante un `GameConfig` por sala.

### Motor de reglas

- Estado del juego controlado (inmutable o con mutación encapsulada) y determinista: mismo estado + mismo comando + misma semilla = mismos eventos.
- El azar (dados, mezcla de mapa y cartas) entra por una **fuente aleatoria inyectable con semilla**, para poder reproducir partidas y hacer tests.
- Fases: colocación inicial, turno (dados, producción, ladrón con el 7, comercio, construcción, cartas de desarrollo), reconocimientos especiales (camino más largo, ejército) y victoria.
- API mínima esperada: `applyCommand(state, command) -> Result<events | error>` y `legalActions(state, playerId)`.

### Red

- WebSocket para la partida; REST para lo demás.
- Salas por **link**. Identidad simple: nombre + token guardado en el navegador (login social opcional más adelante).
- **Reconexión**: un jugador que se cae y vuelve recupera el estado exacto.
- Los eventos se persisten para **repeticiones** y recuperación tras reinicio.

### Configuración de reglas (`GameConfig`)

Ejemplos de opciones a soportar como módulos: puntos para ganar, generador de mapa y tamaño, mazo de cartas de desarrollo, límites de comercio, tamaño de la mano antes de descartar, cantidad de piezas por jugador. Cada opción tiene un valor por defecto igual al juego base.

## Modelo del tablero

Mapa hexagonal de casillas con la punta hacia arriba (*pointy-top*), coordenadas **axiales** `(q, r)`.

- Posición en el mundo (circunradio = 1): `x = √3 · (q + r/2)`, `z = 1.5 · r`.
- Esquinas de una casilla: para `k = 0..5`, ángulo `a = π/2 + k·π/3`, posición `(cx + cos a, cz − sin a)`.
- Vecinos axiales: `(+1,0) (+1,−1) (0,−1) (−1,0) (−1,+1) (0,+1)`.
- Vértices = intersecciones (se deduplican por posición); aristas = caminos entre vértices adyacentes.

**Invariantes del tablero base** (deben tener test):

- 19 casillas, 54 vértices, 72 aristas, 30 aristas de costa.
- Cada vértice toca entre 1 y 3 casillas.
- Cada arista une exactamente 2 vértices adyacentes.

**Generación por defecto del mapa base:**

- Terrenos: 4 bosque, 4 llano, 4 campo, 3 barro, 3 cantera, 1 desierto (mezclados).
- Números de ficha: 2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12 (el desierto no lleva).
- Los números 6 y 8 **no pueden estar en casillas adyacentes**, y **dos casillas vecinas nunca llevan el mismo número** (regla añadida sept 2026: el método oficial de colocación en espiral tampoco los junta; con azar puro ~81 % de los mapas los juntaban). Se genera con azar + reintento hasta cumplir ambas.
- 9 puertos en la costa, separados por 3, 3 y 4 aristas de forma cíclica: 4 genéricos (3:1) y 5 específicos (2:1, uno por recurso). Reparto aleatorio.

## Verificación y tests

Comandos, siempre desde `client/` (preferir formas que funcionen en Git Bash y PowerShell):

- `npm test`: Vitest (motor, salas, API, bots y sesión; sin red). Tiene que pasar entero.
- `npm run test:upstash`: las mismas pruebas del almacén contra la base Upstash real (lee `client/.env.local`; se salta sola sin credenciales).
- `npx tsc --noEmit` y `npm run build`: tipos y compilación de Next (también valida las rutas de `/api`).
- `npm run dev` (localhost:3000): el desarrollador suele tenerlo ya corriendo; si el puerto está ocupado, usar ese servidor y no cerrarlo.
- `npm run lint`: da un error previo por `@ts-nocheck` en `board.js`; revisar lo que se toque con `npx eslint <archivos>`.

Qué se prueba:

- **Unitarios** del tablero (invariantes de arriba) y de cada regla (construcción, distancia mínima, producción, ladrón, comercio con el banco, victoria).
- **Simulación masiva:** partidas de bots aleatorios de punta a punta, comprobando invariantes en cada paso (los recursos no se crean ni se pierden, no hay estados inválidos). Es la mejor forma de encontrar bugs de reglas.
- **Salas y API:** flujo completo, seguridad (token, vista filtrada, semillas), choques de versión y cuerpos mal formados.
- Los comandos ilegales devuelven un error claro, nunca lanzan excepciones no controladas.

Cambios del cliente 3D: además de los tests, verlos en Chrome (skill `claude-in-chrome`, con `?debug` para armar situaciones y clics reales) en escritorio y celular. Lo que no se puede comprobar así (sonido, ritmo de las pausas, sensación de las animaciones; una pestaña en segundo plano retrasa las animaciones) se le pide al desarrollador.

**Una fase está hecha cuando:** los tests pasan, `tsc` y `build` compilan, el cliente se verificó como se describe arriba, se anotó qué quedó sin probar a mano y se actualizó "Estado actual".

## Decisiones tomadas (y por qué)

Las de interfaz están en `docs/decisiones-interfaz.md`.

- **Mapa hexagonal clásico** (19 casillas). Otros mapas llegarán como variantes configurables.
- **Alcance:** jugar con amigos y portfolio. Sin monetización, cuentas complejas ni matchmaking.
- **Cliente web (Next.js + React Three Fiber) y no Unity.** Motivos: se juega abriendo un link, sin instalar nada; encaja con el stack del desarrollador; una demo online luce más en un portfolio. Como el servidor es autoritativo, el cliente es intercambiable: si algún día se quiere publicar en Steam, se puede hacer un cliente Unity contra el mismo backend.
- **Spring Boot como servidor de reglas** (no Node), con estado en memoria y snapshots en Postgres. **Pospuesto** por el replanteo de sept 2026 (ver abajo): hoy el motor es TypeScript dentro de Next.
- **Nombre: Paisano** (lema «Piedra y camino», que reemplazó a «Hacé tu tierra.» y a «Es mi destino, piedra y camino» en sept 2026; voseo rioplatense). Elegido por no parecerse a Colonist ni a Catan. Pendiente: búsqueda rápida de marca y disponibilidad de URL.
- **Replanteo (sept 2026): prueba gratis primero.** Sin hosts de pago ni backend propio hasta validar que el juego sirve. Cliente Next.js desplegado en Vercel Hobby (gratis, uso no comercial). Vercel no mantiene WebSockets, así que el multijugador por turnos usará API routes + base de datos gratuita (Upstash Redis o Neon) + polling cada 1-2 s. El motor de reglas pasa provisionalmente a **TypeScript** (servidor autoritativo dentro de Next); si la prueba funciona, puede portarse a Java/Spring. Alternativa descartada por ahora: P2P con WebRTC.
- **Repo y deploy (sept 2026):** demo pública en https://paisano-three.vercel.app. Monorepo en GitHub con `git` y auth por navegador (sin `gh` CLI, no hace falta). Vercel importa el repo con Root Directory `client`; no se instaló el plugin de Vercel para agentes.
- **Identidad argentina (sept 2026):** recursos y decorado con sabor local: el terreno **Llano** (antes Pradera) produce **Vaca** (no oveja/lana), Campo produce **Maíz** (no trigo), los terrenos pasan a llamarse **Cantera** (antes Montaña, produce **Piedra**, no mineral) y **Barro** (antes Colina, produce **Ladrillo**), bosque con árboles de copa ancha tipo ombú, cantera con rocas irregulares sin nieve. Se probó **Adobe** en lugar de Ladrillo (con hornos de barro) y se descartó. Mantener el resto de nombres y arte propios (ver "Propiedad intelectual").
- **Reparto de números (sept 2026):** se queda con azar + reintento (6 y 8 no vecinos, y ningún número igual al de una casilla vecina). La colocación oficial en espiral (secuencia fija de 18 fichas) se descartó por ahora por dar menos variedad; podría ofrecerse más adelante como opción de sala (`GameConfig`).
- **Servidor de la prueba = Next (Route Handlers) + almacén externo (sept 2026).** El motor TypeScript corre dentro de las Route Handlers; la partida se guarda como un documento JSON por sala con número de versión (guardado solo si la versión no cambió), sin tablas. Cada jugador recibe una vista filtrada (manos rivales y cartas de desarrollo ocultas). Spring Boot queda como opción futura, no requisito.
- **Motor (sept 2026):** estado JSON puro; `applyCommand(state, cmd)` devuelve un estado nuevo + eventos o un error con código (nunca lanza por comandos ilegales); `legalActions(state, player)`. Los dados salen de `semilla + contador` guardados en el estado (flujo separado del mapa). Costos del juego base: camino 1 madera + 1 ladrillo; poblado camino + 1 vaca + 1 maíz; ciudad 2 maíz + 3 piedras; carta de desarrollo 1 vaca + 1 maíz + 1 piedra. Piezas por jugador: 15 caminos, 5 poblados, 4 ciudades. 3 o 4 jugadores. Si el banco no alcanza: cobra solo quien esté solo en ese recurso; si hay varios, nadie.
- **Orden hacia una partida completa con amigos (sept 2026):** el objetivo es pasarles un link y jugar una partida entera, así que el multijugador va antes que las cartas de desarrollo. Antes hace falta lo mínimo de comercio (banco y puertos), para que una partida no se atasque. **Comercio con el banco (motor, sept 2026):** un intercambio por comando (`bankTrade { give, get }`: entrega `tasa` cartas iguales, recibe 1), solo en fase `main`; la tasa es la mejor entre 4:1, 3:1 con puerto genérico y 2:1 con el específico del recurso, contando poblados y ciudades en cualquiera de los dos vértices del puerto; el banco tiene que tener la carta pedida (`bank-empty`). Las tasas viven en `GameConfig.trade` (sin interfaz para cambiarlas hasta la fase de variantes). El comercio entre jugadores queda para después del multijugador. **Upstash Redis:** el desarrollador crea la cuenta gratis cuando toque (URL y token en variables de entorno, nunca en el repo); avisarle antes de necesitarla.
- **Prototipo portado con three r128 fijo.** No actualizar three sin revisar el aspecto (cambian encodings y colores). Migrar a React Three Fiber cuando el estado del juego lo justifique.
- **Orden del multijugador (sept 2026): bots antes que humanos.** Primero una partida contra bots en el navegador (6a), después la sala online con amigos (6b). La razón: probar reglas, animaciones y sonido sin depender de otras personas. Los bots usan la misma interfaz que un jugador y son aleatorios a propósito; se pueden mejorar después sin tocar el resto.
- **«Jugar online» deshabilitado en el menú (sept 2026):** en `/`, el botón pasó de `Link` a `<button disabled>`, grisado y sin texto aclaratorio (no navega ni al hacer clic). Es a propósito, para que en los despliegues del demo por ahora solo se pueda probar contra bots y no se use el modo online (consumo de Upstash). No se tocó la ruta `/sala` ni la API de salas: siguen andando si se entra por URL directa; el corte es solo en el punto de entrada del menú. Revertir es sacar el `disabled` y volver a `Link href="/sala"`.
- **Sesión de juego (sept 2026):** el tablero solo conoce `GameSession` (vista del jugador, `send(comando)`, `subscribe`); ya no aplica reglas ni ve el estado completo. Con bots o en línea, lo que hicieron otros llega como lista de eventos y el tablero los reproduce en orden. Detalle en `docs/multijugador.md`.
- **Partida online (sept 2026):** sala por link `/sala/CODIGO` (6 caracteres sin letras ambiguas), identidad por token en `localStorage` y polling de 1,5 s con `?since=versión`; recargar recupera el estado exacto y no repite lo ya jugado. Detalle y límites en `docs/multijugador.md`.
- **Almacén en Upstash sin librería (sept 2026):** habla con la API REST por `fetch` (no se sumó `@upstash/redis`); dos claves por sala, scripts Lua atómicos para crear y para guardar-si-la-versión-no-cambió, vencimiento de 6 horas sin actividad (cada guardado lo renueva; era de 7 días y se acortó en sept 2026 a pedido del desarrollador), eviction desactivada. Elegido por `instance.ts` según las variables de entorno. Si la base falla, la API responde 503.
- **Versión visible (sept 2026):** el menú muestra `v` + la versión de `client/package.json` (hoy `0.1.0`). Se queda en `0.1.0` hasta salir a producción; todo lo anterior es prueba casera.
- **Cartas de desarrollo, ejército y ruta más larga (sept 2026, motor):** nombres propios por propiedad intelectual: **Gaucho** (caballero), **Acopio** (monopolio), **Buena cosecha** (año de abundancia), **Vialidad** (2 caminos gratis), **Estancia** (punto de victoria), **Ruta más larga** y **Milicia más grande** (2 puntos cada una, mínimos 5 caminos y 3 gauchos, y solo se pierden si los superan estrictamente; si se corta la ruta y queda un empate entre otros, nadie la tiene). En el código: `knight`, `monopoly`, `yearOfPlenty`, `roadBuilding`, `victoryPoint`. Mazo de 25 (14/5/2/2/2, en `GameConfig.devDeck`) barajado con su propia semilla y guardado en el estado (nunca sale del servidor). Una carta por turno y no la comprada ese turno (`devNew`); **todas** las cartas activas se pueden jugar antes o después de tirar los dados (`moveRobber`, `steal` y `roadBuilding` recuerdan a qué fase volver con `after`; corregido en sept 2026 tras contrastar con las reglas oficiales). Buena cosecha toma 2 cartas, o 1 si el banco solo tiene 1 (`plentyCount`, `LegalAction.count`). El Punto de victoria es un punto oculto que puede ganar la partida en el acto al comprarlo. **Ganar en tu turno:** al pasar el turno se revisa el puntaje de quien lo recibe (`endTurn` llama a `checkWin`), para quien llegó a 10 por un reconocimiento que cambió de manos en turno ajeno. Vialidad es la fase `roadBuilding` (2 caminos sin pagar; termina sola si no hay dónde). La vista filtrada muestra cuántas cartas tiene cada uno, no cuáles; `DevCardBought` solo dice el tipo a quien compró. Código: `engine/awards.ts` y `engine/devcards.ts`.
- **Arte de las cartas (sept 2026):** todo el arte de las cartas es propio y procedural (`cardart.js`), inspirado en las referencias del desarrollador pero sin copiarlas (por la regla de propiedad intelectual). Las cartas de desarrollo se ven **como cartas** (retrato 128 × 200, marco crema, ventana con la ilustración y cinta con el nombre) y se generan una vez como imagen (`devCardURL`). El naipe de adorno de la mesa es el **11 de bastos** (el caballero), no el 3. **Su lámina (sept 2026):** el desarrollador la generó con ChatGPT tomando como referencia un naipe real de baraja española (`prototipos/11 de bastos.jpg`). Se probaron tres versiones (un SVG que en realidad era una imagen de 256 × 384 px en franjas, una en pixel art y una de trazo limpio) y **se eligió la de trazo limpio** (`prototipos/11bastos.png`, 1024 × 1536). En el juego va achicada a **512 × 768 (443 KB)** en `client/public/cartas/11-de-bastos.png`, que es lo que necesita el lienzo de 512 px de la carta; los originales quedan solo en `prototipos/` (fuera de git). El tablero la carga al arrancar y, mientras baja o si falla, muestra el dibujo propio de `cardart.js`. **Origen a verificar (riesgo bajo):** se parece mucho al naipe de referencia, que parece de una baraja comercial; si esa edición sigue protegida, sería una obra derivada. Es un solo adorno de la mesa y muchos diseños clásicos de baraja española son de dominio público, así que no bloquea nada: si se quiere cerrar el tema, confirmar de qué edición sale la referencia (dominio público o licencia libre) o cambiarla por arte propio (basta reemplazar ese único PNG, en proporción 2:3). El juego en sí no repite nombre, arte ni textos del juego de referencia.
- **Nomenclatura y apertura (sept 2026):** las piezas se llaman **Casa** (antes Poblado) y **Estancia** (antes Ciudad); la carta que era «Estancia» pasó a **Punto de victoria** (mismo dibujo, ahora con un sol brillante). Los identificadores en inglés no cambiaron (`settlement`, `city`, `victoryPoint`). La colocación inicial son dos fases (1: horaria; 2: antihoraria, el último juega dos veces) y el primer turno es de quien la abrió, después horario. **Quién abre se sortea con una tirada de dados** (`GameConfig.firstPlayer: null`): cada jugador tira 2 dados desde la semilla y abre el mayor total; si hay empate arriba, tiran de nuevo solo los empatados (`drawFirstPlayer`). El resultado queda en `state.opening` (rondas de `{ player, roll }`, público; el campo no se llama `dice` para que el test que vigila la fuga de `state.dice` siga siendo exacto) y el ganador en `state.first`. Por defecto el motor usa 0 (no hay tirada) para no romper tests; las salas y la partida local pasan `null`. El tablero muestra el sorteo al empezar (tocar lo salta; **tu propia tirada la hacés vos con el botón «Tirar mis dados»**, la de los demás sale sola) y recién después arranca la colocación; durante el sorteo no se marca de quién es el turno para no adelantar el resultado; si abre un bot, `LocalSession.kick()` lo hace jugar tras la animación (ya no juega en el constructor).
- **Nombre del reconocimiento (sept 2026):** se llama **Milicia más grande** (antes «Montonera más grande»; «milicia» es un sustantivo colectivo, así que nombra el grupo). Lo que se cuenta siguen siendo los **Gauchos jugados**. Los identificadores no cambian (`largestArmy`).
- **Nombre en la partida contra bots (sept 2026):** `/jugar/bots` pide primero el nombre (como el modo online, con el último usado y guardado en `localStorage`) y el primer asiento pasa a llamarse así (ya no «Tomás»). Los bots conservan Lucía, Mateo y Sofía; si el nombre coincide con uno, ese bot pasa a «… (bot)». La mesa local de 4 en la misma pantalla sigue con los nombres de siempre.
- **Selector de personaje (sept 2026):** 8 personajes elegibles (4 gauchos con sombrero, 4 criollas; `client/src/lib/characters.ts`), como avatar en la pantalla «Tu nombre» de `/jugar/bots`. **Alcance a propósito acotado:** solo ahí, todo en el cliente (`localStorage`, junto con el nombre); no toca la mesa local ni las salas online, que siguen con su elenco fijo de siempre — sumarlo ahí implicaría mandar el personaje elegido al crear/unirse a la sala y guardarlo en el estado (`PlayerState`/`RoomView`), fuera de alcance por ahora. El **personaje (piel, pelo, sombrero o pañuelo) está desacoplado del color de asiento** (que sigue fijo por posición: rojo/azul/naranja/blanco, para que las piezas del tablero se distingan siempre igual); por eso **dos jugadores de la misma partida pueden elegir el mismo personaje sin problema** (el color de asiento ya los distingue). Dibujo propio con SVG en `characterSVG` (`client/src/lib/board.js`, reexportada para el selector); los 4 nuevos (Facundo, Ramón, Rosario, Milagros) suman bigote y pañuelo como variantes. **Pantalla más simple (sept 2026):** se sacó el párrafo explicativo («Vas a jugar contra tres bots…») y el nombre de cada personaje debajo de su foto; queda directo «Ingresá tu nombre» sobre el campo y «Elegí tu personaje» sobre el grid, solo con las fotos (el nombre de cada uno pasa a `title`/`aria-label` del botón, para accesibilidad). El nombre que importa en la mesa sigue siendo el que escribe el jugador, no el del personaje.
- **Selector de color de asiento (sept 2026, solo contra bots):** en la misma pantalla, arriba del personaje, un tercer selector para elegir el color propio entre los 4 fijos (rojo/azul/naranja/blanco). El color elegido se **intercambia** con el del asiento que lo tenía por posición (nunca se duplica un color; nombres y personajes de los demás asientos no se mueven, solo el color) — código en `board.js` (`PLAYER_INFO`, `SEAT_COLORS` ahora con un `id` estable) e `identity.ts` (`saveColor`/`colorStore`, mismo patrón que el personaje). Mismo alcance acotado que el personaje: solo `/jugar/bots`, todo en el cliente, no toca la mesa local ni las salas online. **Pensado para extenderse a lo online más adelante** (no implementado): ahí hará falta, además de mandar el color al crear/unirse a la sala, decidir cómo se reservan los colores a medida que se van sumando jugadores al lobby (para que dos personas no elijan el mismo). El rojo (`SEAT_COLORS[0]`) además pasó de `#d94141` a un tono más intenso y saturado, `#c81e1e` (el anterior se veía rosado); cambia en todos lados donde se usa ese mismo rojo (asiento, dado/carta, ícono de la app, botón de rechazar, flechas y estados de error).
- **Primer avance de pulido gráfico (sept 2026, fase 8):** cuatro retoques puntuales, elegidos por el desarrollador después de una sesión de ideas. **Árboles con brisa:** cada árbol del bosque (ya eran grupos 3D independientes) se guarda en una lista con una fase al azar y se mece apenas (`rotation.x`/`z`, dos senos de distinta frecuencia como el titileo del farol) en el loop de render; mismo patrón que el balanceo de los botes, pero mucho más sutil. **Descartado:** mover los botes más (ya se balanceaban; el desarrollador lo consideró ruido visual) y humo en el farol (no sumar más elementos sueltos sobre la mesa). **Íconos de maíz y piedra con más profundidad:** el resto de los íconos de recursos quedan como estaban a propósito (el desarrollador los prefiere simples, para reconocerlos de un vistazo); solo maíz (hileras de grano y un penacho) y piedra (dos facetas de luz/sombra por pico, más un par de grietas) se retocaron por pedido explícito. **Animación al jugar una carta:** Gaucho, Acopio, Buena cosecha y Vialidad ya no desaparecen en el acto; reusan el lenguaje visual del robo (un ícono que "se va" volando) con la miniatura de la carta (`devCardURL`), saliendo del puesto del jugador y desvaneciéndose sin destino, porque se descarta (`cardLeaves` en `board.js`). **Copa de campeón y resumen de fin de partida:** al ganar, una copa dorada (dibujo propio, dos tonos) aparece un instante en el centro para toda la mesa (`showTrophy`, mismo mecanismo que el destape de cartas), y se abre un panel de resumen bien corto y pensado para el ancho de un celular (`renderSummary`): una fila por jugador con avatar, nombre, insignias si tiene ruta más larga o milicia, casas/estancias y puntos finales; se arma solo con lo que ya es público durante la partida (nada de manos ni cartas ajenas). Se abre una sola vez (con el evento en vivo, o al entrar a una partida ya terminada) y no vuelve a abrirse sola después de cerrarla (importa con el polling en línea). Verificado con Chrome (`?debug`, `window.__paisano.mutate` para forzar el estado sin jugar una partida entera). **Ficha del ladrón más grande** (escala 1.25, a pedido del desarrollador tras verlo en el tablero): se notaba poco al lado del resto de las piezas.
- **Comercio entre jugadores (sept 2026):** solo el jugador de turno propone (fase `main`, «doy X, pido Y», a todos o a algunos); los demás responden sí/no, **quien propuso elige con cuál de los que aceptaron concreta** (sin carrera: importa con polling y bots) y no hay contraoferta. Una oferta abierta a la vez; mientras dura no se hace otra cosa (`trade-open`); si todos rechazan se cierra sola. Tope **5 ofertas por turno** en `GameConfig.trade.maxOffersPerTurn` (regla, para cualquiera); el bot se autolimita a **2** (`BOT_MAX_OFFERS`, su lógica, no una regla; bajó de 3 en la sesión del 22 sept porque insistía de más). Estado: `state.trade` (público) y `state.tradeOffers`. Único comando que se acepta fuera de turno: `respondTrade`. Código: `engine/offers.ts`; bots en `bots/smart.ts` y `nextBot`/`playBots` (`bots/play.ts`), que esperan a las personas consultadas. **Descartado (22 sept 2026):** contraofertas y comerciar fuera de turno (siempre el jugador de turno tiene el control); no se van a hacer, para no complicar las cosas. **Paciencia del bot para ofrecer (sept 2026, tras la primera partida jugada de punta a punta):** antes ofrecía casi todos los turnos apenas le faltaban 1 o 2 cartas para una compra; ahora el primer intento de cada turno se arriesga con una probabilidad (`TRADE_EAGERNESS` en `bots/smart.ts`: 65 % si le falta una sola carta, 35 % si le faltan dos), como si prefiriera esperar a los dados antes de resignar una carta que puede hacer falta con un 7 o un robo. Detalle y los otros dos retoques de esa misma sesión (✓ oculto en vez de grisado cuando no se puede aceptar, flechas verde/roja en la oferta) en `docs/decisiones-interfaz.md`.
- **Bot con criterio (sept 2026):** `smartBot` (`bots/smart.ts`) es el bot por defecto (el aleatorio queda para simulaciones): puntúa casas por probabilidad, variedad y puerto, prioriza estancias, juega el ladrón contra el que va ganando, descarta lo que más le sobra y comercia con banco y jugadores solo si completa una compra. En 60 partidas de 1 bot listo contra 3 aleatorios gana más de la mitad (test). No es un jugador experto.
- **Ciclo de vida del motor en el servidor (sept 2026):** una sala = un documento JSON con versión; los bots juegan dentro de la misma petición que les deja el turno (Vercel no tiene procesos en segundo plano); el token del navegador se guarda solo como hash en la sala.

## Hoja de ruta

Las fases 1-4 del plan original (Java/Spring) quedan pospuestas: se hicieron en TypeScript dentro de `/client`.

1. **Modelo del tablero** con tests de invariantes. — hecho
2. **Motor de reglas** del juego base con tests. — hecho, salvo el comercio entre jugadores
3. **Bots y simulación masiva.** — hecho (bot aleatorio, simulación, bots dentro de la sala)
4. **Servidor de la prueba:** Route Handlers + almacén de salas. — hecho (almacén en memoria y en Upstash)
5. **Cliente jugable:** partida local, contra bots y online por sala. — hecho (falta probar online con amigos en dos dispositivos)
6. **Cartas de desarrollo y comercio entre jugadores** (motor, interfaz y bots). — cartas, ejército y ruta más larga: hechos (motor, vista, bots e interfaz); comercio entre jugadores: hecho (motor, API, bots, interfaz y reglamento; falta probarlo entre dos personas en línea)
7. **Variantes configurables** (`GameConfig` por sala y módulos de reglas).
8. **Arte y pulido:** modelos, iluminación, animaciones y sonido. — en curso (tablero, adornos y cartas hechos; ver «Estado actual»)
9. **Deploy y portfolio:** README con capturas o GIF, demo online (Docker Compose y CI solo si se retoma el backend Java).

## Estado actual

**Sept 2026.** Prioridad: prueba jugable y gratis con amigos, sin backend Java ni cuentas. Demo en Vercel Hobby (Root Directory `client`; cada push a `main` despliega solo). Repo `PabloSalvaR/paisano`.

**Hecho**
- Tablero 3D con identidad argentina, luces día/atardecer/noche, dados, banner de recursos y jugadores, adornos de la mesa (pulido visual del tablero cerrado por ahora).
- Motor (`client/src/engine/`): tablero, mapa con semilla, colocación inicial, dados y producción, construcción (caminos, poblados, ciudades), 7 con descarte, ladrón y robo, comercio con el banco (4:1, puertos 3:1 y 2:1) y **entre jugadores**, victoria, **cartas de desarrollo** (comprar, Gaucho, Acopio, Buena cosecha, Vialidad, Estancia), **milicia más grande** y **ruta más larga**. Decisiones en «Decisiones tomadas».
- Servidor de la prueba: salas (vencen a las 6 h sin actividad), almacén en memoria **y en Upstash Redis** (probado contra la base real), vista filtrada (no sale el mazo ni las cartas ajenas), API completa y bots dentro de la sala. Ver `docs/multijugador.md`.
- Cliente conectado por `GameSession`: **menú de inicio en `/`** (bots, online, mesa local y **Reglamento**, con la versión de `package.json` y el lema «Piedra y camino»), tablero sin red en `/jugar/bots` y `/jugar/local`, con reproducción de eventos y los bots esperando 2 s antes de cada acción.
- **Partida online por sala:** `/sala` (crear o unirse), `/sala/CODIGO` (lobby con «Sumar bot» y «Empezar», partida), `RemoteSession` con polling que gasta poco (pestaña oculta cada 20 s, en tu turno cada 15 s, pausa a los 5 min sin actividad), token en `localStorage`, «Salir al menú». **Probada con PC + celular + bot** (sept 2026): sin problemas a la vista. La API pública responde bien (sin el 503 de la base).
- **Interfaz de las cartas de desarrollo:** botón «Carta» (compra con ✓/✕ y destape de la carta comprada), botón «Mis cartas» con el panel de cartas (con forma de carta, cantidad, «nueva» y «Jugar»; las que no se pueden jugar se ven atenuadas, sin mensaje), modales de Acopio y Buena cosecha, modo ladrón para el Gaucho, Vialidad con marcadores y «faltan N», y en los puestos el contador de cartas y las insignias de ruta más larga y milicia. Detalle en `docs/decisiones-interfaz.md`.
- **Arte de las cartas (sept 2026):** `client/src/lib/cardart.js`, dibujo propio con canvas (sin imágenes), inspirado en las referencias de `prototipos/`: el **11 de bastos** de la mesa, que ahora usa la lámina de trazo limpio `client/public/cartas/11-de-bastos.png` (ver «Decisiones tomadas»; el dibujo propio de `cardart.js` queda de respaldo) y las cinco cartas de desarrollo (Gaucho con vincha roja, chaqueta azul, faja, bombachas bordó, sable y caballo; Acopio con sacos y maíz; Buena cosecha con sol y espigas; Vialidad con camino y alambrado; Estancia con casco, ombú y estrella).
- **Comercio entre jugadores (sept 2026):** panel «Jugadores» y diálogos para ofrecer y responder («doy X, pido Y»), concretar con quien aceptó, y **bot con criterio** (`smartBot`, bot por defecto) que construye, comercia con el banco y con jugadores solo si completa una compra, y le gana al azar más de la mitad de las veces (test). Detalle en «Decisiones tomadas».
- **Selector de personaje (sept 2026, solo contra bots):** en la pantalla «Tu nombre» de `/jugar/bots`, un grid de 8 personajes (`client/src/lib/characters.ts`) para elegir el avatar; se guarda junto con el nombre (`identity.ts`). Detalle en «Decisiones tomadas».
- Verificado con Chrome (clics reales y `?debug`): construir con ✓/✕, dados y producción, 7 con descarte y robo, comercio con el banco y entre jugadores, bots, online, comprar y jugar cada carta, insignias, elegir personaje y verlo en la mesa, ancho de celular (en un marco de 390 px), destape y panel con las láminas nuevas.

**Ajustes de sept 2026 (hechos, commiteados y pusheados):** sorteo de quién abre con dados (tu tirada es por botón), nombre propio en la partida contra bots, puestos en dos filas con las insignias dentro (el facón es el ícono de los gauchos jugados), sonidos del ladrón y la victoria, insignias de ruta y gauchos siempre visibles, cámara que gira al terminar, fases de la colocación, sorteo de quién abre, renombrado (Casa, Estancia, Punto de victoria), **todas las cartas activas jugables antes de tirar**, **victoria al empezar el turno**, Buena cosecha con el banco casi vacío, comercio entre jugadores y bot con criterio (ver «Decisiones tomadas» y `docs/decisiones-interfaz.md`). Arte: **mate** y **facón** (ver `docs/referencia-visual.md`). `npm run build` (22 sept 2026) compila sin errores: queda cerrada la definición de «hecho» para estas fases.

**Sesión de pruebas del 22 de sept 2026 (post-push):**
- Sonidos (`seven`, `robberMoved`, `robbed`, `victory`, `card`): probados, están bien.
- Comercio entre jugadores: probado con bots en local y online, en general bien. **Bug encontrado y arreglado:** el bot a veces le repetía la misma oferta 2 o 3 veces seguidas a quien ya la había rechazado (`proposeCommand` en `bots/smart.ts` elegía el recurso con `tradeOffers % spare.length`, que con un solo recurso sobrante siempre daba la misma cuenta; además dos objetivos distintos —casa, carta— podían coincidir en pedir lo mismo). Ahora arma todas las ofertas distintas posibles y no repite ninguna sin que algo haya cambiado en el medio (test agregado en `smart.test.ts`); de paso, `BOT_MAX_OFFERS` bajó de 3 a 2 para que insistan menos en general.
- Celular real: se ve bastante bien. **A retocar, hecho:** el recuadro de los dados tapaba bastante el tablero; se achicó en el `@media (max-width:640px)` de `globals.css` (200→160 px de ancho, dado de 42→34 px). Verificado con Chrome (viewport de 390 px vía iframe, ya que `resize_window` no achicaba esta ventana).
- Sorteo de quién abre (con desempate y «Tirar mis dados»), insignias con números de dos dígitos, mate y facón de noche y de lejos: probados en pantalla real, todo bien.

**Pausa de reglas (sept 2026).** El desarrollador cerró la lógica hasta acá: el reloj de turno y las variantes quedan pendientes, sin urgencia. El foco pasa al pulido gráfico (fase 8) y a probar con amigos.

**Sesión del 22 de sept 2026 (después del push anterior, ya commiteada y pusheada):** oferta de comercio sin repetirse y recuadro de dados más chico (verificados); **selector de personaje** (8 avatares, solo `/jugar/bots`); **reglamento** con palabras del juego resaltadas y «Fase 1»/«Fase 2» con mayúscula (sin «sentido horario» en el juego, eso queda solo en el reglamento); **puertos** rediseñados como plataforma chata entre los muelles, sin «2:1» en el específico; **logo** movido al menú desplegable en celular. Todo verificado con Chrome (viewport de 390 px simulado con un iframe, porque `resize_window` no achicaba la ventana esa sesión), `npm test` (234), `tsc`, `eslint` y `npm run build`.

**Sesión del 22 de sept 2026 (después de la primera partida jugada de punta a punta contra bots):** a partir de ese juego, varios retoques de comercio y menús. **Comercio entre jugadores:** los bots ya no ofrecen todos los turnos (`TRADE_EAGERNESS` en `bots/smart.ts`), el ✓ se oculta (no se grisa) cuando no se puede aceptar, y las ofertas usan flechas verde ↓ / roja ↑ en vez de texto (detalle en `docs/decisiones-interfaz.md`). **«Jugar online» deshabilitado** en el menú (grisado, para que el demo público por ahora solo se pueda probar contra bots). **Menús más directos:** la pantalla «Tu nombre» de `/jugar/bots` perdió el párrafo explicativo y los nombres bajo cada personaje (solo fotos), y el menú de inicio perdió el «Elegí cómo querés jugar» (redundante con los botones). **Primer avance de pulido gráfico** (fase 8): árboles con brisa, íconos de maíz y piedra con más profundidad, animación de "se va volando" al jugar una carta de desarrollo, y copa de campeón + resumen de fin de partida (todo el detalle en «Decisiones tomadas»). Verificado con Chrome (`?debug`, `window.__paisano.mutate` para armar situaciones sin jugar una partida entera), `npm test` (234), `tsc` y `npm run build`.

**Sesión del 22 de sept 2026 (continuación, después de repasar reparto de números/puertos y el flujo online con el desarrollador):** **selector de color de asiento** (solo contra bots, se intercambia con el bot que lo tenía) y **rojo más intenso** en todo el proyecto (`#d94141` → `#c81e1e`, el anterior se veía rosado); **selector de color** más chico, a la escala de los avatares; **ficha del ladrón** más grande (detalle de estos cuatro en «Decisiones tomadas»). **Documentación:** confirmado con fuentes externas que el reparto de mapa y puertos (azar + reintento para 6/8 y vecinos, esqueleto de puertos fijo con tipo al azar) es una variante legítima del juego de referencia, no una licencia propia (sin cambios de código); nueva sección en `docs/multijugador.md` sobre qué pasa hoy al terminar una partida (nada persiste) y qué haría falta para escalar más allá de "probar con amigos", con la Play Store como caso concreto (empaquetar la web actual con TWA/Capacitor sería lo más simple, sin reescribir el motor). Verificado con Chrome, `npm test` (234), `tsc` y `npm run build`.

**Al retomar (pendiente inmediato, en este orden)**
1. **Probar en un celular real** lo de la sesión del 22 de sept: el selector de personaje, los puertos nuevos y el logo dentro del menú (solo se vieron en el viewport simulado de Chrome, nunca en pantalla real).
2. Antes de invitar a mucha gente: leer en el FAQ de Upstash qué pasa al llegar al tope del plan gratis (el consumo medido: ~660 comandos en una tarde corta de pruebas; ver `docs/multijugador.md`).

**Siguiente (sin orden fijo, a elección del desarrollador)**
- **Portfolio (fase 9):** README con capturas o GIF y la demo online.
- **Pulido gráfico** (fase 8): lo que el desarrollador vaya marcando. Primer avance (árboles con brisa, íconos de maíz/piedra, animación de cartas al jugarlas, copa y resumen de fin de partida) en «Decisiones tomadas». Sin probar a mano: cómo se siente el balanceo de los árboles y el ritmo de la animación de las cartas en una partida real (solo se vio con Chrome y `?debug`).
- **Tiempo límite por turno y reemplazo por un bot.** El diseño está en `docs/multijugador.md` («Diseño propuesto: tiempo límite por turno…») y **faltan las respuestas del desarrollador a 4 preguntas** (reloj de turno vs presencia, duración por defecto y opciones, reemplazo permanente o recuperable, aviso previo). Empezar por ahí y por los tests.
- **Comercio: tiempo límite para responder una oferta** (sin urgencia; hoy, si una persona no responde, la oferta de un bot espera). Contraofertas y comerciar fuera de turno se descartaron (ver «Decisiones tomadas»): no van, para no complicar las cosas.
- Variantes configurables (`GameConfig` por sala). También obligan a revisar el reglamento.
- Bots menos aleatorios; marca «bot» en los puestos de la partida y nombres propios para los bots locales.
- **Escalar más allá de "probar con amigos" (por ejemplo, Play Store):** análisis sin implementar en `docs/multijugador.md` («Fin del flujo hoy, y qué falta para escalar»). Hoy ninguna partida deja rastro al terminar (ni historial ni estadísticas); escalar de verdad pide tiempo real sin polling, backend y persistencia reales, cuentas, notificaciones y moderación. Empaquetar para Android sería lo más simple de la lista (TWA o Capacitor sobre la web actual, sin reescribir el motor).
- **Selector de personaje en la mesa local y en las salas online** (hoy solo en `/jugar/bots`, ver «Decisiones tomadas»). Para online implica tocar `PlayerState`/`RoomView` y la API de salas, no solo el cliente.

**Sin probar a mano:** el sonido de las cartas, aterrizaje y comercio; el ritmo de las pausas de los bots (2 s antes de cada acción, 650 ms por pieza, 800 el ladrón, 450 el cambio de turno); las animaciones con la pestaña visible; cartas de otros humanos en línea; y un ancho real de celular (solo se vio en un marco de 390 px). Se le suma de la última sesión: si la nueva paciencia de los bots para ofrecer comercio se siente natural, el balanceo de los árboles y la animación de "se va volando" al jugar una carta, en una partida real jugada de punta a punta (solo se vieron con Chrome y `?debug`). Limitaciones conocidas: los bots son aleatorios y en la partida local contra bots comparten nombre con los puestos de siempre (en línea se llaman «Bot 1», «Bot 2»…); ver los límites de la parte online en `docs/multijugador.md`.

## Decisiones pendientes

- **Repo público (sept 2026):** se habló y la recomendación fue dejarlo público (portfolio; no hay secretos en el repo ni en el historial; `prototipos/` y `.env*` están ignorados). Queda a decisión del desarrollador: (a) si poner una **licencia** (sin ninguna, público no significa reutilizable; por ejemplo MIT si se quiere abierto), y (b) si reescribir en este archivo la mención del juego de referencia (sección «Propiedad intelectual») como «el juego de referencia».
- **Origen del naipe del 11 de bastos:** riesgo bajo, a verificar (ver «Arte de las cartas» en «Decisiones tomadas»): confirmar de qué edición sale la referencia o reemplazar el PNG por arte propio.
- **Solo si se retoma el backend Java:** Maven o Gradle (recomendado: Maven con wrapper), separar el motor en un módulo propio sin Spring, JUnit 5 + AssertJ, nombre de paquetes (`com.<org>.paisano`).
- Login: solo nombre + token, o también Google/Discord (por ahora, nombre + token).
- **Distribución de los dados** como opción de sala (`GameConfig`): dados reales (por defecto) o mazo barajado de las 36 combinaciones. La semilla por partida con flujos separados (mapa, dados, robos) y el contador guardado en el estado ya están hechos.
- **Marca de «bot»** en los puestos de la partida (en el lobby online ya llevan la etiqueta «bot») y nombres propios para los bots de la partida local.
- **`client/AGENTS.md` y `client/CLAUDE.md`:** los recrea Next.js al correr `npm run dev`; desde sept 2026 `next.config.ts` tiene `agentRules: false` (ya no se generan) y además están en el `.gitignore` de `client/`. El CLAUDE.md que manda es el de la raíz.
- Búsqueda de marca y disponibilidad de URL para el nombre Paisano.
