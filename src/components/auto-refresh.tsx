"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Atualiza os dados do servidor periodicamente (ranking/feed "tempo quase real"). */
export function AutoRefresh({ intervalMs = 20000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
