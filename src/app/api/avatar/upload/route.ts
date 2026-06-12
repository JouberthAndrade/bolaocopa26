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
