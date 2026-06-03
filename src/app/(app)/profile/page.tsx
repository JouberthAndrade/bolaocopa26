import { requireUserId } from "@/server/guards";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/profile/profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const userId = await requireUserId();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, image: true, email: true, passwordHash: true },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Perfil</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>
      <ProfileForm
        defaultName={user?.name ?? ""}
        defaultImage={user?.image ?? ""}
        hasPassword={!!user?.passwordHash}
      />
    </div>
  );
}
