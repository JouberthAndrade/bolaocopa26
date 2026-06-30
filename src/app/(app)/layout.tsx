import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-24 pt-4 md:pb-8">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
