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
- **Commits pequeños**, uno por paso lógico, con mensaje descriptivo.
- Antes de cambios grandes (nuevas dependencias, cambios de arquitectura, refactors amplios), **proponer el plan y esperar confirmación**.
- No introducir frameworks ni librerías nuevas sin justificarlo.
- Si una decisión no está en este archivo, preguntar en vez de asumir.
- **Al empezar cada fase, proponer primero el diseño** (clases, responsabilidades, riesgos) y esperar confirmación antes de escribir código.
- Responder y comentar en español; identificadores de código en inglés.
- Al cerrar cada fase o sesión importante, **actualizar "Estado actual" y "Decisiones tomadas"** en este archivo. Es la memoria del proyecto entre sesiones.
- Mantener `.gitignore` al día (`target/`, `build/`, `.idea/`, `node_modules/`, `.next/`, `*.log`). **Nunca** commitear contraseñas, tokens ni claves; usar variables de entorno.
- Si este archivo crece demasiado, mover el detalle a `docs/` e importarlo con `@ruta`, dejando aquí solo lo esencial.

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
/server      (pospuesto, aún no existe) Spring Boot: motor de reglas + red
/client      Next.js (lobby, UI, tablero 3D) — es lo único activo hoy
/docs        Diagramas, decisiones (ADR) y prototipos
  /prototipos/tablero-3d.html   Referencia visual (ver abajo)
```

El **motor de reglas** debe vivir en un módulo aislado, **sin dependencias de UI, red ni base de datos**, para poder testearlo por separado. Hoy será TypeScript puro dentro de `/client` (carpeta propia, sin imports de React/Next); si se porta a Java, el diseño es un paquete/módulo Java puro.

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

- Terrenos: 4 bosque, 4 pradera, 4 campo, 3 colina, 3 montaña, 1 desierto (mezclados).
- Números de ficha: 2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12 (el desierto no lleva).
- Los números 6 y 8 **no pueden estar en casillas adyacentes**.
- 9 puertos en la costa, separados por 3, 3 y 4 aristas de forma cíclica: 4 genéricos (3:1) y 5 específicos (2:1, uno por recurso). Reparto aleatorio.

## Verificación y tests

- **Unitarios** del tablero (invariantes de arriba) y de cada regla (construcción, distancia mínima entre poblados, producción, ladrón, comercio, victoria).
- **Simulación masiva:** miles de partidas de bots aleatorios de punta a punta, comprobando invariantes en cada paso (los recursos no se crean ni se pierden, no hay estados inválidos, las partidas terminan). Es la mejor forma de encontrar bugs de reglas.
- Los comandos ilegales deben devolver un error claro, nunca lanzar excepciones no controladas.
- Comandos (desde `client/`): `npm run dev` (localhost:3000), `npm run build`, `npm run lint`. Aún no hay runner de tests: elegirlo al empezar el motor de reglas. Backend Java (pospuesto): `./mvnw test` o `./gradlew test`.

## Referencia visual (cliente 3D)

Existe un prototipo funcional en `docs/prototipos/tablero-3d.html` (three.js r128, JavaScript plano, geometría procedural). **Es la referencia de estilo, no código a copiar.** El cliente definitivo lo reimplementa con React Three Fiber, conservando lo siguiente:

**Escala y capas** (circunradio de casilla = 1)
- Casilla: extrusión hexagonal biselada, cara superior a `y = 0.4`, separación entre casillas ≈ 0.12.
- Nivel del agua `y = 0.16`, marco de madera hexagonal (radio interior 6.4) alrededor de todo el mar.
- Sobre una mesa de madera que se pierde en niebla.

**Estilo:** *low-poly* estilizado con colores vivos, no fotorrealista.

| Terreno | Color base | Decorado |
|---|---|---|
| Bosque | `#3f8f45` | abetos de 3 conos |
| Pradera | `#a7d15c` | ovejas |
| Campo | `#e8bf45` | espigas instanciadas en filas |
| Colina | `#c96a3b` | pilas de ladrillos y montículos |
| Montaña | `#8d949c` | picos con nieve y rocas |
| Desierto | `#e3c78d` | dunas y cactus |

- Fichas de número crema, con **6 y 8 en rojo** y puntos de probabilidad.
- Colores de jugador: rojo `#d94141`, azul `#3b6fd6`, naranja `#f0932b`, blanco `#f1eee6`.
- Piezas: casa (perfil de casa extruido), ciudad (sala + torre), camino (prisma), ladrón (torno + esfera).
- Puertos: barco con vela y cartel `3:1` / `2:1` con franja del color del recurso, unido a la costa por dos muelles.

**Render**
- Pipeline en sRGB con tone mapping ACES Filmic, sombras suaves (PCF soft, 2048), mapa de entorno generado por gradiente, niebla que coincide con el fondo.
- Tres iluminaciones con transición suave: **día**, **atardecer** (sol bajo y cálido) y **noche** (luna azulada y dos luces cálidas).
- Cámara orbital con zoom y ángulo limitados, sin paneo; campo de visión mayor en pantallas verticales.
- Extras deseados: casilla que se levanta al pasar el cursor, salto de casillas al tirar dados, barcos que se mecen, agua animada. **Descartado:** efecto "maqueta" (desenfoque arriba y abajo); se probó y se quitó por no aportar.
- Presupuesto orientativo del prototipo: ~35 mil triángulos y ~500 objetos. Si el rendimiento en móvil lo exige, usar instancing y fusionar geometrías estáticas.

**Assets definitivos** (fase de pulido): modelos glTF (comprimidos con Draco/KTX2), texturas propias, HDRI y postprocesado (bloom, oclusión ambiental, corrección de color).

## Decisiones tomadas (y por qué)

- **Mapa hexagonal clásico** (19 casillas). Otros mapas llegarán como variantes configurables.
- **Alcance:** jugar con amigos y portfolio. Sin monetización, cuentas complejas ni matchmaking.
- **Cliente web (Next.js + React Three Fiber) y no Unity.** Motivos: se juega abriendo un link, sin instalar nada; encaja con el stack del desarrollador; una demo online luce más en un portfolio. Como el servidor es autoritativo, el cliente es intercambiable: si algún día se quiere publicar en Steam, se puede hacer un cliente Unity contra el mismo backend.
- **Spring Boot como servidor de reglas** (no Node), con estado en memoria y snapshots en Postgres.
- **Prototipo visual aprobado** (`docs/prototipos/tablero-3d.html`): el estilo, la paleta y la iluminación se mantienen en el cliente definitivo.
- **Maven o Gradle:** se recomendó Maven por ser lo más estándar en Spring Boot; pendiente de confirmar (ver abajo).

- **Nombre: Paisano** (lema «Hacé tu tierra.», voseo rioplatense). Elegido por no parecerse a Colonist ni a Catan. Pendiente: búsqueda rápida de marca y disponibilidad de URL.
- **Replanteo (sept 2026): prueba gratis primero.** Sin hosts de pago ni backend propio hasta validar que el juego sirve. Cliente Next.js desplegado en Vercel Hobby (gratis, uso no comercial). Vercel no mantiene WebSockets, así que el multijugador por turnos usará API routes + base de datos gratuita (Upstash Redis o Neon) + polling cada 1-2 s. El motor de reglas pasa provisionalmente a **TypeScript** (servidor autoritativo dentro de Next); si la prueba funciona, puede portarse a Java/Spring. Alternativa descartada por ahora: P2P con WebRTC.
- **Repo y deploy (sept 2026):** monorepo en GitHub con `git` y auth por navegador (sin `gh` CLI, no hace falta). Vercel importa el repo con Root Directory `client`; no se instaló el plugin de Vercel para agentes.
- **Prototipo portado con three r128 fijo.** No actualizar three sin revisar el aspecto (cambian encodings y colores). Migrar a React Three Fiber cuando el estado del juego lo justifique.

## Hoja de ruta

1. **Modelo del tablero** con tests de invariantes.
2. **Motor de reglas** del juego base en Java puro, con tests.
3. **Bots y simulación masiva** de partidas.
4. **Servidor Spring Boot:** REST, WebSocket, salas por link, reconexión, persistencia de eventos.
5. **Cliente Next.js con 3D básico:** partida completa jugable con formas simples.
6. **Variantes configurables** (`GameConfig` y módulos de reglas).
7. **Arte y pulido:** modelos, iluminación, animaciones y sonido.
8. **Deploy y portfolio:** Docker Compose, CI, demo online, README con diagramas y un video o GIF.

Estado actual: **replanteo (sept 2026)**. Prioridad: prueba jugable y gratis con amigos, sin backend Java ni cuentas por ahora. Hecho: Node 24 instalado; `/client` (Next.js + TypeScript, npm) con el prototipo 3D portado (three r128 exacto desde npm, JS plano en `client/src/lib/board.js`) y corriendo en localhost (`cd client; npm run dev`). Repo en GitHub (`PabloSalvaR/paisano`, remoto `origin`) y desplegado en Vercel Hobby (Root Directory = `client`); cada push a `main` despliega solo y el tablero 3D se ve bien en el link público. **Ahora:** pulido visual del prototipo 3D (aspecto) antes de avanzar. **Después:** motor de reglas en TypeScript (proponer primero el diseño) y multijugador. Las fases 1-4 originales (Java/Spring) quedan pospuestas.

## Decisiones pendientes

- Maven o Gradle (recomendado: Maven con wrapper).
- **Separar el motor de reglas en un módulo propio** (por ejemplo, un módulo Maven `engine` sin dependencias de Spring, que `server` consuma). Así el compilador impide que el motor dependa de Spring. Proponer estructura en la fase 1.
- Librería de tests (propuesta: JUnit 5 + AssertJ; evaluar tests basados en propiedades para las simulaciones).
- Nombre de paquetes Java (si se retoma el backend): `com.<org>.paisano`.
- Login: solo nombre + token, o también Google/Discord.
- Hosting de la demo (VPS pequeño, Railway o Fly.io).
