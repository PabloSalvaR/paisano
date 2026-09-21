import Link from "next/link";

// Menú de inicio: de acá sale toda la navegación (partida contra bots, mesa local de 4 y sala online).
export default function Menu() {
  return (
    <main className="room-page">
      <div className="room-card">
        <div className="logo" role="img" aria-label="Paisano" />
        <h1>Piedra y camino</h1>
        <p>Elegí cómo querés jugar.</p>
        <Link className="room-btn primary" href="/jugar/bots" title="Jugás vos contra tres bots que juegan solos">
          Partida contra bots
        </Link>
        <Link className="room-btn primary" href="/sala" title="Armá una sala y jugá con amigos pasándoles un link">
          Jugar online
        </Link>
        <Link className="room-btn" href="/jugar/local" title="Los cuatro jugadores en la misma pantalla">
          Mesa local
        </Link>
      </div>
    </main>
  );
}
