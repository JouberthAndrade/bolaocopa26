import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { isGoogleAuthEnabled } from "@/lib/env";

/**
 * Configuração "edge-safe": sem Prisma e sem bcrypt aqui,
 * para poder rodar no middleware (Edge runtime).
 * O provider Credentials é adicionado em auth.ts (runtime Node).
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(isGoogleAuthEnabled
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;
