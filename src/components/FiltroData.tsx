"use client";

import { useRouter, useSearchParams } from "next/navigation";

export const PERIODOS = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  mes: "Este mês",
} as const;

export type PeriodoValor = keyof typeof PERIODOS;

export function FiltroData({ valorAtual }: { valorAtual?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function irPara(periodo: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (periodo) {
      params.set("periodo", periodo);
    } else {
      params.delete("periodo");
    }
    const query = params.toString();
    router.push(`/dashboard${query ? `?${query}` : ""}`);
  }

  return (
    <select
      defaultValue={valorAtual ?? ""}
      onChange={(e) => irPara(e.target.value)}
      className="rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
    >
      <option value="">Todas as datas</option>
      {Object.entries(PERIODOS).map(([valor, rotulo]) => (
        <option key={valor} value={valor}>
          {rotulo}
        </option>
      ))}
    </select>
  );
}
