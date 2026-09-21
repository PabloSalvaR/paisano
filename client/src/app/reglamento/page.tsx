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
      "Una casa vale 1 punto, una estancia 2, la Ruta más larga 2 y la Montonera más grande 2. Cada carta de Punto de victoria vale 1.",
    ],
  },
  {
    title: "Al empezar",
    items: [
      "Cada uno tira dos dados y empieza el que saque más (si hay empate arriba, tiran de nuevo solo los empatados). Después son dos fases: en la fase 1 cada uno pone una casa y un camino, en sentido horario; en la fase 2 ponen la segunda casa y su camino en sentido antihorario (el último de la fase 1 juega dos veces seguidas).",
      "Después empieza el juego: el primer turno es de quien abrió la fase 1 y los turnos siguen en sentido horario.",
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
    title: "Ruta y Montonera",
    items: [
      "Ruta más larga: 5 o más caminos seguidos. Una casa rival en el medio la corta.",
      "En cada puesto ves siempre tu ruta y los Gauchos que jugó cada uno; se iluminan en quien tiene el reconocimiento.",
      "Montonera más grande: 3 o más Gauchos jugados.",
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
