import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Reglamento · Paisano" };

// Reglamento corto para leer en el celular: secciones plegables y frases cortas. Solo se llega desde el menú de inicio.
// Los números salen de engine/config.ts (costos, piezas, puntos): si se cambian allá, hay que actualizarlos acá.
const SECTIONS: { title: string; items: string[]; open?: boolean }[] = [
  {
    title: "Objetivo",
    open: true,
    items: [
      "Jugás de 3 a 4. Gana el primero que llega a 10 puntos.",
      "Un poblado vale 1 punto, una ciudad 2, la Ruta más larga 2 y la Montonera más grande 2. Cada Estancia vale 1.",
    ],
  },
  {
    title: "Al empezar",
    items: [
      "Cada uno pone 2 poblados con un camino cada uno, primero en orden y después al revés.",
      "El 2.º poblado te da 1 recurso por cada casilla que toca.",
      "Dos poblados nunca pueden quedar pegados: hace falta al menos un vértice libre entre ellos.",
    ],
  },
  {
    title: "Tu turno",
    items: [
      "1. Tirá los dados. Las casillas con ese número dan recursos: 1 carta por poblado y 2 por ciudad al lado.",
      "2. Construí, comerciá y jugá una carta, en el orden que quieras.",
      "3. Pasá el turno.",
    ],
  },
  {
    title: "Construir",
    items: [
      "Camino: 1 madera + 1 ladrillo.",
      "Poblado: 1 madera + 1 ladrillo + 1 vaca + 1 maíz. Tiene que estar al final de un camino tuyo.",
      "Ciudad: 2 maíz + 3 piedras. Mejora un poblado tuyo y produce el doble.",
      "Carta de desarrollo: 1 vaca + 1 maíz + 1 piedra.",
      "Tenés 15 caminos, 5 poblados y 4 ciudades.",
    ],
  },
  {
    title: "El 7 y el ladrón",
    items: [
      "Con un 7 nadie cobra. Quien tenga más de 7 cartas descarta la mitad.",
      "Quien tiró mueve el ladrón a otra casilla: esa casilla no produce mientras esté ahí.",
      "Además le roba una carta al azar a un rival con poblado o ciudad ahí.",
    ],
  },
  {
    title: "Comerciar con el banco",
    items: [
      "Entregás 4 cartas iguales y recibís 1 de la que quieras.",
      "Con un poblado o ciudad en un puerto es mejor: 3 por 1 (puerto 3:1) o 2 por 1 (puerto del recurso).",
    ],
  },
  {
    title: "Cartas de desarrollo",
    items: [
      "Una por turno, y no la que compraste en ese mismo turno.",
      "Gaucho: mové el ladrón y robá una carta. Lo podés jugar antes de tirar los dados.",
      "Acopio: elegís un recurso y todos te entregan el que tengan.",
      "Buena cosecha: tomás 2 recursos del banco.",
      "Vialidad: ponés 2 caminos gratis.",
      "Estancia: 1 punto oculto; no se juega y se suma sola.",
    ],
  },
  {
    title: "Ruta y Montonera",
    items: [
      "Ruta más larga: 5 o más caminos seguidos. Un poblado rival en el medio la corta.",
      "Montonera más grande: 3 o más Gauchos jugados.",
      "Valen 2 puntos cada una y solo se pierden si alguien te supera.",
    ],
  },
  {
    title: "Ganar",
    items: ["Ganás en el momento en que llegás a 10 puntos en tu turno, contando tus Estancias ocultas."],
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
                  <li key={t}>{t}</li>
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
