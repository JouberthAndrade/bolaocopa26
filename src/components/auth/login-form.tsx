"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleButton } from "@/components/auth/google-button";

function Inner({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("E-mail ou senha incorretos");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {googleEnabled && (
          <>
            <GoogleButton callbackUrl={callbackUrl} />
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />ou
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
        <form onSubmit={onSubmit} className="space-y-3">
          <Input name="email" type="email" placeholder="seu@email.com" required autoComplete="email" />
          <Input
            name="password"
            type="password"
            placeholder="Senha"
            required
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <div className="mt-4 flex justify-between text-sm text-muted-foreground">
          <Link href="/forgot-password" className="hover:text-foreground">
            Esqueci a senha
          </Link>
          <Link href="/register" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  return (
    <Suspense fallback={null}>
      <Inner googleEnabled={googleEnabled} />
    </Suspense>
  );
}
