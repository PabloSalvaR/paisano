# Referencia visual del cliente 3D

Movida desde `CLAUDE.md` (sept 2026). Es la especificación de partida del tablero: **el código manda si difiere** (`client/src/lib/board.js`). Leerla al tocar el aspecto del tablero, las luces, las piezas o el banner.

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

- El decorado va a la mitad de altura (`DECOR_HEIGHT = 0.38`, achatado para no confundirse con las piezas de jugador) y **nunca pisa** la ficha del número, los caminos (aristas) ni los poblados/ciudades (vértices): cada objeto se trata como un círculo que debe caber (`fitsTile` en `board.js`). Si se agranda un objeto o una pieza, revisar esas reservas.
- Fichas de número: crema brillante con borde oscuro, **al ras de la casilla** (sin relieve), **6 y 8 en rojo** y puntos de probabilidad. Todas las cifras usan el mismo tamaño y altura (fuente de cifras "lining"; Georgia usaba cifras old-style y el 10/11/12 se veían chicos).
- Colores de jugador: rojo `#d94141`, azul `#3b6fd6`, naranja `#f0932b`, blanco `#f1eee6`. Las piezas llevan un contorno fino en un tono muy oscuro de su propio color (no negro puro) y ajustan intensidad/brillo según la luz: de día más intensas y profundas, de noche más brillantes, para contrastar siempre con el tablero.
- Piezas: casa (perfil de casa extruido), ciudad (sala + torre), camino (prisma), ladrón (torno + esfera).
- Puertos: barco chico (escala 0.7) con vela, unido a la costa por dos muelles. El cartel es **redondo, fijo sobre un poste del muelle** (no en el barco, para que no se mueva con las olas): `3:1` solo con el número, o `2:1` con el **dibujo** del recurso (sin texto, legible de lejos; iconos propios en `PORT_ICONS`, la vaca es una cara).

**Render**
- Pipeline en sRGB con tone mapping ACES Filmic, sombras suaves (PCF soft, 2048), mapa de entorno generado por gradiente, niebla que coincide con el fondo.
- Tres iluminaciones con transición suave: **día**, **atardecer** (sol bajo y cálido) y **noche** (luna azulada y dos luces cálidas).
- Cámara orbital con zoom y ángulo limitados, sin paneo; campo de visión mayor en pantallas verticales. **Arranca a ~30° de la vertical y bastante cerca (distancia ~17)**, con el norte del tablero hacia arriba; se puede llegar hasta la vista cenital y hasta el límite de inclinación.
- Extras: al salir un número **salta solo la ficha** (`DICE_BOUNCE = 0.12`, la casilla no se mueve) y brilla el **borde interior del hexágono** con un degradado hacia el centro (`glowTexture()`, opacidad máx. 0.5), barcos que se mecen, agua animada (el fondo de la textura del agua es de un solo color: un degradado dejaba costuras en bloques al repetirse). **Descartados:** efecto "maqueta" (desenfoque arriba y abajo), casilla que se levanta al pasar el cursor y botón "Girar solo": se probaron o se quitaron por no aportar.
- **Banner de recursos y jugadores (partida local en el cliente):** banner abajo al centro con el color del jugador de turno (`VIEWER` = `game.turn`; con multijugador será siempre el jugador de este navegador): avatar, nombre, puntos de victoria (1 por poblado, 2 por ciudad) y 5 tarjetas (icono SVG + cantidad). A la izquierda, bajo el título, los puestos de los 4 jugadores (Tomás rojo, Lucía azul, Mateo naranja, Sofía blanco; nombres provisorios) con avatar, nombre, PV y cantidad de cartas; se resalta el del turno. Manos y puntos son un reflejo del estado del motor (`syncHands`); al cobrar, un icono con insignia del color del dueño vuela de la casilla a la tarjeta (si es el jugador mirado) o a su puesto, con un `+n` de ~2 s. La cámara se desplaza (`setViewOffset`) para centrar el tablero sobre el banner.
- **Estado de la partida en el cliente (`board.js` + motor):** `board.js` ya no decide nada: `buildBoard(seed)` hace `createGame` y dibuja `game.map` (terrenos, números, puertos, ladrón). El tablero **arranca vacío**; `syncPieces()` dibuja las piezas del estado (las nuevas brotan con un rebote). Las jugadas legales salen de `legalActions` y se muestran como marcadores (disco en el vértice, barra en la arista; área de toque invisible más grande); un clic sin arrastre llama a `dispatch(comando)`, que pasa por `applyCommand`. El panel de estado (`#status`) dice qué toca hacer y muestra los errores. Mientras corre una animación (`busy`) no se aceptan jugadas. Un **botón único de turno** (`#btnTurn`, redondo, abajo a la derecha): en fase `roll` muestra dos dados y tira; en `main` muestra una flecha sobre el color de quien sigue (sin avatar: el color alcanza) y termina el turno; en otras fases se oculta. El botón «Piezas» se eliminó.
- **Dados:** modal arriba, a la izquierda del menú, con dos dados 3D de CSS (sin librerías), **rojos con puntos blancos** en todas las caras, que ruedan y muestran solo el **total** al caer. Tamaño fijo. Las caras tienen esquinas redondeadas y cada dado lleva un núcleo rojo interior (`.core`) que tapa los huecos de los 8 vértices: no quitarlo. Ojo al tocar el CSS del modal: los puntos son `<span>` dentro de `.dice`, así que las reglas de texto deben usar `.dice > span`, no `.dice span`. El resultado lo decide el motor (`DiceRolled`); el cliente solo lo anima y revela el total y la producción al terminar de caer.
- Presupuesto orientativo del prototipo: ~35 mil triángulos y ~500 objetos. Si el rendimiento en móvil lo exige, usar instancing y fusionar geometrías estáticas.

**Assets definitivos** (fase de pulido): modelos glTF (comprimidos con Draco/KTX2), texturas propias, HDRI y postprocesado (bloom, oclusión ambiental, corrección de color).
