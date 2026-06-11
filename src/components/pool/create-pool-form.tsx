"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import { createPool } from "@/server/actions/pools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const SCORING_PRESETS = {
  padrao: { label: "Padrão (exato 3 / resultado 2)", result: 2, draw: 2, exact: 1 },
  agressivo: { label: "Agressivo (exato 5 / resultado 3)", result: 3, draw: 3, exact: 2 },
  exato: { label: "Só placar exato (10)", result: 0, draw: 0, exact: 10 },
};

type PrizeTier = { position: number; percentage: number };

export function CreatePoolForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scoring, setScoring] = useState({ result: 2, draw: 2, exact: 1 });
  const [prizes, setPrizes] = useState<PrizeTier[]>([{ position: 1, percentage: 100 }]);
  const [betsVisibility, setBetsVisibility] = useState<"HIDDEN" | "OPEN" | "AFTER_LOCK">("AFTER_LOCK");

  const prizeSum = prizes.reduce((s, t) => s + (Number(t.percentage) || 0), 0);

  function applyPreset(key: keyof typeof SCORING_PRESETS) {
    const p = SCORING_PRESETS[key];
    setScoring({ result: p.result, draw: p.draw, exact: p.exact });
  }

  function updatePrize(i: number, value: number) {
    setPrizes((prev) => prev.map((t, idx) => (idx === i ? { ...t, percentage: value } : t)));
  }
  function addPrize() {
    setPrizes((prev) => [...prev, { position: prev.length + 1, percentage: 0 }]);
  }
  function removePrize(i: number) {
    setPrizes((prev) => prev.filter((_, idx) => idx !== i).map((t, idx) => ({ ...t, position: idx + 1 })));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (Math.round(prizeSum) !== 100) {
      setError("A soma das premiações deve ser 100%");
      return;
    }
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await createPool({
      name: String(form.get("name")),
      slug: String(form.get("slug")).toUpperCase(),
      description: String(form.get("description") ?? ""),
      stakeAmount: Number(form.get("stakeAmount") ?? 0),
      currency: "BRL",
      entryDeadline: form.get("entryDeadline") ? new Date(String(form.get("entryDeadline"))) : undefined,
      betsVisibility,
      pointsCorrectResult: scoring.result,
      pointsCorrectDraw: scoring.draw,
      pointsExactScore: scoring.exact,
      championBonus: Number(form.get("championBonus") ?? 5),
      runnerUpBonus: Number(form.get("runnerUpBonus") ?? 3),
      topScorerBonus: Number(form.get("topScorerBonus") ?? 5),
      prizeTiers: prizes.map((t) => ({ position: t.position, percentage: Number(t.percentage) })),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/b/${res.data.slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* 1. Geral */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <h2 className="font-semibold">1. Informações gerais</h2>
          <Input name="name" placeholder="Nome do bolão" required />
          <Input
            name="slug"
            placeholder="Identificador (ex.: JOGAJUNTO)"
            required
            className="uppercase"
            pattern="[A-Za-z0-9]+"
            title="Apenas letras e números"
          />
          <Input name="description" placeholder="Descrição (opcional)" />
          <div className="flex gap-2">
            <Input name="stakeAmount" type="number" step="0.01" min="0" placeholder="Valor da aposta (R$)" />
            <Input name="entryDeadline" type="datetime-local" title="Prazo do palpite de campeão" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Regras */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <h2 className="font-semibold">2. Regras de pontuação</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SCORING_PRESETS).map(([key, p]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyPreset(key as keyof typeof SCORING_PRESETS)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <LabeledNumber label="Resultado (vitória)" value={scoring.result} onChange={(v) => setScoring((s) => ({ ...s, result: v }))} />
            <LabeledNumber label="Resultado (empate)" value={scoring.draw} onChange={(v) => setScoring((s) => ({ ...s, draw: v }))} />
            <LabeledNumber label="Bônus placar exato (+)" value={scoring.exact} onChange={(v) => setScoring((s) => ({ ...s, exact: v }))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NamedNumber name="championBonus" label="Bônus campeão" def={5} />
            <NamedNumber name="runnerUpBonus" label="Bônus vice" def={3} />
            <NamedNumber name="topScorerBonus" label="Bônus artilheiro" def={5} />
          </div>
        </CardContent>
      </Card>

      {/* 3. Premiação */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">3. Premiação</h2>
            <span className={prizeSum === 100 ? "text-sm text-primary" : "text-sm text-destructive"}>
              Σ {prizeSum}%
            </span>
          </div>
          {prizes.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-16 text-sm">{t.position}º lugar</span>
              <Input
                type="number"
                min="0"
                max="100"
                value={t.percentage}
                onChange={(e) => updatePrize(i, Number(e.target.value))}
              />
              <span className="text-sm text-muted-foreground">%</span>
              {prizes.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removePrize(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addPrize}>
            <Plus className="h-4 w-4" /> Adicionar posição
          </Button>
        </CardContent>
      </Card>

      {/* 4. Visibilidade */}
      <Card>
        <CardContent className="space-y-2 pt-6">
          <h2 className="font-semibold">4. Visibilidade dos palpites</h2>
          {(
            [
              ["AFTER_LOCK", "Após o fechamento (recomendado)"],
              ["HIDDEN", "Sempre ocultos"],
              ["OPEN", "Sempre visíveis"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="betsVisibility"
                checked={betsVisibility === value}
                onChange={() => setBetsVisibility(value)}
              />
              {label}
            </label>
          ))}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "Criando..." : "Criar bolão"}
      </Button>
    </form>
  );
}

function LabeledNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="text-xs text-muted-foreground">
      {label}
      <Input type="number" min="0" value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1" />
    </label>
  );
}

function NamedNumber({ name, label, def }: { name: string; label: string; def: number }) {
  return (
    <label className="text-xs text-muted-foreground">
      {label}
      <Input type="number" min="0" name={name} defaultValue={def} className="mt-1" />
    </label>
  );
}
