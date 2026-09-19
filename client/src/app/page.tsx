"use client";

import { useEffect, useRef } from "react";
import { MARKUP, initBoard } from "@/lib/board";

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current!;
    root.innerHTML = MARKUP; // DOM nuevo en cada montaje: evita listeners duplicados
    const dispose = initBoard();
    return () => {
      dispose();
      root.innerHTML = "";
    };
  }, []);

  return <div ref={rootRef} />;
}
