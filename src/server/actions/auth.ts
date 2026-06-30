"use server";

import bcrypt from "bcryptjs";
import { signOut } from "@/auth";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validations";

/** Encerra a sessão e volta para o login. Usado pelo UserMenu (client). */
export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

type ActionResult = { ok: true } | { ok: false; error: string };

export async function registerUser(formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "Já existe uma conta com este e-mail" };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.create({ data: { name, email, passwordHash } });

  return { ok: true };
}
