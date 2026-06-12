# Avatar Upload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o usuário envie uma foto de perfil clicando no avatar na página de perfil, armazenando a imagem no Vercel Blob.

**Architecture:** Uma rota POST `/api/avatar/upload` recebe o arquivo, valida, faz upload para Vercel Blob e salva a URL no banco. O `ProfileForm` ganha um avatar clicável que dispara o upload automaticamente ao selecionar a foto — o campo de URL manual é removido.

**Tech Stack:** Next.js 15, React 19, TypeScript, `@vercel/blob`, Prisma, NextAuth v5, Tailwind CSS, shadcn/ui.

---

## File Map

| File | Action | Responsabilidade |
|------|--------|-----------------|
| `package.json` | Modify | Adicionar `@vercel/blob` |
| `src/app/api/avatar/upload/route.ts` | Create | Rota POST: valida, faz upload no Blob, salva URL no banco |
| `src/components/profile/profile-form.tsx` | Modify | Avatar clicável, upload automático, remove campo URL |

---

## Task 1: Instalar @vercel/blob

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar o pacote**

```bash
npm install @vercel/blob
```

- [ ] **Step 2: Verificar que instalou corretamente**

```bash
npm ls @vercel/blob
```

Expected: `@vercel/blob@x.x.x` sem erros.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @vercel/blob"
```

---

## Task 2: Criar a rota de upload `/api/avatar/upload`

**Files:**
- Create: `src/app/api/avatar/upload/route.ts`

Esta rota recebe um `FormData` com campo `file`, valida tipo e tamanho, faz upload para Vercel Blob no path `avatars/<userId>/<timestamp>.<ext>`, salva a URL no banco e retorna `{ url }`.

- [ ] **Step 1: Criar o arquivo da rota**

Criar `src/app/api/avatar/upload/route.ts` com o conteúdo:

```typescript
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const userId = session.user.id;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato inválido. Use JPEG, PNG, WEBP ou GIF." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Arquivo muito grande. Máximo 2MB." },
      { status: 413 },
    );
  }

  const ext = file.type.split("/")[1] ?? "jpg";
  const pathname = `avatars/${userId}/${Date.now()}.${ext}`;

  try {
    const blob = await put(pathname, file, { access: "public" });

    await db.user.update({
      where: { id: userId },
      data: { image: blob.url },
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("[avatar/upload]", err);
    return NextResponse.json({ error: "Erro ao fazer upload" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verificar que o TypeScript compila sem erros**

```bash
npx tsc --noEmit
```

Expected: sem erros na rota criada.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/avatar/upload/route.ts
git commit -m "feat: add /api/avatar/upload route (Vercel Blob)"
```

---

## Task 3: Atualizar o ProfileForm

**Files:**
- Modify: `src/components/profile/profile-form.tsx`

Remove o `<Input name="image">` de URL manual. Adiciona um avatar circular clicável no topo do card: mostra a foto atual ou as iniciais do nome como fallback. Ao clicar, abre o seletor de arquivo. Ao selecionar, valida tamanho no cliente, faz POST para `/api/avatar/upload` e chama `router.refresh()`.

- [ ] **Step 1: Substituir o conteúdo de `profile-form.tsx`**

```typescript
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
    const f = new FormData(e.currentTarget);
    const res = await updateProfile({ name: f.get("name"), image: currentImage });
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
```

- [ ] **Step 2: Verificar que o TypeScript compila sem erros**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/profile-form.tsx
git commit -m "feat: avatar upload clicável no perfil"
```

---

## Task 4: Configurar BLOB_READ_WRITE_TOKEN no Vercel

**Files:** nenhum — configuração no dashboard do Vercel.

- [ ] **Step 1: Criar o Blob Store no Vercel**

  1. Acesse [vercel.com](https://vercel.com) → seu projeto → aba **Storage**
  2. Clique em **Create** → selecione **Blob**
  3. Dê um nome (ex: `quintinha-avatars`) e confirme

- [ ] **Step 2: Copiar o token**

  Após criar, vá em **Settings** do Blob Store e copie o valor de `BLOB_READ_WRITE_TOKEN`.

- [ ] **Step 3: Adicionar a variável de ambiente ao projeto**

  No Vercel: **Settings → Environment Variables** → adicione:
  ```
  BLOB_READ_WRITE_TOKEN=<valor copiado>
  ```
  Marque os ambientes: Production, Preview, Development.

- [ ] **Step 4: Adicionar ao `.env.local` para desenvolvimento local**

  ```bash
  # .env.local (não commitar)
  BLOB_READ_WRITE_TOKEN=<valor copiado>
  ```

---

## Task 5: Verificar funcionamento

- [ ] **Step 1: Rodar o servidor local**

```bash
npm run dev
```

- [ ] **Step 2: Acessar a página de perfil e testar o upload**

  1. Navegue até `/profile`
  2. Clique no avatar (deve abrir o seletor de arquivo)
  3. Selecione uma imagem JPEG ou PNG com menos de 2MB
  4. Observe o spinner durante o upload
  5. Após o upload, o avatar deve atualizar com a nova foto

- [ ] **Step 3: Testar erros**

  1. Tente enviar um arquivo > 2MB → deve exibir "Foto muito grande. Máximo 2MB."
  2. Sem `BLOB_READ_WRITE_TOKEN` no `.env.local` → deve exibir "Erro ao fazer upload."

- [ ] **Step 4: Commit final e push**

```bash
git push
```

O Vercel fará o deploy automaticamente com a variável já configurada.
