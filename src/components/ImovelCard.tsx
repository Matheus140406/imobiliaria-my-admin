"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-db/client";
import type { Tables } from "@/lib/supabase-db/types";
import { formatPreco, formatDataPublicacao } from "@/lib/format";

type ImovelComRelacoes = Tables<"imoveis"> & {
  corretor: { nome: string } | null;
  midias: Pick<Tables<"midias">, "id" | "url" | "tipo" | "ordem">[];
};

export function ImovelCard({
  imovel,
  mostrarCorretor,
}: {
  imovel: ImovelComRelacoes;
  mostrarCorretor: boolean;
}) {
  const router = useRouter();
  const [excluindo, setExcluindo] = useState(false);

  const midiasOrdenadas = [...(imovel.midias ?? [])].sort((a, b) => a.ordem - b.ordem);
  const capa =
    midiasOrdenadas.find((m) => m.tipo === "imagem") ?? midiasOrdenadas[0] ?? null;

  const disponivel = imovel.status === "disponivel";

  async function handleExcluir() {
    if (
      !confirm(
        `Excluir "${imovel.titulo}"? O imóvel sai do site, mas o histórico é mantido.`,
      )
    )
      return;

    setExcluindo(true);
    const supabase = createClient();
    await supabase
      .from("imoveis")
      .update({ deletado_em: new Date().toISOString() })
      .eq("id", imovel.id);
    setExcluindo(false);
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="relative aspect-[16/10] w-full bg-neutral-100 dark:bg-neutral-900">
        {capa ? (
          capa.tipo === "video" ? (
            <video
              src={capa.url}
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <Image
              src={capa.url}
              alt={imovel.titulo}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-neutral-300 dark:text-neutral-700">
            🏠
          </div>
        )}
        <span
          className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow ${
            disponivel ? "bg-green-500" : "bg-neutral-600"
          }`}
        >
          {disponivel ? "Disponível" : "Indisponível"}
        </span>
      </div>

      <div className="p-3">
        <h2 className="truncate text-sm font-semibold">{imovel.titulo}</h2>
        {imovel.localizacao && (
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            📍 {imovel.localizacao}
          </p>
        )}
        <p className="mt-1 text-base font-bold text-neutral-900 dark:text-white">
          {formatPreco(imovel.preco)}
        </p>
        {(imovel.quartos || imovel.banheiros || imovel.vagas || imovel.area_m2) && (
          <p className="mt-0.5 text-xs text-neutral-500">
            {[
              imovel.quartos ? `${imovel.quartos} qt` : null,
              imovel.banheiros ? `${imovel.banheiros} ban` : null,
              imovel.vagas ? `${imovel.vagas} vg` : null,
              imovel.area_m2 ? `${imovel.area_m2}m²` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {mostrarCorretor && (
          <p className="mt-0.5 text-xs text-neutral-500">
            Corretor: {imovel.corretor?.nome ?? "-"}
          </p>
        )}
        <p className="mt-1 text-[11px] text-neutral-400">
          Publicado {formatDataPublicacao(imovel.criado_em).toLowerCase()}
        </p>

        <div className="mt-2 flex gap-1.5">
          <Link
            href={`/dashboard/imoveis/${imovel.id}`}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-neutral-900 px-2 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900"
          >
            ✏️ Editar
          </Link>
          <button
            type="button"
            onClick={handleExcluir}
            disabled={excluindo}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-red-200 px-2 py-2 text-xs font-semibold text-red-600 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
          >
            🗑️ Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
