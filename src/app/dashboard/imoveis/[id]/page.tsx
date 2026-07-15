import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-db/server";
import { getCorretorAtual } from "@/lib/auth";
import { ImovelForm } from "@/components/ImovelForm";
import { MediaManager } from "@/components/MediaManager";
import type { Tables } from "@/lib/supabase-db/types";

export default async function EditarImovelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const corretorAtual = await getCorretorAtual();
  if (!corretorAtual) return null;

  const supabase = await createClient();
  const { data: imovel } = await supabase
    .from("imoveis")
    .select("*")
    .eq("id", id)
    .single();

  if (!imovel) notFound();

  const { data: midias } = await supabase
    .from("midias")
    .select("*")
    .eq("imovel_id", id)
    .order("ordem");

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
      <h1 className="mb-6 text-xl font-semibold">Editar imóvel</h1>
      <ImovelForm
        imovel={imovel}
        corretorAtual={corretorAtual}
        corretores={corretores}
        midiasIniciais={midias ?? []}
      />
      <MediaManager imovelId={imovel.id} midiasIniciais={midias ?? []} />
    </div>
  );
}
