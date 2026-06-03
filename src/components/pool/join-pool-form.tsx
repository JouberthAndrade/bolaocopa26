"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinPool } from "@/server/actions/pools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function JoinPoolForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await joinPool({ code: String(form.get("code") ?? "") });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/b/${res.data.slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Input name="code" placeholder="Código do convite" required className="uppercase" />
      <Button type="submit" disabled={loading}>
        {loading ? "..." : "Entrar"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
