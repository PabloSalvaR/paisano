import Link from "next/link";
import { version } from "../../package.json";

// Menú de inicio: de acá sale toda la navegación (partida contra bots, sala online y el reglamento, que solo se ve desde acá).
// La mesa local de 4 (/jugar/local) no tiene botón a propósito (sept 2026): sigue andando por URL directa; ver "Decisiones tomadas" en CLAUDE.md.
export default function Menu() {
  return (
    <main className="room-page">
      <div className="room-card">
        <div className="logo" role="img" aria-label="Paisano" />
        <h1>Piedra y camino</h1>
        <span className="room-version">v{version}</span>
        <Link className="room-btn primary" href="/jugar/bots" title="Jugás vos contra tres bots que juegan solos">
          Partida contra bots
        </Link>
        {/* Deshabilitado a propósito (sept 2026): por ahora solo se puede probar contra bots; ver "Decisiones tomadas" en CLAUDE.md. */}
        <button type="button" className="room-btn" disabled>
          Jugar online
        </button>
        <Link className="room-btn" href="/reglamento" title="Cómo se juega, en pocas líneas">
          Reglamento
        </Link>
      </div>
    </main>
  );
}
