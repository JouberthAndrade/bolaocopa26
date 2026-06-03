"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinPool } from "@/server/actions/pools";
import { Button } from "@/components/ui/button";

export function AcceptInvite({ code }: { code: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setLoading(true);
    setError(null);
    const res = await joinPool({ code });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/b/${res.data.slug}`);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" size="lg" onClick={accept} disabled={loading}>
        {loading ? "Entrando..." : "Entrar no bolão"}
      </Button>
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
