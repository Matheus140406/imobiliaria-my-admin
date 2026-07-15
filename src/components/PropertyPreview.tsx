"use client";

/**
 * Pré-visualização de como o imóvel vai aparecer publicado — direção
 * visual "imobiliária europeia premium": tipografia serifada, bastante
 * espaço em branco, paleta neutra com um único tom de destaque, fotos em
 * grid editorial. Deliberadamente diferente do visual "portal de anúncio
 * genérico" (sem badges coloridos nem informação poluída).
 */
export type FotoPreview = { url: string; tipo: "imagem" | "video" };

const FONTE_SERIFADA = "Georgia, 'Times New Roman', serif";
const TOM_DESTAQUE = "#9a7a2e";

export function PropertyPreview({
  titulo,
  descricao,
  preco,
  localizacao,
  status,
  fotos,
  onClose,
}: {
  titulo: string;
  descricao: string;
  preco: string;
  localizacao: string;
  status: string;
  fotos: FotoPreview[];
  onClose: () => void;
}) {
  const disponivel = status === "disponivel";
  const precoFormatado = preco
    ? Number(preco).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })
    : "Consulte";

  const [capa, ...resto] = fotos;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-white"
      style={{ fontFamily: FONTE_SERIFADA }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar pré-visualização"
        className="fixed right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-lg text-white shadow-lg"
      >
        &times;
      </button>

      <div className="mx-auto max-w-3xl px-6 py-16 sm:px-10">
        <p className="mb-10 text-center text-xs uppercase tracking-[0.3em] text-neutral-400">
          Pré-visualização — como vai aparecer no site
        </p>

        {capa ? (
          <div className="relative mb-10 aspect-[3/2] w-full overflow-hidden bg-neutral-100">
            {capa.tipo === "video" ? (
              <video src={capa.url} className="h-full w-full object-cover" controls />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={capa.url} alt={titulo} className="h-full w-full object-cover" />
            )}
          </div>
        ) : (
          <div className="mb-10 flex aspect-[3/2] w-full items-center justify-center bg-neutral-50 text-6xl text-neutral-200">
            🏠
          </div>
        )}

        <p className="mb-2 text-center text-xs uppercase tracking-widest text-neutral-400">
          {disponivel ? "Disponível" : "Ocupada"}
        </p>

        <h1 className="mb-4 text-center text-3xl font-normal leading-tight text-neutral-900 sm:text-4xl">
          {titulo || "Nome da casa"}
        </h1>

        <div className="mb-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-neutral-500">
          {localizacao && <span>{localizacao}</span>}
          <span className="text-lg" style={{ color: TOM_DESTAQUE }}>
            {precoFormatado}
          </span>
        </div>

        <div className="mx-auto mb-10 h-px w-16 bg-neutral-200" />

        {descricao && (
          <p className="mx-auto mb-14 max-w-xl text-center text-base leading-relaxed text-neutral-600">
            {descricao}
          </p>
        )}

        {resto.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {resto.map((foto, i) => (
              <div key={i} className="relative aspect-square overflow-hidden bg-neutral-100">
                {foto.tipo === "video" ? (
                  <video src={foto.url} className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={foto.url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-16 text-center">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-full border border-neutral-300 px-8 py-3 text-sm uppercase tracking-widest text-neutral-500"
          >
            Entrar em Contato
          </button>
          <p className="mt-3 text-xs text-neutral-400">
            (botão desativado nesta pré-visualização)
          </p>
        </div>
      </div>
    </div>
  );
}
