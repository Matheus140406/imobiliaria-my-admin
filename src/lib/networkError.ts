/**
 * Heurística para reconhecer falhas de rede (sem internet) e diferenciá-las
 * de erros "normais" do Supabase (validação, RLS, etc). Não é 100% precisa
 * (não existe forma garantida de saber a causa de todo erro de fetch), mas
 * cobre os casos comuns: `TypeError: Failed to fetch` do navegador e o
 * `navigator.onLine` mudando para `false` durante a operação.
 *
 * Importante: NÃO tratar todo `TypeError` como erro de rede. `fetch()`
 * falho realmente lança `TypeError`, mas qualquer bug (ex: acessar
 * propriedade de `undefined`) também lança `TypeError` — tratar todos como
 * "offline" fazia bugs reais serem silenciosamente enfileirados como
 * "publicação agendada", nunca chegando ao Supabase enquanto o usuário
 * seguia online o tempo todo.
 */
export function pareceErroDeRede(erro: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;

  const mensagem =
    erro instanceof Error
      ? erro.message
      : typeof erro === "string"
        ? erro
        : "";

  // Mensagens que os navegadores realmente usam para falha de fetch a
  // nível de rede (Chrome/Edge, Firefox, Safari/iOS respectivamente).
  return /Failed to fetch|Load failed|NetworkError when attempting to fetch|net::ERR_/i.test(
    mensagem,
  );
}
