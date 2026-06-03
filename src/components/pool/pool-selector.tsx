"use client";

import { useRouter } from "next/navigation";

interface PoolOption {
  slug: string;
  name: string;
}

export function PoolSelector({
  pools,
  current,
  basePath = "/",
}: {
  pools: PoolOption[];
  current: string;
  /** Rota base que recebe ?pool=slug (ex.: "/", "/calendar", "/groups"). */
  basePath?: string;
}) {
  const router = useRouter();
  if (pools.length <= 1) return null;
  return (
    <select
      value={current}
      onChange={(e) => router.push(`${basePath}?pool=${e.target.value}`)}
      className="h-9 rounded-lg border border-input bg-secondary px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {pools.map((p) => (
        <option key={p.slug} value={p.slug}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
