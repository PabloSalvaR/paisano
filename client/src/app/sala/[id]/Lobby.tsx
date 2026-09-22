"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MAX_SEATS, MIN_SEATS } from "@/server/room";
import type { RoomView } from "@/server/view";

// Colores de los puestos: los mismos que las piezas del tablero, en orden de mesa.
export const SEAT_COLORS = ["#c81e1e", "#3b6fd6", "#f0932b", "#f1eee6"];

export default function Lobby({
  view,
  roomId,
  onAddBot,
  onStart,
  error,
  busy,
}: {
  view: RoomView;
  roomId: string;
  onAddBot: () => void;
  onStart: () => void;
  error: string;
  busy: boolean;
}) {
  const isHost = view.me === 0;
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiá el link de la sala:", window.location.href); // sin permiso del portapapeles
    }
  }

  const empty = Array.from({ length: Math.max(0, MAX_SEATS - view.seats.length) });
  const missing = MIN_SEATS - view.seats.length;

  return (
    <main className="room-page">
      <div className="room-card">
        <div className="logo" role="img" aria-label="Paisano" />
        <h1>
          Sala <span className="code">{roomId}</span>
        </h1>
        <p>Pasales el link a tus amigos. Cuando estén todos, {isHost ? "empezá la partida" : `${view.seats[0].name} empieza la partida`}.</p>
        <button type="button" className="room-btn" onClick={copy}>
          {copied ? "¡Link copiado!" : "Copiar link de la sala"}
        </button>
        <ul className="room-seats" aria-label="Jugadores">
          {view.seats.map((s, i) => (
            <li key={i}>
              <span className="dot" style={{ background: SEAT_COLORS[i] }} />
              {s.name}
              <span className="tag">{i === view.me ? "vos" : s.bot ? "bot" : i === 0 ? "anfitrión" : ""}</span>
            </li>
          ))}
          {empty.map((_, i) => (
            <li key={`e${i}`} className="empty">
              <span className="dot" style={{ background: "transparent" }} />
              Esperando jugador…
            </li>
          ))}
        </ul>
        {isHost ? (
          <>
            <div className="row">
              <button type="button" className="room-btn" disabled={busy || view.seats.length >= MAX_SEATS} onClick={onAddBot}>
                Sumar bot
              </button>
              <button type="button" className="room-btn primary" disabled={busy || missing > 0} onClick={onStart}>
                Empezar partida
              </button>
            </div>
            {missing > 0 && <p>Hacen falta {MIN_SEATS} jugadores como mínimo (los bots cuentan).</p>}
          </>
        ) : (
          <p>Esperando a que {view.seats[0].name} empiece la partida…</p>
        )}
        <div className="room-error" role="alert">
          {error}
        </div>
        <Link className="room-btn" href="/">
          Volver al menú
        </Link>
      </div>
    </main>
  );
}
