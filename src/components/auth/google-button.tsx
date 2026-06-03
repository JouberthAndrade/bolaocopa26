"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function GoogleButton({ callbackUrl = "/" }: { callbackUrl?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => signIn("google", { callbackUrl })}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M21.35 11.1h-9.17v2.92h5.27c-.23 1.4-1.64 4.1-5.27 4.1-3.17 0-5.76-2.62-5.76-5.85s2.59-5.85 5.76-5.85c1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.71 3.55 14.66 2.7 12.18 2.7 7.03 2.7 2.86 6.87 2.86 12.02s4.17 9.32 9.32 9.32c5.38 0 8.94-3.78 8.94-9.1 0-.61-.07-1.08-.17-1.55Z"
        />
      </svg>
      Entrar com Google
    </Button>
  );
}
