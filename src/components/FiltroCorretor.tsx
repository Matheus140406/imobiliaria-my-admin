"use client";

import { useRouter } from "next/navigation";

export function FiltroCorretor({
  corretores,
  valorAtual,
}: {
  corretores: { id: string; nome: string }[];
  valorAtual?: string;
}) {
  const router = useRouter();

  return (
    <select
      defaultValue={valorAtual ?? ""}
      onChange={(e) => {
        const value = e.target.value;
        router.push(value ? `/dashboard?corretor=${value}` : "/dashboard");
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
