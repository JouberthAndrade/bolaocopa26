"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, changePassword } from "@/server/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Loader2 } from "lucide-react";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProfileForm({
  defaultName,
  defaultImage,
  hasPassword,
}: {
  defaultName: string;
  defaultImage: string;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currentImage, setCurrentImage] = useState(defaultImage);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const f = new FormData(e.currentTarget);
    const res = await updateProfile({ name: f.get("name"), image: currentImage });
    setMsg(res.ok ? "Perfil atualizado!" : res.error);
    if (res.ok) router.refresh();
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwdMsg(null);
    const f = new FormData(e.currentTarget);
    const res = await changePassword({
      currentPassword: f.get("currentPassword"),
      newPassword: f.get("newPassword"),
    });
    setPwdMsg(res.ok ? "Senha alterada!" : res.error);
    if (res.ok) (e.target as HTMLFormElement).reset();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);

    if (file.size > MAX_BYTES) {
      setAvatarError("Foto muito grande. Máximo 2MB.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/avatar/upload", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        setAvatarError(data.error ?? "Erro ao fazer upload.");
        return;
      }

      setCurrentImage(data.url);
      router.refresh();
    } catch {
      setAvatarError("Erro de conexão. Tente novamente.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={saveProfile} className="space-y-3">
            <h2 className="font-semibold">Dados</h2>

            {/* Avatar clicável */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="relative group h-20 w-20 rounded-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Alterar foto de perfil"
              >
                {currentImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentImage}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground">
                    {getInitials(defaultName) || "?"}
                  </div>
                )}

                {/* Overlay câmera */}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {avatarError && (
              <p className="text-sm text-destructive text-center">{avatarError}</p>
            )}

            <Input name="name" defaultValue={defaultName} placeholder="Nome" required />
            {msg && <p className="text-sm text-primary">{msg}</p>}
            <Button type="submit" disabled={uploading}>
              Salvar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={savePassword} className="space-y-3">
            <h2 className="font-semibold">Senha</h2>
            {hasPassword && (
              <Input name="currentPassword" type="password" placeholder="Senha atual" required />
            )}
            <Input name="newPassword" type="password" placeholder="Nova senha (mín. 8)" required />
            {pwdMsg && <p className="text-sm text-primary">{pwdMsg}</p>}
            <Button type="submit">{hasPassword ? "Alterar senha" : "Definir senha"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
