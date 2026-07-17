"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-db/client";
import { gerarSlug } from "@/lib/slug";
import { pareceErroDeRede } from "@/lib/networkError";
import { uploadMidiaParaImovel } from "@/lib/uploadMidias";
import {
  adicionarImovelPendente,
  adicionarEdicaoPendente,
} from "@/lib/offlineQueue";
import { OfflineBanner } from "@/components/OfflineBanner";
import { StatusToggle } from "@/components/StatusToggle";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { PropertyPreview, type FotoPreview } from "@/components/PropertyPreview";
import {
  buscarEnderecoPorCep,
  formatarCep,
  formatarLocalizacaoDoEndereco,
  geocodificarEndereco,
  linkGoogleMaps,
  type Coordenadas,
} from "@/lib/viacep";
import type { Tables } from "@/lib/supabase-db/types";

const MAX_ARQUIVOS = 30;
const MENSAGEM_OFFLINE =
  "Você está offline. Sua publicação foi agendada e entrará no ar assim que houver sinal.";

type Corretor = Pick<Tables<"corretores">, "id" | "nome">;

function derivarTitulo(descricao: string): string {
  const primeiraLinha = descricao.trim().split("\n")[0] ?? "";
  return primeiraLinha.slice(0, 60).trim();
}

export function ImovelForm({
  imovel,
  corretorAtual,
  corretores,
  midiasIniciais = [],
}: {
  imovel?: Tables<"imoveis">;
  corretorAtual: Tables<"corretores">;
  corretores: Corretor[];
  midiasIniciais?: Pick<Tables<"midias">, "url" | "tipo">[];
}) {
  const router = useRouter();
  const isAdmin = corretorAtual.papel === "admin";
  const editando = Boolean(imovel);

  const [titulo, setTitulo] = useState(imovel?.titulo ?? "");
  const [descricao, setDescricao] = useState(imovel?.descricao ?? "");
  const [preco, setPreco] = useState(imovel?.preco?.toString() ?? "");
  const [localizacao, setLocalizacao] = useState(imovel?.localizacao ?? "");
  const [status, setStatus] = useState(imovel?.status ?? "disponivel");
  const [dataVenda, setDataVenda] = useState(imovel?.data_venda ?? "");
  const [corretorId, setCorretorId] = useState(
    imovel?.corretor_id ?? corretorAtual.id,
  );
  const [quartos, setQuartos] = useState(imovel?.quartos?.toString() ?? "");
  const [banheiros, setBanheiros] = useState(
    imovel?.banheiros?.toString() ?? "",
  );
  const [vagas, setVagas] = useState(imovel?.vagas?.toString() ?? "");
  const [areaM2, setAreaM2] = useState(imovel?.area_m2?.toString() ?? "");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [mostrarAvancado, setMostrarAvancado] = useState(
    Boolean(
      imovel?.preco ||
        imovel?.localizacao ||
        imovel?.data_venda ||
        imovel?.quartos ||
        imovel?.banheiros ||
        imovel?.vagas ||
        imovel?.area_m2,
    ),
  );
  const [cep, setCep] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState<string | null>(null);
  const [coordenadas, setCoordenadas] = useState<Coordenadas | null>(null);
  const [buscandoCoordenadas, setBuscandoCoordenadas] = useState(false);
  const [mostrarPreview, setMostrarPreview] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [offlineQueued, setOfflineQueued] = useState(false);

  // Id de idempotência: gerado UMA vez por formulário de criação e reusado
  // em toda tentativa de salvar (online, retry após erro, ou fallback para
  // a fila offline). Isso é o que evita o imóvel duplicado: se a mesma
  // criação for reenviada por qualquer caminho, ela sempre aponta pra essa
  // mesma linha em vez de gerar uma nova.
  const idIdempotenciaRef = useRef<string>(
    typeof crypto !== "undefined" ? crypto.randomUUID() : "",
  );
  // Trava síncrona contra duplo-clique/duplo-toque: o `disabled={salvando}`
  // do botão só reflete no DOM depois de um re-render do React, então dois
  // cliques muito rápidos (comum no celular) podiam disparar duas chamadas
  // de salvar em paralelo antes do botão desabilitar. Esse ref é atualizado
  // na hora, sem esperar re-render.
  const enviandoRef = useRef(false);

  const novasFotosUrls = useMemo<FotoPreview[]>(
    () =>
      arquivos.map((arquivo) => ({
        url: URL.createObjectURL(arquivo),
        tipo: arquivo.type.startsWith("video") ? "video" : "imagem",
      })),
    [arquivos],
  );

  useEffect(() => {
    return () => {
      novasFotosUrls.forEach((u) => URL.revokeObjectURL(u.url));
    };
  }, [novasFotosUrls]);

  const fotosPreview: FotoPreview[] = [
    ...midiasIniciais.map((m) => ({ url: m.url, tipo: m.tipo as "imagem" | "video" })),
    ...novasFotosUrls,
  ];

  const sujo = editando
    ? titulo !== (imovel?.titulo ?? "") ||
      descricao !== (imovel?.descricao ?? "") ||
      preco !== (imovel?.preco?.toString() ?? "") ||
      localizacao !== (imovel?.localizacao ?? "") ||
      status !== (imovel?.status ?? "disponivel") ||
      quartos !== (imovel?.quartos?.toString() ?? "") ||
      banheiros !== (imovel?.banheiros?.toString() ?? "") ||
      vagas !== (imovel?.vagas?.toString() ?? "") ||
      areaM2 !== (imovel?.area_m2?.toString() ?? "")
    : titulo !== "" ||
      descricao !== "" ||
      preco !== "" ||
      localizacao !== "" ||
      arquivos.length > 0;

  function handleArquivosChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const selecionados = Array.from(files);
    const vagas = MAX_ARQUIVOS - arquivos.length;
    const aAdicionar = selecionados.slice(0, Math.max(0, vagas));

    if (selecionados.length > aAdicionar.length) {
      setErro(
        `Limite de ${MAX_ARQUIVOS} fotos/vídeos por imóvel. ${
          aAdicionar.length > 0
            ? `Adicionando só os primeiros ${aAdicionar.length}.`
            : "Remova algum arquivo antes de adicionar mais."
        }`,
      );
    } else {
      setErro(null);
    }

    setArquivos((prev) => [...prev, ...aAdicionar]);
    e.target.value = "";
  }

  function removerArquivo(index: number) {
    setArquivos((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCepChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCep(formatarCep(e.target.value));
    setErroCep(null);
  }

  async function handleCepBlur() {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;

    setBuscandoCep(true);
    setErroCep(null);
    setCoordenadas(null);
    try {
      const endereco = await buscarEnderecoPorCep(digits);
      if (!endereco) {
        setErroCep("CEP não encontrado. Preencha a localização manualmente.");
        return;
      }
      setLocalizacao(formatarLocalizacaoDoEndereco(endereco));

      // Não bloqueia a liberação do campo CEP: a geocodificação roda à
      // parte, só pra mostrar a coordenada assim que chegar.
      setBuscandoCoordenadas(true);
      geocodificarEndereco(endereco)
        .then(setCoordenadas)
        .finally(() => setBuscandoCoordenadas(false));
    } catch {
      setErroCep("Não foi possível buscar o CEP agora. Preencha manualmente.");
    } finally {
      setBuscandoCep(false);
    }
  }

  function montarPayload() {
    const tituloFinal = titulo.trim() || derivarTitulo(descricao);
    return {
      titulo: tituloFinal,
      descricao: descricao.trim() || null,
      preco: preco ? Number(preco) : null,
      localizacao: localizacao.trim() || null,
      status,
      data_venda: status === "ocupada" && dataVenda ? dataVenda : null,
      corretor_id: corretorId,
      quartos: quartos ? Number(quartos) : null,
      banheiros: banheiros ? Number(banheiros) : null,
      vagas: vagas ? Number(vagas) : null,
      area_m2: areaM2 ? Number(areaM2) : null,
    };
  }

  async function salvarOffline(payload: ReturnType<typeof montarPayload>) {
    setEtapa("Salvando para enviar depois...");
    const arquivosPendentes = arquivos.map((arquivo) => ({
      nome: arquivo.name,
      tipo: arquivo.type,
      blob: arquivo as Blob,
    }));

    await adicionarImovelPendente(
      { ...payload, slug: gerarSlug(payload.titulo) },
      arquivosPendentes,
      idIdempotenciaRef.current,
    );

    setEtapa(null);
    setSalvando(false);
    setOfflineQueued(true);
  }

  async function criarNovoImovel(payload: ReturnType<typeof montarPayload>) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await salvarOffline(payload);
      return;
    }

    const supabase = createClient();
    try {
      setEtapa("Enviando...");
      // upsert com id gerado no cliente: se essa mesma tentativa for
      // reenviada (retry manual, ou fallback pra fila offline por causa de
      // uma resposta perdida por rede instável), cai sempre na mesma linha
      // — nunca cria um segundo imóvel.
      const { data, error } = await supabase
        .from("imoveis")
        .upsert(
          {
            id: idIdempotenciaRef.current,
            ...payload,
            slug: gerarSlug(payload.titulo),
          },
          { onConflict: "id" },
        )
        .select()
        .single();

      if (error || !data) {
        throw error ?? new Error("Erro ao salvar.");
      }

      if (arquivos.length > 0) {
        setEtapa("Enviando fotos e vídeos...");
        let ordem = 0;
        for (const arquivo of arquivos) {
          try {
            await uploadMidiaParaImovel(
              supabase,
              data.id,
              arquivo,
              arquivo.name,
              ordem,
            );
            ordem += 1;
          } catch (erroMidia) {
            console.error("Falha ao enviar mídia:", erroMidia);
          }
        }
      }

      setSalvando(false);
      setEtapa(null);
      router.push(`/dashboard/imoveis/${data.id}`);
    } catch (erroCriacao) {
      if (pareceErroDeRede(erroCriacao)) {
        await salvarOffline(payload);
        return;
      }
      setSalvando(false);
      setEtapa(null);
      setErro(
        erroCriacao instanceof Error ? erroCriacao.message : "Erro ao salvar.",
      );
    }
  }

  async function salvarEdicaoOffline(payload: ReturnType<typeof montarPayload>) {
    setEtapa("Salvando para enviar depois...");
    await adicionarEdicaoPendente(imovel!.id, payload);
    setEtapa(null);
    setSalvando(false);
    setOfflineQueued(true);
  }

  async function editarImovelExistente(payload: ReturnType<typeof montarPayload>) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await salvarEdicaoOffline(payload);
      return;
    }

    const supabase = createClient();
    try {
      setEtapa("Salvando...");
      const { error } = await supabase
        .from("imoveis")
        .update(payload)
        .eq("id", imovel!.id);

      if (error) throw error;

      setSalvando(false);
      setEtapa(null);
      router.refresh();
    } catch (erroEdicao) {
      if (pareceErroDeRede(erroEdicao)) {
        await salvarEdicaoOffline(payload);
        return;
      }
      setSalvando(false);
      setEtapa(null);
      setErro(
        erroEdicao instanceof Error ? erroEdicao.message : "Erro ao salvar.",
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (enviandoRef.current) return;

    const payload = montarPayload();
    if (!payload.titulo) {
      setErro("Descreva a casa para continuar.");
      return;
    }

    enviandoRef.current = true;
    setSalvando(true);

    try {
      if (editando) {
        await editarImovelExistente(payload);
        return;
      }

      await criarNovoImovel(payload);
    } finally {
      enviandoRef.current = false;
    }
  }

  function cadastrarOutro() {
    setTitulo("");
    setDescricao("");
    setPreco("");
    setLocalizacao("");
    setStatus("disponivel");
    setDataVenda("");
    setArquivos([]);
    setOfflineQueued(false);
    setErro(null);
  }

  if (offlineQueued) {
    return (
      <div className="max-w-xl space-y-4">
        <OfflineBanner mensagem={MENSAGEM_OFFLINE} />
        {editando ? (
          <Link
            href="/dashboard"
            className="inline-block rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Voltar para o painel
          </Link>
        ) : (
          <button
            type="button"
            onClick={cadastrarOutro}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Cadastrar outro imóvel
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      <BotaoVoltar
        confirmar={
          sujo
            ? "Você tem alterações não salvas. Sair sem salvar?"
            : undefined
        }
      />

      <div>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Nome da casa"
          className="w-full border-0 border-b border-neutral-200 bg-transparent px-1 py-1 text-base text-neutral-500 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:placeholder:text-neutral-600"
        />
      </div>

      <div>
        <label className="mb-2 block text-base font-semibold">
          Descrição da casa
        </label>
        <textarea
          required
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={8}
          placeholder="Conte como é a casa: quantos quartos, bairro, diferenciais..."
          className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-base leading-relaxed dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <StatusToggle
        status={status}
        onChange={(novoStatus) => setStatus(novoStatus)}
      />

      {!editando && (
        <div>
          <label
            htmlFor="arquivos-imovel"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center transition hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600"
          >
            <span className="text-2xl">📷</span>
            <span className="text-lg font-semibold">
              Adicionar Fotos e Vídeos
            </span>
            <span className="text-sm text-neutral-500">
              Até {MAX_ARQUIVOS} arquivos · {arquivos.length}/{MAX_ARQUIVOS}{" "}
              selecionados
            </span>
          </label>
          <input
            id="arquivos-imovel"
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4"
            multiple
            onChange={handleArquivosChange}
            disabled={arquivos.length >= MAX_ARQUIVOS}
            className="hidden"
          />

          {arquivos.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
              {arquivos.map((arquivo, index) => (
                <li
                  key={`${arquivo.name}-${index}`}
                  className="flex items-center justify-between"
                >
                  <span className="truncate">{arquivo.name}</span>
                  <button
                    type="button"
                    onClick={() => removerArquivo(index)}
                    className="ml-2 text-red-600 hover:underline"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setMostrarAvancado((v) => !v)}
          className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          {mostrarAvancado ? "- Menos opções" : "+ Mais opções"}
        </button>
      </div>

      {mostrarAvancado && (
        <div className="space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Preço (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">CEP</label>
              <input
                value={cep}
                onChange={handleCepChange}
                onBlur={handleCepBlur}
                inputMode="numeric"
                placeholder="00000-000"
                className="w-full rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Quartos
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={quartos}
                onChange={(e) => setQuartos(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Banheiros
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={banheiros}
                onChange={(e) => setBanheiros(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Vagas
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={vagas}
                onChange={(e) => setVagas(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Área (m²)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={areaM2}
                onChange={(e) => setAreaM2(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Localização
              {buscandoCep && (
                <span className="ml-2 text-xs font-normal text-neutral-500">
                  Buscando endereço...
                </span>
              )}
            </label>
            <input
              value={localizacao}
              onChange={(e) => {
                setLocalizacao(e.target.value);
                setCoordenadas(null);
              }}
              placeholder="Bairro, Cidade - UF"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Preenchido automaticamente pelo CEP (só bairro e cidade, sem rua/número —
              você pode editar livremente).
            </p>
            {erroCep && <p className="mt-1 text-xs text-red-600">{erroCep}</p>}
            {buscandoCoordenadas && (
              <p className="mt-1 text-xs text-neutral-500">Buscando coordenadas...</p>
            )}
            {coordenadas && (
              <p className="mt-1 text-xs text-neutral-500">
                📍{" "}
                <a
                  href={linkGoogleMaps(coordenadas)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-neutral-800 dark:hover:text-neutral-200"
                >
                  {coordenadas.lat.toFixed(5)}, {coordenadas.lon.toFixed(5)} — Ver no mapa
                </a>
              </p>
            )}
          </div>

          {status === "ocupada" && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Data da venda
              </label>
              <input
                type="date"
                value={dataVenda ?? ""}
                onChange={(e) => setDataVenda(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
          )}

          {isAdmin && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Corretor responsável
              </label>
              <select
                value={corretorId}
                onChange={(e) => setCorretorId(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
              >
                {corretores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMostrarPreview(true)}
          className="rounded-lg border border-neutral-300 px-4 py-4 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
        >
          👁️ Preview
        </button>
        <button
          type="submit"
          disabled={salvando}
          className="flex-1 rounded-lg bg-neutral-900 px-4 py-4 text-lg font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {salvando
            ? (etapa ?? "Salvando...")
            : editando
              ? "Salvar alterações"
              : "Publicar imóvel"}
        </button>
      </div>

      {mostrarPreview && (
        <PropertyPreview
          titulo={titulo.trim() || derivarTitulo(descricao)}
          descricao={descricao}
          preco={preco}
          localizacao={localizacao}
          status={status}
          fotos={fotosPreview}
          onClose={() => setMostrarPreview(false)}
        />
      )}
    </form>
  );
}
