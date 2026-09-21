"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { forgetIdentity, loadIdentity, nameStore, saveIdentity } from "@/lib/identity";
import { RemoteSession } from "@/lib/remote";
import { roomsApi } from "@/lib/roomsApi";
import type { RoomView } from "@/server/view";
import Lobby from "./Lobby";
import OnlineBoard from "./OnlineBoard";

type Screen = { kind: "checking" } | { kind: "join" } | { kind: "error"; message: string } | { kind: "in" };

// Semilla para el decorado del tablero (árboles, vacas, rocas): sale del código de la sala, así todos ven el mismo mapa.
function seedOf(roomId: string): number {
  let h = 2166136261;
  for (let i = 0; i < roomId.length; i++) h = Math.imul(h ^ roomId.charCodeAt(i), 16777619);
  return ((h >>> 0) & 0x7fffffff) | 1;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="room-page">
      <div className="room-card">
        <div className="logo" role="img" aria-label="Paisano" />
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = decodeURIComponent(params.id).trim().toUpperCase();
  const api = useMemo(() => roomsApi(), []);
  const sessionRef = useRef<RemoteSession | null>(null); // para detener el polling al salir
  const [session, setSession] = useState<RemoteSession | null>(null); // para dibujar
  const tokenRef = useRef("");
  const [screen, setScreen] = useState<Screen>({ kind: "checking" });
  const [view, setView] = useState<RoomView | null>(null);
  const stored = useSyncExternalStore(nameStore.subscribe, nameStore.get, nameStore.getServer);
  const [typed, setName] = useState<string | null>(null);
  const name = typed ?? stored; // lo que escribió, o el último nombre usado en este navegador
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const connect = useCallback(
    async (token: string) => {
      const session = new RemoteSession(roomId, token, api);
      const r = await session.load();
      if (!r.ok) {
        if (r.status === 401) {
          forgetIdentity(roomId); // el token ya no sirve en esta sala: hay que presentarse de nuevo
          setScreen({ kind: "join" });
        } else if (r.status === 404) {
          setScreen({ kind: "error", message: "Esa sala no existe. Puede que el código esté mal o que el servidor se haya reiniciado." });
        } else {
          setScreen({ kind: "error", message: r.error.message });
        }
        return;
      }
      sessionRef.current?.stop();
      sessionRef.current = session;
      tokenRef.current = token;
      setSession(session);
      session.subscribe((v) => setView(v));
      session.onError((status) => {
        if (status === 404) setScreen({ kind: "error", message: "La sala dejó de existir (el servidor se reinició)." });
      });
      setView(r.view);
      setScreen({ kind: "in" });
      session.start();
    },
    [roomId, api],
  );

  useEffect(() => {
    void (async () => {
      const identity = loadIdentity(roomId);
      if (identity) await connect(identity.token);
      else setScreen({ kind: "join" });
    })();
    return () => sessionRef.current?.stop();
  }, [roomId, connect]);

  // Con la pestaña oculta se consulta muy despacio (cada consulta gasta un comando de la base); al volver, enseguida.
  useEffect(() => {
    if (!session) return;
    const sync = () => session.setHidden(document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [session]);

  async function enter() {
    setError("");
    setBusy(true);
    const r = await api.join(roomId, name);
    if (!r.ok) {
      setBusy(false);
      if (r.status === 404) return setScreen({ kind: "error", message: "Esa sala no existe. Puede que el código esté mal o que el servidor se haya reiniciado." });
      return setError(r.error.message);
    }
    saveIdentity(roomId, { token: r.value.token, name: name.trim() });
    await connect(r.value.token);
    setBusy(false);
  }

  async function act(run: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError("");
    setBusy(true);
    const r = await run();
    if (!r.ok) setError(r.error?.message ?? "No se pudo.");
    await sessionRef.current?.refresh();
    setBusy(false);
  }

  if (screen.kind === "checking") return <Card title="Entrando a la sala…"><p>Un momento.</p></Card>;

  if (screen.kind === "error") {
    return (
      <Card title="No encontramos la sala">
        <p>{screen.message}</p>
        <Link className="room-btn primary" href="/sala">
          Crear una sala nueva
        </Link>
      </Card>
    );
  }

  if (screen.kind === "join") {
    return (
      <Card title="Hola, presentate compañero">
        <p>
          Te invitaron a la sala <span className="code">{roomId}</span>. ¿Cómo te llamás?
        </p>
        <label>
          Tu nombre
          <input value={name} maxLength={20} autoComplete="nickname" autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && enter()} placeholder="Como te van a ver los demás" />
        </label>
        <button type="button" className="room-btn primary" disabled={busy || !name.trim()} onClick={enter}>
          Entrar a la sala
        </button>
        <div className="room-error" role="alert">
          {error}
        </div>
      </Card>
    );
  }

  if (!view || !session) return null;

  if (view.status === "lobby") {
    return (
      <Lobby
        view={view}
        roomId={roomId}
        busy={busy}
        error={error}
        onAddBot={() => act(() => api.addBot(roomId, tokenRef.current))}
        onStart={() => act(() => api.start(roomId, tokenRef.current))}
      />
    );
  }

  return <OnlineBoard session={session} seats={view.seats} seed={seedOf(roomId)} />;
}
