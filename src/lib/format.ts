export function formatPreco(preco: number | null) {
  if (preco == null) return "Consulte";
  return preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatData(data: string | null) {
  if (!data) return "-";
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Formata uma data ISO (ex: "criado_em") como "há 2 dias", "hoje", "ontem",
 * ou, se for mais antiga que ~30 dias, como DD/MM/AAAA.
 */
export function formatDataPublicacao(iso: string): string {
  const data = new Date(iso);
  const agora = new Date();
  const inicioDoDia = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDias = Math.round(
    (inicioDoDia(agora) - inicioDoDia(data)) / (1000 * 60 * 60 * 24),
  );

  if (diffDias === 0) return "Hoje";
  if (diffDias === 1) return "Ontem";
  if (diffDias > 1 && diffDias < 30) return `Há ${diffDias} dias`;

  return data.toLocaleDateString("pt-BR");
}
