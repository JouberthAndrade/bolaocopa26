import Image from "next/image";

interface FlagProps {
  countryCode?: string | null;
  name: string;
  size?: number;
  className?: string;
}

/**
 * Bandeira via flagcdn.com usando o código ISO-2 em minúsculas.
 * Ex.: "BR" → https://flagcdn.com/w40/br.png
 */
export function Flag({ countryCode, name, size = 32, className }: FlagProps) {
  if (!countryCode) {
    return (
      <div
        style={{ width: size, height: size * 0.67 }}
        className="rounded-sm bg-secondary"
        aria-label={name}
      />
    );
  }

  const iso = countryCode.toLowerCase();
  // flagcdn tem w20, w40, w80, w160 — escolhe o mais próximo do tamanho pedido
  const cdnSize = size <= 24 ? 20 : size <= 48 ? 40 : size <= 96 ? 80 : 160;
  const src = `https://flagcdn.com/w${cdnSize}/${iso}.png`;

  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={Math.round(size * 0.67)}
      className={`rounded-sm object-cover shadow-sm ${className ?? ""}`}
      unoptimized // flagcdn já entrega otimizado; evita double-proxy do Next
    />
  );
}
