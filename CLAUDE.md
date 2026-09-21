# Proyecto: Paisano — «Hacé tu tierra.»

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
- **Commits conceptuales y agrupados:** uno por paso lógico completo, no uno por retoque, para que el historial se pueda leer. Mensaje descriptivo.
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
  src/lib        tablero 3D (board.js), audio y GameSession (sesión local y, después, remota)
  src/app        páginas y Route Handlers (/api/rooms/**)
/docs            documentación detallada (ver arriba)
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

- `npm test`: Vitest (motor, salas, API, bots y sesión). Tiene que pasar entero.
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
- **Nombre: Paisano** (lema «Hacé tu tierra.», voseo rioplatense). Elegido por no parecerse a Colonist ni a Catan. Pendiente: búsqueda rápida de marca y disponibilidad de URL.
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
- **Ciclo de vida del motor en el servidor (sept 2026):** una sala = un documento JSON con versión; los bots juegan dentro de la misma petición que les deja el turno (Vercel no tiene procesos en segundo plano); el token del navegador se guarda solo como hash en la sala.

## Hoja de ruta

Las fases 1-4 del plan original (Java/Spring) quedan pospuestas: se hicieron en TypeScript dentro de `/client`.

1. **Modelo del tablero** con tests de invariantes. — hecho
2. **Motor de reglas** del juego base con tests. — hecho, salvo cartas de desarrollo, ejército, camino más largo y comercio entre jugadores
3. **Bots y simulación masiva.** — hecho (bot aleatorio, simulación, bots dentro de la sala)
4. **Servidor de la prueba:** Route Handlers + almacén de salas. — hecho con almacén en memoria; falta Upstash
5. **Cliente jugable:** partida local, contra bots y online por sala. — hecho (falta probar online con amigos en dos dispositivos)
6. **Cartas de desarrollo y comercio entre jugadores** (motor, interfaz y bots).
7. **Variantes configurables** (`GameConfig` por sala y módulos de reglas).
8. **Arte y pulido:** modelos, iluminación, animaciones y sonido.
9. **Deploy y portfolio:** README con capturas o GIF, demo online (Docker Compose y CI solo si se retoma el backend Java).

## Estado actual

**Sept 2026.** Prioridad: prueba jugable y gratis con amigos, sin backend Java ni cuentas. Demo en Vercel Hobby (Root Directory `client`; cada push a `main` despliega solo). Repo `PabloSalvaR/paisano`.

**Hecho**
- Tablero 3D con identidad argentina, luces día/atardecer/noche, dados, banner de recursos y jugadores, adornos de la mesa (pulido visual cerrado por ahora).
- Motor (`client/src/engine/`): tablero, mapa con semilla, colocación inicial, dados y producción, construcción (caminos, poblados, ciudades), 7 con descarte, ladrón y robo, comercio con el banco (4:1, puertos 3:1 y 2:1), victoria.
- Servidor de la prueba: salas, almacén en memoria, vista filtrada, API completa (crear, unirse, bots, empezar, comando, estado) y bots dentro de la sala. Ver `docs/multijugador.md`.
- Cliente conectado por `GameSession`: partida de 4 en la misma pantalla y **partida contra bots** (menú «Partida contra bots»), con reproducción de eventos.
- **Partida online por sala (6b):** `/sala` (crear o unirse), `/sala/CODIGO` («Hola, presentate compañero», lobby con «Sumar bot» y «Empezar», partida), `RemoteSession` con polling, token en `localStorage`, menú «Jugar online» / «Salir de la sala». Funciona con `npm run dev` o `next start`; **en Vercel todavía no** (falta Upstash).
- Verificado con Chrome (clics reales): construir con ✓/✕, dados y producción, 7 con descarte y robo, comercio, bots colocando y construyendo, y online (un jugador con la interfaz y otro más un bot por la API: colocación, ronda completa, recarga a mitad de partida, entrar por link, sala inexistente).

**Siguiente (orden acordado)**
1. **Jugar con amigos de verdad:** cuenta gratis de **Upstash Redis** (el desarrollador la crea; URL y token en variables de entorno, nunca en el repo; **avisarle antes de necesitarla**), `UpstashStore` (mismas operaciones que `MemoryStore`) y prueba en Vercel con dos dispositivos. Sin esto las salas no funcionan online, porque cada función de Vercel tiene su memoria.
2. Cartas de desarrollo (`buyDevCard`, ejército, camino más largo) y comercio entre jugadores. **Proponer el diseño primero**: hoy el botón «Carta» de la bandeja existe pero solo muestra un aviso, y el motor no tiene nada de esto.
3. Variantes configurables (`GameConfig` por sala).

**Sin probar a mano:** sonido de aterrizaje y de comercio, ritmo de las pausas de los bots (650 ms por pieza, 800 el ladrón, 450 el cambio de turno), animaciones con la pestaña visible, la partida online con dos personas y en un ancho real de celular. Limitaciones conocidas: los bots son aleatorios y en la partida local contra bots comparten nombre con los puestos de siempre (en línea se llaman «Bot 1», «Bot 2»…); ver los límites de la parte online en `docs/multijugador.md`.

## Decisiones pendientes

- **Solo si se retoma el backend Java:** Maven o Gradle (recomendado: Maven con wrapper), separar el motor en un módulo propio sin Spring, JUnit 5 + AssertJ, nombre de paquetes (`com.<org>.paisano`).
- Login: solo nombre + token, o también Google/Discord (por ahora, nombre + token).
- **Distribución de los dados** como opción de sala (`GameConfig`): dados reales (por defecto) o mazo barajado de las 36 combinaciones. La semilla por partida con flujos separados (mapa, dados, robos) y el contador guardado en el estado ya están hechos.
- **Marca de «bot»** en los puestos de la partida (en el lobby online ya llevan la etiqueta «bot») y nombres propios para los bots de la partida local.
- **`client/AGENTS.md`:** ya se borró del repo (commit `8555db3`), pero Next.js lo recrea al correr `npm run dev`. Si reaparece, no commitearlo o agregarlo al `.gitignore` de `client/`.
- Búsqueda de marca y disponibilidad de URL para el nombre Paisano.
