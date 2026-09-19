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
/docs        (por ahora no existe) diagramas y decisiones (ADR) cuando hagan falta
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

- Terrenos: 4 bosque, 4 llano, 4 campo, 3 barro, 3 cantera, 1 desierto (mezclados).
- Números de ficha: 2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12 (el desierto no lleva).
- Los números 6 y 8 **no pueden estar en casillas adyacentes**, y **dos casillas vecinas nunca llevan el mismo número** (regla añadida sept 2026: el método oficial de colocación en espiral tampoco los junta; con azar puro ~81 % de los mapas los juntaban). Se genera con azar + reintento hasta cumplir ambas.
- 9 puertos en la costa, separados por 3, 3 y 4 aristas de forma cíclica: 4 genéricos (3:1) y 5 específicos (2:1, uno por recurso). Reparto aleatorio.

## Verificación y tests

- **Unitarios** del tablero (invariantes de arriba) y de cada regla (construcción, distancia mínima entre poblados, producción, ladrón, comercio, victoria).
- **Simulación masiva:** miles de partidas de bots aleatorios de punta a punta, comprobando invariantes en cada paso (los recursos no se crean ni se pierden, no hay estados inválidos, las partidas terminan). Es la mejor forma de encontrar bugs de reglas.
- Los comandos ilegales deben devolver un error claro, nunca lanzar excepciones no controladas.
- Comandos (desde `client/`): `npm run dev` (localhost:3000), `npm run build`, `npm run lint`. Aún no hay runner de tests: elegirlo al empezar el motor de reglas. Backend Java (pospuesto): `./mvnw test` o `./gradlew test`.

## Referencia visual (cliente 3D)

La referencia visual es el propio tablero del cliente: `client/src/lib/board.js` (three.js r128, JavaScript plano, geometría procedural). Nació de un prototipo HTML (`docs/prototipos/tablero-3d.html`) que se **eliminó** por estar superado; sigue en el historial de git (commit `48ef43f`). Al migrar a React Three Fiber hay que conservar lo siguiente (las medidas de esta sección son la especificación de partida; el código manda si difiere):

**Escala y capas** (circunradio de casilla = 1)
- Casilla: extrusión hexagonal biselada, cara superior a `y = 0.4`. Las casillas van **pegadas** (radio 1 = circunradio de la grilla, sin hueco de agua); el bisel deja la línea divisoria.
- Nivel del agua `y = 0.16`, marco de madera hexagonal (radio interior 6.4) alrededor de todo el mar.
- Sobre una mesa de madera que se pierde en niebla.

**Estilo:** *low-poly* estilizado con colores vivos, no fotorrealista.

| Terreno | Color base | Decorado |
|---|---|---|
| Bosque | `#3f8f45` | árboles de copa ancha (tronco + 3 masas redondeadas, estilo ombú) |
| Llano (antes Pradera) | `#a7d15c` | vacas blancas con manchas negras (recurso: Vaca) |
| Campo | `#e8bf45` | plantas de maíz instanciadas en filas (recurso: Maíz) |
| Barro (antes Colina) | `#c96a3b` | pilas de ladrillos y montículos (recurso: Ladrillo) |
| Cantera (antes Montaña) | `#8d949c` | rocas irregulares grandes y chicas (sin picos ni nieve; recurso: Piedra) |
| Desierto | `#e3c78d` | sin decorado (solo el ladrón, que arranca ahí) |

- El decorado va a la mitad de altura (`DECOR_HEIGHT = 0.5`) y **nunca pisa** la ficha del número, los caminos (aristas) ni los poblados/ciudades (vértices): cada objeto se trata como un círculo que debe caber (`fitsTile` en `board.js`). Si se agranda un objeto o una pieza, revisar esas reservas.
- Fichas de número: crema brillante con borde oscuro, **al ras de la casilla** (sin relieve), **6 y 8 en rojo** y puntos de probabilidad. Todas las cifras usan el mismo tamaño y altura (fuente de cifras "lining"; Georgia usaba cifras old-style y el 10/11/12 se veían chicos).
- Colores de jugador: rojo `#d94141`, azul `#3b6fd6`, naranja `#f0932b`, blanco `#f1eee6`. Las piezas llevan un contorno fino en un tono muy oscuro de su propio color (no negro puro) y ajustan intensidad/brillo según la luz: de día más intensas y profundas, de noche más brillantes, para contrastar siempre con el tablero.
- Piezas: casa (perfil de casa extruido), ciudad (sala + torre), camino (prisma), ladrón (torno + esfera).
- Puertos: barco con vela y cartel `3:1` / `2:1` con franja del color del recurso, unido a la costa por dos muelles.

**Render**
- Pipeline en sRGB con tone mapping ACES Filmic, sombras suaves (PCF soft, 2048), mapa de entorno generado por gradiente, niebla que coincide con el fondo.
- Tres iluminaciones con transición suave: **día**, **atardecer** (sol bajo y cálido) y **noche** (luna azulada y dos luces cálidas).
- Cámara orbital con zoom y ángulo limitados, sin paneo; campo de visión mayor en pantallas verticales. **Arranca a ~30° de la vertical y bastante cerca (distancia ~17)**, con el norte del tablero hacia arriba; se puede llegar hasta la vista cenital y hasta el límite de inclinación.
- Extras: salto leve de las casillas al tirar dados (0.06), barcos que se mecen, agua animada (el fondo de la textura del agua es de un solo color: un degradado dejaba costuras en bloques al repetirse). **Descartados:** efecto "maqueta" (desenfoque arriba y abajo), casilla que se levanta al pasar el cursor y botón "Girar solo": se probaron o se quitaron por no aportar.
- **Dados:** modal arriba, a la izquierda del menú, con dos dados 3D de CSS (sin librerías), **rojos con puntos blancos** en todas las caras, que ruedan y muestran solo el **total** al caer. Tamaño fijo. Las caras tienen esquinas redondeadas y cada dado lleva un núcleo rojo interior (`.core`) que tapa los huecos de los 8 vértices: no quitarlo. Ojo al tocar el CSS del modal: los puntos son `<span>` dentro de `.dice`, así que las reglas de texto deben usar `.dice > span`, no `.dice span`. El resultado hoy sale de `Math.random()` en el cliente (provisorio; ver "Decisiones pendientes").
- Presupuesto orientativo del prototipo: ~35 mil triángulos y ~500 objetos. Si el rendimiento en móvil lo exige, usar instancing y fusionar geometrías estáticas.

**Assets definitivos** (fase de pulido): modelos glTF (comprimidos con Draco/KTX2), texturas propias, HDRI y postprocesado (bloom, oclusión ambiental, corrección de color).

## Decisiones tomadas (y por qué)

- **Mapa hexagonal clásico** (19 casillas). Otros mapas llegarán como variantes configurables.
- **Alcance:** jugar con amigos y portfolio. Sin monetización, cuentas complejas ni matchmaking.
- **Cliente web (Next.js + React Three Fiber) y no Unity.** Motivos: se juega abriendo un link, sin instalar nada; encaja con el stack del desarrollador; una demo online luce más en un portfolio. Como el servidor es autoritativo, el cliente es intercambiable: si algún día se quiere publicar en Steam, se puede hacer un cliente Unity contra el mismo backend.
- **Spring Boot como servidor de reglas** (no Node), con estado en memoria y snapshots en Postgres.
- **Estilo visual aprobado** (originado en un prototipo HTML, ya eliminado y superado por `client/src/lib/board.js`): el estilo, la paleta y la iluminación se mantienen en el cliente definitivo.
- **Maven o Gradle:** se recomendó Maven por ser lo más estándar en Spring Boot; pendiente de confirmar (ver abajo).

- **Nombre: Paisano** (lema «Hacé tu tierra.», voseo rioplatense). Elegido por no parecerse a Colonist ni a Catan. Pendiente: búsqueda rápida de marca y disponibilidad de URL.
- **Replanteo (sept 2026): prueba gratis primero.** Sin hosts de pago ni backend propio hasta validar que el juego sirve. Cliente Next.js desplegado en Vercel Hobby (gratis, uso no comercial). Vercel no mantiene WebSockets, así que el multijugador por turnos usará API routes + base de datos gratuita (Upstash Redis o Neon) + polling cada 1-2 s. El motor de reglas pasa provisionalmente a **TypeScript** (servidor autoritativo dentro de Next); si la prueba funciona, puede portarse a Java/Spring. Alternativa descartada por ahora: P2P con WebRTC.
- **Repo y deploy (sept 2026):** demo pública en https://paisano-three.vercel.app. Monorepo en GitHub con `git` y auth por navegador (sin `gh` CLI, no hace falta). Vercel importa el repo con Root Directory `client`; no se instaló el plugin de Vercel para agentes.
- **Identidad argentina (sept 2026):** recursos y decorado con sabor local: el terreno **Llano** (antes Pradera) produce **Vaca** (no oveja/lana), Campo produce **Maíz** (no trigo), los terrenos pasan a llamarse **Cantera** (antes Montaña, produce **Piedra**, no mineral) y **Barro** (antes Colina, produce **Ladrillo**), bosque con árboles de copa ancha tipo ombú, cantera con rocas irregulares sin nieve. Se probó **Adobe** en lugar de Ladrillo (con hornos de barro) y se descartó. Mantener el resto de nombres y arte propios (ver "Propiedad intelectual").
- **Logo (sept 2026):** wordmark "PAISANO" de imprenta antigua, arte propio aportado por el desarrollador. Se usa como `client/public/logo-paisano.png` (900×297, solo tinta con fondo transparente, 110 KB), dibujado como máscara CSS con el color del tema en el panel del título. El original (2048×768, 3 MB, sobre papel) no se versiona; sigue en la carpeta de descargas del desarrollador.
- **Reparto de números (sept 2026):** se queda con azar + reintento (6 y 8 no vecinos, y ningún número igual al de una casilla vecina). La colocación oficial en espiral (secuencia fija de 18 fichas) se descartó por ahora por dar menos variedad; podría ofrecerse más adelante como opción de sala (`GameConfig`).
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

Estado actual: **replanteo (sept 2026)**. Prioridad: prueba jugable y gratis con amigos, sin backend Java ni cuentas por ahora. Hecho: Node 24 instalado; `/client` (Next.js + TypeScript, npm) con el tablero 3D (three r128 exacto desde npm, JS plano en `client/src/lib/board.js`), ya con README y logo y corriendo en localhost (`cd client; npm run dev`). Repo en GitHub (`PabloSalvaR/paisano`, remoto `origin`) y desplegado en Vercel Hobby (Root Directory = `client`); cada push a `main` despliega solo y el tablero 3D se ve bien en el link público. Pulido visual del tablero **cerrado por ahora** (identidad argentina, luces día/atardecer/noche, dados en modal, logo, menú a la derecha). **Siguiente:** motor de reglas en TypeScript (proponer primero el diseño, incluido el azar de los dados; ver abajo) y después multijugador. Las fases 1-4 originales (Java/Spring) quedan pospuestas.

## Decisiones pendientes

- Maven o Gradle (recomendado: Maven con wrapper).
- **Separar el motor de reglas en un módulo propio** (por ejemplo, un módulo Maven `engine` sin dependencias de Spring, que `server` consuma). Así el compilador impide que el motor dependa de Spring. Proponer estructura en la fase 1.
- Librería de tests (propuesta: JUnit 5 + AssertJ; evaluar tests basados en propiedades para las simulaciones).
- Nombre de paquetes Java (si se retoma el backend): `com.<org>.paisano`.
- Login: solo nombre + token, o también Google/Discord.
- Hosting de la demo: **resuelto por ahora** con Vercel Hobby (VPS, Railway o Fly.io solo si se retoma el backend Java).
- **Azar y dados (propuesta, sin confirmar):** el resultado lo decide el servidor y el cliente solo lo anima (las vueltas del dado son cosméticas); una **semilla por partida** con flujos separados (mapa, dados, cartas); cada tirada calculada a partir de semilla + contador guardado con el estado (Vercel no comparte memoria entre peticiones, así que no puede haber un generador en memoria); semilla inicial con `crypto.getRandomValues`. Distribución como opción de sala (`GameConfig`): dados reales (por defecto) o mazo barajado de las 36 combinaciones. Encaja al empezar el motor de reglas.
- **`client/AGENTS.md`:** ya se borró del repo (commit `8555db3`), pero es un archivo que Next.js recrea al correr `npm run dev`. Si reaparece, no commitearlo o agregarlo al `.gitignore` de `client/`.
- Búsqueda de marca y disponibilidad de URL para el nombre Paisano.
