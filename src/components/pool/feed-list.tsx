import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { FeedType } from "@prisma/client";

interface FeedItem {
  id: string;
  type: FeedType;
  createdAt: Date;
  payload: unknown;
  user: { name: string | null } | null;
}

function renderEvent(item: FeedItem): { icon: string; text: string } {
  const name = item.user?.name ?? "Alguém";
  const p = (item.payload ?? {}) as Record<string, unknown>;
  switch (item.type) {
    case "BET_SCORED":
      return { icon: "⚡", text: `${name} pontuou +${p.points ?? 0} em ${p.match ?? "um jogo"}` };
    case "NEW_LEADER":
      return { icon: "👑", text: `${name} assumiu a liderança (${p.points ?? 0} pts)` };
    case "JOINED":
      return { icon: "🎉", text: `${name} entrou no bolão` };
    case "POOL_CREATED":
      return { icon: "🏁", text: `${name} criou o bolão` };
    default:
      return { icon: "•", text: name };
  }
}

export function FeedList({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const { icon, text } = renderEvent(item);
        return (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm"
          >
            <span className="text-lg">{icon}</span>
            <span className="flex-1">{text}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ptBR })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
