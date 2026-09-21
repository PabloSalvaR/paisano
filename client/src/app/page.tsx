import Link from "next/link";
import { version } from "../../package.json";

// Menú de inicio: de acá sale toda la navegación (partida contra bots, mesa local de 4, sala online y el reglamento, que solo se ve desde acá).
export default function Menu() {
  return (
    <main className="room-page">
      <div className="room-card">
        <div className="logo" role="img" aria-label="Paisano" />
        <h1>Piedra y camino</h1>
        <span className="room-version">v{version}</span>
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
        <Link className="room-btn" href="/reglamento" title="Cómo se juega, en pocas líneas">
          Reglamento
        </Link>
      </div>
    </main>
  );
}
