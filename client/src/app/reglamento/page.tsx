import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

export const metadata: Metadata = { title: "Reglamento · Paisano" };

// Palabras del juego que se resaltan donde aparezcan (piezas, cartas y reconocimientos), sin tener que marcarlas a mano
// en cada frase. Orden de más larga a más corta: si no, "Punto de victoria" nunca se probaría entera porque "Punto" ya
// la habría cortado antes. Insensible a mayúsculas; el resaltado respeta cómo esté escrita en el texto original.
const TERMS = [
  "Puntos de victoria",
  "Punto de victoria",
  "Ruta más larga",
  "Milicia más grande",
  "Cartas de desarrollo",
  "Carta de desarrollo",
  "Buena cosecha",
  "Fase 1",
  "Fase 2",
  "Estancias",
  "Estancia",
  "Caminos",
  "Camino",
  "Puertos",
  "Puerto",
  "Gauchos",
  "Gaucho",
  "Empedrado",
  "Acopio",
  "Casas",
  "Casa",
  "Banco",
  "Ladrón",
  "10 puntos"
].sort((a, b) => b.length - a.length);
const TERMS_RE = new RegExp(`(${TERMS.join("|")})`, "gi");

/** Resalta las palabras de `TERMS` dentro de `text`, conservando el resto tal cual. */
function highlight(text: string) {
  return text.split(TERMS_RE).map((part, i) =>
    i % 2 === 1 ? (
      <b className="term" key={i}>
        {part}
      </b>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

// Reglamento corto para leer en el celular: secciones plegables y frases cortas. Solo se llega desde el menú de inicio.
// Los números salen de engine/config.ts (costos, piezas, puntos): si se cambian allá, hay que actualizarlos acá.
// Un ítem es una frase, o una frase con una sublista debajo (un renglón por cosa, para leerla de un vistazo).
type Item = string | { text: string; list: string[] };
const SECTIONS: { title: string; items: Item[]; open?: boolean }[] = [
  {
    title: "El juego",
    open: true,
    items: [
      "Número de jugadores: 3 o 4.",
      "Gana el primero que llega a 10 puntos en su turno.",
      { text: "Puntos:", list: ["Casa: 1", "Estancia: 2", "Ruta más larga: 2", "Milicia más grande: 2", "Punto de victoria: 1"] },
    ],
  },
  {
    title: "El mapa",
    items: [
      "Hay 19 casillas: 4 bosques, 4 llanos, 4 campos, 3 de barro, 3 canteras y 1 desierto.",
      "En cada partida las casillas se mezclan al azar. Los 9 puertos siempre están en los mismos lugares de la costa y en el mismo orden.",
      "Cada terreno da un recurso: el bosque da madera, el barro ladrillo, el llano vaca, el campo maíz y la cantera piedra.",
      "El desierto no lleva número ni produce nada, y el ladrón empieza ahí.",
    ],
  },
  {
    title: "Al empezar",
    items: [
      "Cada uno tira dos dados y empieza el que saque más (si empatan arriba, desempatan tirando de nuevo).",
      "Fase 1: por turno, cada uno pone una casa y un camino.",
      "Fase 2: en orden inverso, cada uno pone su segunda casa y su camino (el último pone dos seguidas).",
      "Después empieza el juego: el primer turno es de quien empezó la Fase 1 y los turnos siguen en el mismo sentido.",
      "La 2.ª casa te da 1 recurso por cada casilla de recurso que toque.",
    ],
  },
  {
    title: "Tu turno",
    items: [
      "1. Tirá los dados. Las casillas con ese número dan recursos: cada casa en una esquina de esa casilla cobra 1 carta, y cada estancia 2.",
      "2. Construí, comerciá y jugá una carta de desarrollo, en el orden que quieras.",
      "3. Pasá el turno.",
    ],
  },
  {
    title: "Construir",
    items: [
      "Camino: 1 madera + 1 ladrillo.",
      "Casa: 1 madera + 1 ladrillo + 1 vaca + 1 maíz. Tiene que tocar un camino tuyo.",
      "Dos casas (o estancias) nunca pueden quedar pegadas: hace falta al menos una esquina libre entre ellas.",
      "Estancia: 2 maíz + 3 piedras. Mejora una casa tuya y produce el doble.",
      "Carta de desarrollo: 1 vaca + 1 maíz + 1 piedra.",
      "Tenés 15 caminos, 5 casas y 4 estancias.",
    ],
  },
  {
    title: "El 7 y el ladrón",
    items: [
      "Con un 7 nadie cobra. Quien tenga más de 7 cartas descarta la mitad.",
      "Quien tiró mueve el ladrón a otra casilla: esa casilla no produce mientras esté ahí.",
      "Además le roba una carta al azar a un rival con casa o estancia ahí. Si hay varios con cartas, elegís a quién.",
    ],
  },
  {
    title: "Comerciar con el banco",
    items: [
      "Entregás 4 cartas iguales y recibís 1 de la que quieras.",
      "Con una casa o estancia en un puerto es mejor: 3 por 1 (puerto 3:1) o 2 por 1 (puerto del recurso).",
    ],
  },
  {
    title: "Comerciar con jugadores",
    items: [
      "En tu turno, después de tirar, podés ofrecer un cambio: qué das y qué pedís, a todos o a algunos.",
      "Cada uno responde sí o no. Vos elegís con cuál de los que aceptaron cerrar el trato, o cancelás.",
      "Hasta 5 ofertas por turno. Mientras una está abierta no podés construir ni pasar el turno.",
    ],
  },
  {
    title: "Cartas de desarrollo",
    items: [
      "El mazo tiene 25 cartas: 14 Gauchos, 5 Puntos de victoria, 2 Acopio, 2 Buena cosecha y 2 Empedrado. Cuando se acaba, no se pueden comprar más.",
      "Una por turno, y no la que compraste en ese mismo turno. Las podés jugar antes o después de tirar los dados.",
      "Gaucho: mové el ladrón y robá una carta. Cada Gaucho jugado suma para la Milicia más grande.",
      "Acopio: todos te dan todas las cartas del recurso que elijas.",
      "Buena cosecha: obtenés 2 recursos del banco.",
      "Empedrado: ponés 2 caminos gratis.",
      "Punto de victoria: 1 punto oculto; no se juega y se suma solo.",
    ],
  },
  {
    title: "Ruta y Milicia",
    items: [
      "Ruta más larga: 5 o más caminos seguidos. Una casa rival en el medio la corta.",
      "Milicia más grande: 3 o más Gauchos jugados.",
      "Valen 2 puntos cada una y solo se pierden si alguien te supera.",
    ],
  },
  {
    title: "Casos especiales",
    items: [
      "Descarte con un 7: la mitad se redondea para abajo (con 9 cartas descartás 4).",
      "Banco sin cartas: si no alcanza un recurso para todos los que cobran, si lo cobra uno solo se lleva las que queden; si lo cobran varios, no cobra nadie.",
      "Ruta cortada: si te cortan la ruta y quedan empatados otros jugadores con la más larga, nadie tiene la Ruta más larga hasta que uno supere al resto.",
      "Llegar a 10 en turno ajeno: si llegás a 10 puntos en el turno de otro (por ejemplo, porque te quedaste con la Ruta más larga), ganás cuando empieza tu turno.",
    ],
  },
  {
    title: "Los números del mapa",
    items: [
      "Las 18 fichas se ponen en espiral. Se arranca en una esquina del borde, se da la vuelta por afuera en sentido antihorario, se sigue por el anillo del medio y se termina en el centro, salteando el desierto.",
      "El orden de la espiral va por letras: A5, B2, C6, D3, E8, F10, G9, H12, I11, J4, K8, L10, M9, N4, O5, P6, Q3 y R11. En el tablero no se ven las letras: solo fijan el orden.",
      "Esta configuración garantiza que nunca queden juntos un 6 y un 8, ni dos casillas vecinas con el mismo número.",
      "Modo Caos: si se activa, los números se reparten al azar, cuidando igualmente la anterior condición de balanceo. Los puertos también se mezclan, pero nunca quedan tres 3:1 seguidos.",
    ],
  },
];

export default function Reglamento() {
  return (
    <main className="room-page">
      <div className="room-card rules">
        <div className="logo" role="img" aria-label="Paisano" />
        <h1>Reglamento</h1>
        <div className="rules-list">
          {SECTIONS.map((s) => (
            <details key={s.title} open={s.open}>
              <summary>{s.title}</summary>
              <ul>
                {s.items.map((t) =>
                  typeof t === "string" ? (
                    <li key={t}>{highlight(t)}</li>
                  ) : (
                    <li key={t.text}>
                      {highlight(t.text)}
                      <ul className="sub">
                        {t.list.map((x) => (
                          <li key={x}>{highlight(x)}</li>
                        ))}
                      </ul>
                    </li>
                  ),
                )}
              </ul>
            </details>
          ))}
        </div>
        <Link className="room-btn" href="/">
          Volver al menú
        </Link>
      </div>
    </main>
  );
}
