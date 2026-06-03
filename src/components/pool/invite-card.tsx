"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InviteCard({ code, appUrl }: { code: string; appUrl: string }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const link = `${appUrl}/invite/${code}`;

  function copy(value: string, kind: "link" | "code") {
    navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium">Convide seus amigos</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-secondary px-3 py-2 text-sm">{link}</code>
        <Button size="icon" variant="outline" onClick={() => copy(link, "link")} aria-label="Copiar link">
          {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Código:</span>
        <button
          onClick={() => copy(code, "code")}
          className="rounded-md bg-secondary px-2 py-1 font-mono text-sm tracking-widest hover:bg-secondary/70"
        >
          {code} {copied === "code" ? "✓" : ""}
        </button>
      </div>
    </div>
  );
}
