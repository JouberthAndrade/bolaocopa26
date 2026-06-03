"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  // MVP: stub. Integração com Resend fica para o pós-MVP (ver roadmap).
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {sent ? (
          <p className="text-sm text-muted-foreground">
            Se existir uma conta com este e-mail, enviaremos um link de recuperação.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Informe seu e-mail para receber o link de recuperação.
            </p>
            <Input name="email" type="email" placeholder="seu@email.com" required />
            <Button type="submit" className="w-full">
              Enviar link
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">
            Voltar ao login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
