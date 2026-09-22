"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MARKUP, SEAT_COLORS, characterSVG, initBoard } from "@/lib/board";
import { CHARACTERS } from "@/lib/characters";
import { characterStore, colorStore, nameStore, playerCountStore, saveCharacter, saveColor, saveName, savePlayerCount } from "@/lib/identity";

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
  const storedColor = useSyncExternalStore(colorStore.subscribe, colorStore.get, colorStore.getServer);
  const [typedColor, setTypedColor] = useState<string | null>(null);
  const colorId = typedColor ?? storedColor; // el elegido, o el último usado en este navegador
  const previewCss = SEAT_COLORS.find((c) => c.id === colorId)?.css ?? SEAT_COLORS[0].css;
  const storedPlayers = useSyncExternalStore(playerCountStore.subscribe, playerCountStore.get, playerCountStore.getServer);
  const [typedPlayers, setTypedPlayers] = useState<number | null>(null);
  const players = typedPlayers ?? storedPlayers; // 3 o 4: vos y dos o tres bots
  const [chaos, setChaos] = useState(false); // «Caos»: números del mapa al azar. Siempre arranca apagado (en serie, como el juego original)
  const [player, setPlayer] = useState<{ name: string; characterId: string; colorId: string; players: number; chaos: boolean } | null>(null); // ya elegidos: recién ahí arranca el tablero
  const [loading, setLoading] = useState(true); // armar la escena 3D bloquea la página un par de segundos: mientras, se ve el loader

  useEffect(() => {
    if (!valid || (needsName && player === null)) return;
    const root = rootRef.current!;
    let dispose: (() => void) | null = null;
    let raf = 0;
    // initBoard es sincrónico y pesado: se espera a que el loader se pinte (dos cuadros) antes de llamarlo, y se lo
    // saca recién después del primer cuadro del tablero (ahí se compilan los shaders, que también tardan).
    const afterPaint = (fn: () => void) => { raf = requestAnimationFrame(() => { raf = requestAnimationFrame(fn); }); };
    afterPaint(() => {
      root.innerHTML = MARKUP; // DOM nuevo en cada montaje: evita listeners duplicados
      dispose = initBoard({ mode: modo, name: player?.name, characterId: player?.characterId, colorId: player?.colorId, players: player?.players, chaos: player?.chaos });
      afterPaint(() => setLoading(false));
    });
    return () => {
      cancelAnimationFrame(raf);
      if (dispose) dispose();
      root.innerHTML = "";
      setLoading(true);
    };
  }, [valid, modo, needsName, player]);

  if (!valid) notFound();

  function start() {
    const n = name.trim();
    if (!n) return;
    saveName(n);
    saveCharacter(characterId);
    saveColor(colorId);
    savePlayerCount(players);
    setPlayer({ name: n, characterId, colorId, players, chaos });
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
            <p className="char-heading">Jugadores</p>
            <div className="count-picker" role="radiogroup" aria-label="Cantidad de jugadores">
              {[3, 4].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={n === players} className="count-opt" onClick={() => setTypedPlayers(n)}>
                  {n}
                  <small>{n === 3 ? "vos y 2 bots" : "vos y 3 bots"}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="char-block">
            <p className="char-heading">Elegí tu color</p>
            <div className="color-picker" role="radiogroup" aria-label="Tu color">
              {SEAT_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={c.id === colorId}
                  aria-label={c.id}
                  title={c.id}
                  className="color-opt"
                  style={{ background: c.css }}
                  onClick={() => setTypedColor(c.id)}
                />
              ))}
            </div>
          </div>
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
                  dangerouslySetInnerHTML={{ __html: characterSVG({ ...c, css: previewCss }) }}
                />
              ))}
            </div>
          </div>
          <label className="chaos-toggle" title="Apagado, los números van en serie como en el juego original. Prendido, se reparten al azar.">
            <input type="checkbox" role="switch" checked={chaos} onChange={(e) => setChaos(e.target.checked)} />
            Caos: números al azar
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
  return (
    <>
      <div ref={rootRef} />
      {loading && (
        <div className="board-loader" role="status" aria-live="polite">
          <div className="logo" role="img" aria-label="Paisano" />
          <span className="spin" aria-hidden="true" />
          <p>Armando la mesa…</p>
        </div>
      )}
    </>
  );
}
