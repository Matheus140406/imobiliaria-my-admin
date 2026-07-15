import { createClient } from "@/lib/supabase-db/server";
import { getCorretorAtual } from "@/lib/auth";
import { ImovelForm } from "@/components/ImovelForm";
import type { Tables } from "@/lib/supabase-db/types";

export default async function NovoImovelPage() {
  const corretorAtual = await getCorretorAtual();
  if (!corretorAtual) return null;

  const supabase = await createClient();

  let corretores: Tables<"corretores">[] = [];
  if (corretorAtual.papel === "admin") {
    const { data } = await supabase
      .from("corretores")
      .select("*")
      .order("nome");
    corretores = data ?? [];
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Novo imóvel</h1>
      <ImovelForm corretorAtual={corretorAtual} corretores={corretores} />
    </div>
  );
}
