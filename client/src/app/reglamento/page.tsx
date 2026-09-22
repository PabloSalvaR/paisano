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
  "Vialidad",
  "Acopio",
  "Casas",
  "Casa",
  "Banco",
  "Ladrón",
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
const SECTIONS: { title: string; items: string[]; open?: boolean }[] = [
  {
    title: "Objetivo",
    open: true,
    items: [
      "Número de jugadores: 3 o 4. Gana el primero que llega a 10 puntos.",
      "Una casa vale 1 punto, una estancia 2, la Ruta más larga 2 y la Milicia más grande 2. Cada carta de Punto de victoria vale 1.",
    ],
  },
  {
    title: "El mapa",
    items: [
      "Los terrenos y los Puertos cambian en cada partida.",
      "Números en serie (lo normal): las 18 fichas de número se ponen en espiral. Se arranca en una esquina del borde, se da la vuelta por afuera en sentido antihorario, se sigue por el anillo del medio y se termina en el centro, salteando el desierto.",
      "El orden de la espiral es el de las letras de las fichas del juego de mesa original: A5, B2, C6, D3, E8, F10, G9, H12, I11, J4, K8, L10, M9, N4, O5, P6, Q3 y R11. En el tablero no se ven las letras: solo fijan el orden.",
      "Así nunca quedan juntos un 6 y un 8, ni dos casillas vecinas con el mismo número.",
      "Modo Caos: si activás «Caos: números al azar» al armar la partida contra bots, las fichas se reparten al azar, cuidando igual que no queden juntos un 6 y un 8 ni dos números iguales.",
    ],
  },
  {
    title: "Al empezar",
    items: [
      "Cada uno tira dos dados y empieza el que saque más (si hay empate arriba, tiran de nuevo solo los empatados). Después son dos fases: en la Fase 1 cada uno pone una casa y un camino, en sentido horario; en la Fase 2 ponen la segunda casa y su camino en sentido antihorario (el último de la Fase 1 juega dos veces seguidas).",
      "Después empieza el juego: el primer turno es de quien abrió la Fase 1 y los turnos siguen en sentido horario.",
      "La 2.ª casa te da 1 recurso por cada casilla que toca.",
      "Dos casas (o estancias) nunca pueden quedar pegadas: hace falta al menos un vértice libre entre ellas.",
    ],
  },
  {
    title: "Tu turno",
    items: [
      "1. Tirá los dados. Las casillas con ese número dan recursos: 1 carta por casa y 2 por estancia al lado.",
      "2. Construí, comerciá y jugá una carta, en el orden que quieras.",
      "3. Pasá el turno.",
    ],
  },
  {
    title: "Construir",
    items: [
      "Camino: 1 madera + 1 ladrillo.",
      "Casa: 1 madera + 1 ladrillo + 1 vaca + 1 maíz. Tiene que estar al final de un camino tuyo.",
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
      "Además le roba una carta al azar a un rival con casa o estancia ahí.",
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
      "Solo comercia quien tiene el turno: los demás nada más responden.",
    ],
  },
  {
    title: "Cartas de desarrollo",
    items: [
      "Una por turno, y no la que compraste en ese mismo turno. Las podés jugar antes o después de tirar los dados.",
      "Gaucho: mové el ladrón y robá una carta.",
      "Acopio: elegís un recurso y todos te entregan el que tengan.",
      "Buena cosecha: tomás 2 recursos del banco.",
      "Vialidad: ponés 2 caminos gratis.",
      "Punto de victoria: 1 punto oculto; no se juega y se suma sola.",
    ],
  },
  {
    title: "Ruta y Milicia",
    items: [
      "Ruta más larga: 5 o más caminos seguidos. Una casa rival en el medio la corta.",
      "En cada puesto ves siempre tu ruta y los Gauchos que jugó cada uno; se iluminan en quien tiene el reconocimiento.",
      "Milicia más grande: 3 o más Gauchos jugados.",
      "Valen 2 puntos cada una y solo se pierden si alguien te supera.",
    ],
  },
  {
    title: "Ganar",
    items: ["Ganás en el momento en que llegás a 10 puntos en tu turno, contando tus Puntos de victoria ocultos. Si ya los tenés cuando te llega el turno (por ejemplo, la Ruta más larga pasó a ser tuya), ganás sin tirar los dados."],
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
                {s.items.map((t) => (
                  <li key={t}>{highlight(t)}</li>
                ))}
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
