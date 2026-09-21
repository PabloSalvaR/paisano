"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MARKUP, initBoard } from "@/lib/board";
import { nameStore, saveName } from "@/lib/identity";

const MODES = ["bots", "local"];

// Partida sin red: `bots` (vos contra tres bots, con tu nombre) o `local` (los cuatro en la misma pantalla).
export default function LocalBoard() {
  const { modo } = useParams<{ modo: string }>();
  const valid = MODES.includes(modo);
  const needsName = modo === "bots";
  const rootRef = useRef<HTMLDivElement>(null);
  const stored = useSyncExternalStore(nameStore.subscribe, nameStore.get, nameStore.getServer);
  const [typed, setTyped] = useState<string | null>(null);
  const name = typed ?? stored; // lo que escribió, o el último nombre usado en este navegador
  const [player, setPlayer] = useState<string | null>(null); // el nombre ya elegido: recién ahí arranca el tablero

  useEffect(() => {
    if (!valid || (needsName && player === null)) return;
    const root = rootRef.current!;
    root.innerHTML = MARKUP; // DOM nuevo en cada montaje: evita listeners duplicados
    const dispose = initBoard({ mode: modo, name: player ?? undefined });
    return () => {
      dispose();
      root.innerHTML = "";
    };
  }, [valid, modo, needsName, player]);

  if (!valid) notFound();

  function start() {
    const n = name.trim();
    if (!n) return;
    saveName(n);
    setPlayer(n);
  }

  if (needsName && player === null) {
    return (
      <main className="room-page">
        <div className="room-card">
          <div className="logo" role="img" aria-label="Paisano" />
          <h1>Jugar contra bots</h1>
          <p>Vas a jugar contra tres bots. Ponete un nombre para que te vean en la mesa.</p>
          <label>
            Tu nombre
            <input
              value={name}
              maxLength={20}
              autoComplete="nickname"
              autoFocus
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Como te van a ver en la mesa"
              onKeyDown={(e) => e.key === "Enter" && start()}
            />
          </label>
          <button type="button" className="room-btn primary" disabled={!name.trim()} onClick={start}>
            Jugar
          </button>
          <Link className="room-btn" href="/">
            Volver al menú
          </Link>
        </div>
      </main>
    );
  }
  return <div ref={rootRef} />;
}
