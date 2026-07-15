export function formatPreco(preco: number | null) {
  if (preco == null) return "Consulte";
  return preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
