"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/server/guards";

type ActionResult = { ok: true } | { ok: false; error: string };

const profileSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(60),
  image: z.string().url("URL inválida").optional().or(z.literal("")),
});

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };

  await db.user.update({
    where: { id: userId },
    data: { name: parsed.data.name, image: parsed.data.image || null },
  });
  revalidatePath("/profile");
  return { ok: true };
}

const passwordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, "Mínimo de 8 caracteres").max(72),
  });

export async function changePassword(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "Usuário não encontrado" };

  // Se já tem senha, exige a atual.
  if (user.passwordHash) {
    const valid = await bcrypt.compare(parsed.data.currentPassword ?? "", user.passwordHash);
    if (!valid) return { ok: false, error: "Senha atual incorreta" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.user.update({ where: { id: userId }, data: { passwordHash } });
  return { ok: true };
}
