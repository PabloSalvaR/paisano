"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MARKUP, SEAT_COLORS, characterSVG, initBoard } from "@/lib/board";
import { CHARACTERS } from "@/lib/characters";
import { characterStore, nameStore, saveCharacter, saveName } from "@/lib/identity";

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
  const storedCharacter = useSyncExternalStore(characterStore.subscribe, characterStore.get, characterStore.getServer);
  const [typedCharacter, setTypedCharacter] = useState<string | null>(null);
  const characterId = typedCharacter ?? storedCharacter; // el elegido, o el último usado en este navegador
  const [player, setPlayer] = useState<{ name: string; characterId: string } | null>(null); // ya elegidos: recién ahí arranca el tablero

  useEffect(() => {
    if (!valid || (needsName && player === null)) return;
    const root = rootRef.current!;
    root.innerHTML = MARKUP; // DOM nuevo en cada montaje: evita listeners duplicados
    const dispose = initBoard({ mode: modo, name: player?.name, characterId: player?.characterId });
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
    saveCharacter(characterId);
    setPlayer({ name: n, characterId });
  }

  if (needsName && player === null) {
    return (
      <main className="room-page">
        <div className="room-card">
          <div className="logo" role="img" aria-label="Paisano" />
          <h1>Jugar contra bots</h1>
          <label>
            Ingresá tu nombre
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
          <div className="char-block">
            <p className="char-heading">Elegí tu personaje</p>
            <div className="char-picker" role="radiogroup" aria-label="Tu personaje">
              {CHARACTERS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={c.id === characterId}
                  aria-label={c.label}
                  title={c.label}
                  className="char-opt"
                  onClick={() => setTypedCharacter(c.id)}
                  dangerouslySetInnerHTML={{ __html: characterSVG({ ...c, css: SEAT_COLORS[0].css }) }}
                />
              ))}
            </div>
          </div>
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
