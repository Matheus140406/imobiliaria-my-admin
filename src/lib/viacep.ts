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

export type Coordenadas = { lat: number; lon: number };

/**
 * Geocodifica o endereço já resolvido pelo CEP via Nominatim (OpenStreetMap,
 * gratuito, sem chave). Só busca depois que o CEP já resolveu bairro/
 * cidade/UF — geocodificar o CEP cru sem esse contexto costuma dar
 * resultado errado ou vazio.
 */
export async function geocodificarEndereco(
  endereco: EnderecoViaCep,
): Promise<Coordenadas | null> {
  const consulta = [endereco.bairro, endereco.localidade, endereco.uf, "Brasil"]
    .filter(Boolean)
    .join(", ");
  if (!consulta) return null;

  try {
    const resposta = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(consulta)}`,
    );
    if (!resposta.ok) return null;

    const resultados = await resposta.json();
    const primeiro = resultados?.[0];
    if (!primeiro) return null;

    const lat = Number(primeiro.lat);
    const lon = Number(primeiro.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return { lat, lon };
  } catch {
    return null;
  }
}

export function linkGoogleMaps({ lat, lon }: Coordenadas): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}
