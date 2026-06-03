"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, changePassword } from "@/server/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

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
  const [msg, setMsg] = useState<string | null>(null);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await updateProfile({ name: f.get("name"), image: f.get("image") });
    setMsg(res.ok ? "Perfil atualizado!" : res.error);
    if (res.ok) router.refresh();
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await changePassword({
      currentPassword: f.get("currentPassword"),
      newPassword: f.get("newPassword"),
    });
    setPwdMsg(res.ok ? "Senha alterada!" : res.error);
    if (res.ok) (e.target as HTMLFormElement).reset();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={saveProfile} className="space-y-3">
            <h2 className="font-semibold">Dados</h2>
            <Input name="name" defaultValue={defaultName} placeholder="Nome" required />
            <Input name="image" defaultValue={defaultImage} placeholder="URL da foto (opcional)" />
            {msg && <p className="text-sm text-primary">{msg}</p>}
            <Button type="submit">Salvar</Button>
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
