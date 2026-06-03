import { CreatePoolForm } from "@/components/pool/create-pool-form";

export default function NewPoolPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Criar bolão</h1>
      <CreatePoolForm />
    </div>
  );
}
