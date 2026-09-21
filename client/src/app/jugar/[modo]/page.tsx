"use client";

import { notFound, useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { MARKUP, initBoard } from "@/lib/board";

const MODES = ["bots", "local"];

// Partida sin red: `bots` (vos contra tres bots) o `local` (los cuatro en la misma pantalla).
export default function LocalBoard() {
  const { modo } = useParams<{ modo: string }>();
  const valid = MODES.includes(modo);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!valid) return;
    const root = rootRef.current!;
    root.innerHTML = MARKUP; // DOM nuevo en cada montaje: evita listeners duplicados
    const dispose = initBoard({ mode: modo });
    return () => {
      dispose();
      root.innerHTML = "";
    };
  }, [valid, modo]);

  if (!valid) notFound();
  return <div ref={rootRef} />;
}
