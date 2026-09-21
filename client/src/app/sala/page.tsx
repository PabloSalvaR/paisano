"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { nameStore, saveIdentity } from "@/lib/identity";
import { roomsApi } from "@/lib/roomsApi";

// Jugar online: crear una sala nueva o entrar a una con su código. El código va en el link (/sala/ABC123),
// así que «unirse» es solo ir a esa dirección: ahí se pide el nombre.
export default function OnlineStart() {
  const router = useRouter();
  const stored = useSyncExternalStore(nameStore.subscribe, nameStore.get, nameStore.getServer);
  const [typed, setName] = useState<string | null>(null);
  const name = typed ?? stored; // lo que escribió, o el último nombre usado en este navegador
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setError("");
    setBusy(true);
    const r = await roomsApi().create(name);
    setBusy(false);
    if (!r.ok) return setError(r.error.message);
    saveIdentity(r.value.roomId, { token: r.value.token, name: name.trim() });
    router.push(`/sala/${r.value.roomId}`);
  }

  function join() {
    const id = code.trim().toUpperCase();
    if (id.length < 4) return setError("Escribí el código de la sala.");
    router.push(`/sala/${encodeURIComponent(id)}`);
  }

  return (
    <main className="room-page">
      <div className="room-card">
        <div className="logo" role="img" aria-label="Paisano" />
        <h1>Jugar online</h1>
        <p>Armá una sala y pasales el link a tus amigos, o entrá a la de alguien con su código.</p>
        <label>
          Tu nombre
          <input value={name} maxLength={20} autoComplete="nickname" onChange={(e) => setName(e.target.value)} placeholder="Como te van a ver los demás" />
        </label>
        <button type="button" className="room-btn primary" disabled={busy || !name.trim()} onClick={create}>
          Crear sala
        </button>
        <label>
          ¿Ya tenés un código?
          <span className="row">
            <input value={code} maxLength={8} onChange={(e) => setCode(e.target.value)} placeholder="ABC123" aria-label="Código de la sala" onKeyDown={(e) => e.key === "Enter" && join()} />
            <button type="button" className="room-btn" onClick={join}>
              Unirme
            </button>
          </span>
        </label>
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
