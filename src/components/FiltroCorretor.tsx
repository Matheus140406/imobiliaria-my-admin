"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function FiltroCorretor({
  corretores,
  valorAtual,
}: {
  corretores: { id: string; nome: string }[];
  valorAtual?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      defaultValue={valorAtual ?? ""}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) {
          params.set("corretor", e.target.value);
        } else {
          params.delete("corretor");
        }
        const query = params.toString();
        router.push(`/dashboard${query ? `?${query}` : ""}`);
      }}
      className="rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
    >
      <option value="">Todos os corretores</option>
      {corretores.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nome}
        </option>
      ))}
    </select>
  );
}
