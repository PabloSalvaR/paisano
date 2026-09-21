"use client";

import { useEffect, useRef } from "react";
import { MARKUP, initBoard } from "@/lib/board";
import type { GameSession } from "@/lib/session";

// El tablero 3D conectado a una sesión remota. Se monta una sola vez por partida: si cambiaran `session` o `seed` se
// reconstruiría la escena entera, por eso los asientos se toman de la primera vista (no cambian una vez empezada).
export default function OnlineBoard({ session, seats, seed }: { session: GameSession; seats: { name: string; bot: boolean }[]; seed: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const seatsRef = useRef(seats);

  useEffect(() => {
    const root = rootRef.current!;
    root.innerHTML = MARKUP; // DOM nuevo en cada montaje: evita listeners duplicados
    const dispose = initBoard({ session, seats: seatsRef.current, seed });
    return () => {
      dispose();
      root.innerHTML = "";
    };
  }, [session, seed]);

  return <div ref={rootRef} />;
}
