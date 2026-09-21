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
- **Sesión de juego (sept 2026):** el tablero solo conoce `GameSession` (vista del jugador, `send(comando)`, `subscribe`); ya no aplica reglas ni ve el estado completo. Con bots o en línea, lo que hicieron otros llega como lista de eventos y el tablero los reproduce en orden. Detalle en `docs/multijugador.md`.
- **Partida online (sept 2026):** sala por link `/sala/CODIGO` (6 caracteres sin letras ambiguas), identidad por token en `localStorage` y polling de 1,5 s con `?since=versión`; recargar recupera el estado exacto y no repite lo ya jugado. Detalle y límites en `docs/multijugador.md`.
- **Almacén en Upstash sin librería (sept 2026):** habla con la API REST por `fetch` (no se sumó `@upstash/redis`); dos claves por sala, scripts Lua atómicos para crear y para guardar-si-la-versión-no-cambió, vencimiento de 6 horas sin actividad (cada guardado lo renueva; era de 7 días y se acortó en sept 2026 a pedido del desarrollador), eviction desactivada. Elegido por `instance.ts` según las variables de entorno. Si la base falla, la API responde 503.
- **Versión visible (sept 2026):** el menú muestra `v` + la versión de `client/package.json` (hoy `0.1.0`). Se queda en `0.1.0` hasta salir a producción; todo lo anterior es prueba casera.
- **Cartas de desarrollo, ejército y ruta más larga (sept 2026, motor):** nombres propios por propiedad intelectual: **Gaucho** (caballero), **Acopio** (monopolio), **Buena cosecha** (año de abundancia), **Vialidad** (2 caminos gratis), **Estancia** (punto de victoria), **Ruta más larga** y **Montonera más grande** (2 puntos cada una, mínimos 5 caminos y 3 gauchos, y solo se pierden si los superan estrictamente; si se corta la ruta y queda un empate entre otros, nadie la tiene). En el código: `knight`, `monopoly`, `yearOfPlenty`, `roadBuilding`, `victoryPoint`. Mazo de 25 (14/5/2/2/2, en `GameConfig.devDeck`) barajado con su propia semilla y guardado en el estado (nunca sale del servidor). Una carta por turno y no la comprada ese turno (`devNew`); **todas** las cartas activas se pueden jugar antes o después de tirar los dados (`moveRobber`, `steal` y `roadBuilding` recuerdan a qué fase volver con `after`; corregido en sept 2026 tras contrastar con las reglas oficiales). Buena cosecha toma 2 cartas, o 1 si el banco solo tiene 1 (`plentyCount`, `LegalAction.count`). El Punto de victoria es un punto oculto que puede ganar la partida en el acto al comprarlo. **Ganar en tu turno:** al pasar el turno se revisa el puntaje de quien lo recibe (`endTurn` llama a `checkWin`), para quien llegó a 10 por un reconocimiento que cambió de manos en turno ajeno. Vialidad es la fase `roadBuilding` (2 caminos sin pagar; termina sola si no hay dónde). La vista filtrada muestra cuántas cartas tiene cada uno, no cuáles; `DevCardBought` solo dice el tipo a quien compró. Código: `engine/awards.ts` y `engine/devcards.ts`.
- **Arte de las cartas (sept 2026):** todo el arte de las cartas es propio y procedural (`cardart.js`), inspirado en las referencias del desarrollador pero sin copiarlas (por la regla de propiedad intelectual). Las cartas de desarrollo se ven **como cartas** (retrato 128 × 200, marco crema, ventana con la ilustración y cinta con el nombre) y se generan una vez como imagen (`devCardURL`). El naipe de adorno de la mesa es el **11 de bastos** (el caballero), no el 3. **Su lámina (sept 2026):** el desarrollador la generó con ChatGPT tomando como referencia un naipe real de baraja española (`prototipos/11 de bastos.jpg`). Se probaron tres versiones (un SVG que en realidad era una imagen de 256 × 384 px en franjas, una en pixel art y una de trazo limpio) y **se eligió la de trazo limpio** (`prototipos/11bastos.png`, 1024 × 1536). En el juego va achicada a **512 × 768 (443 KB)** en `client/public/cartas/11-de-bastos.png`, que es lo que necesita el lienzo de 512 px de la carta; los originales quedan solo en `prototipos/` (fuera de git). El tablero la carga al arrancar y, mientras baja o si falla, muestra el dibujo propio de `cardart.js`. **Origen a verificar (riesgo bajo):** se parece mucho al naipe de referencia, que parece de una baraja comercial; si esa edición sigue protegida, sería una obra derivada. Es un solo adorno de la mesa y muchos diseños clásicos de baraja española son de dominio público, así que no bloquea nada: si se quiere cerrar el tema, confirmar de qué edición sale la referencia (dominio público o licencia libre) o cambiarla por arte propio (basta reemplazar ese único PNG, en proporción 2:3). El juego en sí no repite nombre, arte ni textos del juego de referencia.
- **Nomenclatura y apertura (sept 2026):** las piezas se llaman **Casa** (antes Poblado) y **Estancia** (antes Ciudad); la carta que era «Estancia» pasó a **Punto de victoria** (mismo dibujo, ahora con un sol brillante). Los identificadores en inglés no cambiaron (`settlement`, `city`, `victoryPoint`). La colocación inicial son dos fases (1: horaria; 2: antihoraria, el último juega dos veces) y el primer turno es de quien la abrió, después horario. **Quién abre se sortea con la semilla** (`GameConfig.firstPlayer: null`, guardado en `state.first`; por defecto 0 en el motor para no romper tests; las salas y la partida local pasan `null`). Todavía no hay tirada de dados visible para decidirlo.
- **Ciclo de vida del motor en el servidor (sept 2026):** una sala = un documento JSON con versión; los bots juegan dentro de la misma petición que les deja el turno (Vercel no tiene procesos en segundo plano); el token del navegador se guarda solo como hash en la sala.

## Hoja de ruta

Las fases 1-4 del plan original (Java/Spring) quedan pospuestas: se hicieron en TypeScript dentro de `/client`.

1. **Modelo del tablero** con tests de invariantes. — hecho
2. **Motor de reglas** del juego base con tests. — hecho, salvo el comercio entre jugadores
3. **Bots y simulación masiva.** — hecho (bot aleatorio, simulación, bots dentro de la sala)
4. **Servidor de la prueba:** Route Handlers + almacén de salas. — hecho (almacén en memoria y en Upstash)
5. **Cliente jugable:** partida local, contra bots y online por sala. — hecho (falta probar online con amigos en dos dispositivos)
6. **Cartas de desarrollo y comercio entre jugadores** (motor, interfaz y bots). — cartas, ejército y ruta más larga: hechos (motor, vista, bots e interfaz); comercio entre jugadores: pendiente
7. **Variantes configurables** (`GameConfig` por sala y módulos de reglas).
8. **Arte y pulido:** modelos, iluminación, animaciones y sonido. — en curso (tablero, adornos y cartas hechos; ver «Estado actual»)
9. **Deploy y portfolio:** README con capturas o GIF, demo online (Docker Compose y CI solo si se retoma el backend Java).

## Estado actual

**Sept 2026.** Prioridad: prueba jugable y gratis con amigos, sin backend Java ni cuentas. Demo en Vercel Hobby (Root Directory `client`; cada push a `main` despliega solo). Repo `PabloSalvaR/paisano`.

**Hecho**
- Tablero 3D con identidad argentina, luces día/atardecer/noche, dados, banner de recursos y jugadores, adornos de la mesa (pulido visual del tablero cerrado por ahora).
- Motor (`client/src/engine/`): tablero, mapa con semilla, colocación inicial, dados y producción, construcción (caminos, poblados, ciudades), 7 con descarte, ladrón y robo, comercio con el banco (4:1, puertos 3:1 y 2:1), victoria, **cartas de desarrollo** (comprar, Gaucho, Acopio, Buena cosecha, Vialidad, Estancia), **montonera más grande** y **ruta más larga**. Decisiones en «Decisiones tomadas».
- Servidor de la prueba: salas (vencen a las 6 h sin actividad), almacén en memoria **y en Upstash Redis** (probado contra la base real), vista filtrada (no sale el mazo ni las cartas ajenas), API completa y bots dentro de la sala. Ver `docs/multijugador.md`.
- Cliente conectado por `GameSession`: **menú de inicio en `/`** (bots, online, mesa local y **Reglamento**, con la versión de `package.json` y el lema «Piedra y camino»), tablero sin red en `/jugar/bots` y `/jugar/local`, con reproducción de eventos y los bots esperando 2 s antes de cada acción.
- **Partida online por sala:** `/sala` (crear o unirse), `/sala/CODIGO` (lobby con «Sumar bot» y «Empezar», partida), `RemoteSession` con polling que gasta poco (pestaña oculta cada 20 s, en tu turno cada 15 s, pausa a los 5 min sin actividad), token en `localStorage`, «Salir al menú». **Probada con PC + celular + bot** (sept 2026): sin problemas a la vista. La API pública responde bien (sin el 503 de la base).
- **Interfaz de las cartas de desarrollo:** botón «Carta» (compra con ✓/✕ y destape de la carta comprada), botón «Mis cartas» con el panel de cartas (con forma de carta, cantidad, «nueva» y «Jugar»; las que no se pueden jugar se ven atenuadas, sin mensaje), modales de Acopio y Buena cosecha, modo ladrón para el Gaucho, Vialidad con marcadores y «faltan N», y en los puestos el contador de cartas y las insignias de ruta más larga y montonera. Detalle en `docs/decisiones-interfaz.md`.
- **Arte de las cartas (sept 2026):** `client/src/lib/cardart.js`, dibujo propio con canvas (sin imágenes), inspirado en las referencias de `prototipos/`: el **11 de bastos** de la mesa, que ahora usa la lámina de trazo limpio `client/public/cartas/11-de-bastos.png` (ver «Decisiones tomadas»; el dibujo propio de `cardart.js` queda de respaldo) y las cinco cartas de desarrollo (Gaucho con vincha roja, chaqueta azul, faja, bombachas bordó, sable y caballo; Acopio con sacos y maíz; Buena cosecha con sol y espigas; Vialidad con camino y alambrado; Estancia con casco, ombú y estrella).
- Verificado con Chrome (clics reales y `?debug`): construir con ✓/✕, dados y producción, 7 con descarte y robo, comercio con el banco, bots, online, comprar y jugar cada carta, insignias, ancho de celular (en un marco de 390 px), destape y panel con las láminas nuevas.

**Ajustes de sept 2026 (hechos y commiteados; falta el push):** sonidos del ladrón y la victoria, insignias de ruta y gauchos siempre visibles, cámara que gira al terminar, fases de la colocación, sorteo de quién abre, renombrado (Casa, Estancia, Punto de victoria), **todas las cartas activas jugables antes de tirar**, **victoria al empezar el turno** y Buena cosecha con el banco casi vacío (ver «Decisiones tomadas» y `docs/decisiones-interfaz.md`). Arte: **mate** (calabaza con textura, virola de acero, yerba de hojuelas con la misma montañita y un pozo más hondo, bombilla curva con el pico hacia afuera) y **facón** (cuchillo común: chapa plana y lisa, filo claro, manchas grises y unas grietas finas, sin óxido; ver `docs/referencia-visual.md`). Verificado con Chrome en escritorio y con los tests (205 pasan); **sin probar a mano:** cómo suenan los cuatro sonidos nuevos, el modal de Buena cosecha con el banco en 1 carta, y el mate y el facón desde lejos, de noche y en celular.

**Pausa de reglas (sept 2026).** El desarrollador cerró la lógica hasta acá: el comercio entre jugadores, el reloj de turno y las variantes quedan pendientes, sin urgencia. El foco pasa al pulido gráfico (fase 8) y a probar con amigos.

**Al retomar (pendiente inmediato, en este orden)**
1. **`git push`** desde la terminal del desarrollador (revisar con `git status -sb` cuántos commits faltan). El push despliega en Vercel. Después se puede borrar la rama de respaldo `backup-squash` (`git branch -D backup-squash`): guarda los 10 commits chicos que se juntaron en 4 el 21 de sept 2026.
2. **`npm run build`** desde `client/`, con el servidor de desarrollo **cerrado** (compartir la carpeta `.next` con `npm run dev` lo rompe): no se corrió tras las cartas de desarrollo, el 11 de bastos nuevo, el `cardart.js`, el reglamento, los sonidos, el mate ni el facón (`npx tsc --noEmit` y `npm test` sí pasan). Es lo único que falta de la definición de «hecho» para esas fases. Vercel también lo corre al desplegar.
3. **Escuchar `audio.card()`** (roce de naipe) y ajustarlo a gusto.
4. **Probar las cartas online con dos personas** (solo se probaron contra bots y en la partida local): comprar, jugar cada carta y ver qué llega al otro jugador (el tipo de carta comprada no debe verse).
5. **Probar en un celular real** (hasta ahora solo se vio el ancho de celular en un marco de 390 px): menú, reglamento, tablero, panel «Mis cartas» y las insignias de los puestos.
6. Antes de invitar a mucha gente: leer en el FAQ de Upstash qué pasa al llegar al tope del plan gratis (el consumo medido: ~660 comandos en una tarde corta de pruebas; ver `docs/multijugador.md`).

**Siguiente (sin orden fijo, a elección del desarrollador)**
- **Portfolio (fase 9):** README con capturas o GIF y la demo online.
- **Pulido gráfico** (fase 8): lo que el desarrollador vaya marcando. Ideas anotadas: iconos de recursos con arte propio, animación de las cartas al jugarlas, **pantalla de fin de partida** (hoy hay el mensaje de victoria, la fanfarria y el giro de cámara; no hay un panel de resumen) y una **tirada de dados visible para decidir quién abre** (hoy se sortea con la semilla y solo se anuncia en el banner).
- **Tiempo límite por turno y reemplazo por un bot.** El diseño está en `docs/multijugador.md` («Diseño propuesto: tiempo límite por turno…») y **faltan las respuestas del desarrollador a 4 preguntas** (reloj de turno vs presencia, duración por defecto y opciones, reemplazo permanente o recuperable, aviso previo). Empezar por ahí y por los tests.
- **Comercio entre jugadores** (con bots). **Proponer el diseño primero**: ofertas y contraofertas, quién puede aceptar, límites por turno y cómo responden los bots. Al terminarlo hay que **actualizar el reglamento** (`client/src/app/reglamento/page.tsx`, escrito a mano: hoy no lo menciona).
- Variantes configurables (`GameConfig` por sala). También obligan a revisar el reglamento.
- Bots menos aleatorios; marca «bot» en los puestos de la partida y nombres propios para los bots locales.

**Sin probar a mano:** el sonido de las cartas, aterrizaje y comercio; el ritmo de las pausas de los bots (2 s antes de cada acción, 650 ms por pieza, 800 el ladrón, 450 el cambio de turno); las animaciones con la pestaña visible; cartas de otros humanos en línea; y un ancho real de celular (solo se vio en un marco de 390 px). Limitaciones conocidas: los bots son aleatorios y en la partida local contra bots comparten nombre con los puestos de siempre (en línea se llaman «Bot 1», «Bot 2»…); ver los límites de la parte online en `docs/multijugador.md`.

## Decisiones pendientes

- **Repo público (sept 2026):** se habló y la recomendación fue dejarlo público (portfolio; no hay secretos en el repo ni en el historial; `prototipos/` y `.env*` están ignorados). Queda a decisión del desarrollador: (a) si poner una **licencia** (sin ninguna, público no significa reutilizable; por ejemplo MIT si se quiere abierto), y (b) si reescribir en este archivo la mención del juego de referencia (sección «Propiedad intelectual») como «el juego de referencia».
- **Origen del naipe del 11 de bastos:** riesgo bajo, a verificar (ver «Arte de las cartas» en «Decisiones tomadas»): confirmar de qué edición sale la referencia o reemplazar el PNG por arte propio.
- **Solo si se retoma el backend Java:** Maven o Gradle (recomendado: Maven con wrapper), separar el motor en un módulo propio sin Spring, JUnit 5 + AssertJ, nombre de paquetes (`com.<org>.paisano`).
- Login: solo nombre + token, o también Google/Discord (por ahora, nombre + token).
- **Distribución de los dados** como opción de sala (`GameConfig`): dados reales (por defecto) o mazo barajado de las 36 combinaciones. La semilla por partida con flujos separados (mapa, dados, robos) y el contador guardado en el estado ya están hechos.
- **Marca de «bot»** en los puestos de la partida (en el lobby online ya llevan la etiqueta «bot») y nombres propios para los bots de la partida local.
- **`client/AGENTS.md`:** ya se borró del repo (commit `8555db3`), pero Next.js lo recrea al correr `npm run dev`. Si reaparece, no commitearlo o agregarlo al `.gitignore` de `client/`.
- Búsqueda de marca y disponibilidad de URL para el nombre Paisano.
