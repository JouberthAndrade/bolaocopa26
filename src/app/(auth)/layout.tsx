export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="text-4xl">🏆</div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Bolão Copa 2026</h1>
        <p className="text-sm text-muted-foreground">Jogue com seus amigos</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
