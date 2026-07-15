/**
 * Busca endereço a partir de um CEP usando a API pública do ViaCEP
 * (gratuita, sem necessidade de chave). Retorna só bairro/cidade/UF —
 * nunca rua ou número, por privacidade do imóvel anunciado.
 */
export type EnderecoViaCep = {
  bairro: string;
  localidade: string;
  uf: string;
};

export async function buscarEnderecoPorCep(
  cep: string,
): Promise<EnderecoViaCep | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  const resposta = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!resposta.ok) return null;

  const dados = await resposta.json();
  if (dados.erro) return null;

  return {
    bairro: dados.bairro ?? "",
    localidade: dados.localidade ?? "",
    uf: dados.uf ?? "",
  };
}

export function formatarCep(valor: string): string {
  const digits = valor.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatarLocalizacaoDoEndereco(endereco: EnderecoViaCep): string {
  const partes = [endereco.bairro, endereco.localidade].filter(Boolean);
  const cidade = partes.join(", ");
  return endereco.uf ? `${cidade} - ${endereco.uf}` : cidade;
}
