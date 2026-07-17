import Link from "next/link";
import { createClient } from "@/lib/supabase-db/server";
import { getCorretorAtual } from "@/lib/auth";
import { ImoveisCarousel } from "@/components/ImoveisCarousel";
import { FiltroCorretor } from "@/components/FiltroCorretor";
import { FiltroData, type PeriodoValor } from "@/components/FiltroData";
import type { Tables } from "@/lib/supabase-db/types";

function calcularDataInicial(periodo?: string): string | null {
  const agora = new Date();
  const inicioDoDia = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate(),
  );

  switch (periodo as PeriodoValor | undefined) {
    case "7d": {
      const data = new Date(inicioDoDia);
      data.setDate(data.getDate() - 6);
      return data.toISOString();
    }
    case "30d": {
      const data = new Date(inicioDoDia);
      data.setDate(data.getDate() - 29);
      return data.toISOString();
    }
    case "mes":
      return new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    default:
      return null;
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ corretor?: string; periodo?: string }>;
}) {
  const { corretor: corretorFiltro, periodo } = await searchParams;
  const corretorAtual = await getCorretorAtual();
  if (!corretorAtual) return null;

  const supabase = await createClient();
  const isAdmin = corretorAtual.papel === "admin";

  let query = supabase
    .from("imoveis")
    .select("*, corretor:corretores(nome), midias(id, url, tipo, ordem)")
    .is("deletado_em", null)
    .order("criado_em", { ascending: false })
    .order("ordem", { referencedTable: "midias" });

  if (isAdmin && corretorFiltro) {
    query = query.eq("corretor_id", corretorFiltro);
  }

  const dataInicial = calcularDataInicial(periodo);
  if (dataInicial) {
    query = query.gte("criado_em", dataInicial);
  }

  const { data: imoveis } = await query;

  let corretores: Tables<"corretores">[] = [];
  if (isAdmin) {
    const { data } = await supabase
      .from("corretores")
      .select("*")
      .order("nome");
    corretores = data ?? [];
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Imóveis</h1>
        <Link
          href="/dashboard/imoveis/novo"
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          + Novo imóvel
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {isAdmin && (
          <FiltroCorretor corretores={corretores} valorAtual={corretorFiltro} />
        )}
        <FiltroData valorAtual={periodo} />
      </div>

      <ImoveisCarousel imoveis={imoveis ?? []} mostrarCorretor={isAdmin} />

      {(imoveis ?? []).length === 0 && (
        <p className="py-8 text-center text-neutral-500">
          Nenhum imóvel encontrado para esse filtro.
        </p>
      )}
    </div>
  );
}
