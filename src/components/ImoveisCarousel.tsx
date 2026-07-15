"use client";

import { useRef } from "react";
import { ImovelCard } from "@/components/ImovelCard";
import type { Tables } from "@/lib/supabase-db/types";

type ImovelComRelacoes = Tables<"imoveis"> & {
  corretor: { nome: string } | null;
  midias: Pick<Tables<"midias">, "id" | "url" | "tipo" | "ordem">[];
};

export function ImoveisCarousel({
  imoveis,
  mostrarCorretor,
}: {
  imoveis: ImovelComRelacoes[];
  mostrarCorretor: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function mover(direcao: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector("[data-card]")?.clientWidth ?? 260;
    el.scrollBy({ left: direcao * (cardWidth + 16), behavior: "smooth" });
  }

  if (imoveis.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => mover(-1)}
        aria-label="Ver imóveis anteriores"
        className="absolute -left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-lg shadow-md dark:border-neutral-700 dark:bg-neutral-900"
      >
        ‹
      </button>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {imoveis.map((imovel) => (
          <div key={imovel.id} data-card className="w-64 shrink-0">
            <ImovelCard imovel={imovel} mostrarCorretor={mostrarCorretor} />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => mover(1)}
        aria-label="Ver mais imóveis"
        className="absolute -right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-lg shadow-md dark:border-neutral-700 dark:bg-neutral-900"
      >
        ›
      </button>
    </div>
  );
}
