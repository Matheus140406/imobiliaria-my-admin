"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase-db/client";
import { uploadMidiaParaImovel } from "@/lib/uploadMidias";
import { pareceErroDeRede } from "@/lib/networkError";
import { adicionarMidiaPendente } from "@/lib/offlineQueue";
import type { Tables } from "@/lib/supabase-db/types";

const MAX_MIDIAS = 30;
const LIMITE_COMPRESSAO_BYTES = 5 * 1024 * 1024; // 5MB
const MENSAGEM_OFFLINE_CURTA =
  "Sem internet: isso vai ser enviado quando a conexão voltar.";

export function MediaManager({
  imovelId,
  midiasIniciais,
}: {
  imovelId: string;
  midiasIniciais: Tables<"midias">[];
}) {
  const [midias, setMidias] = useState(midiasIniciais);
  const [statusEnvio, setStatusEnvio] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [avisoOffline, setAvisoOffline] = useState<string | null>(null);

  async function enfileirarUpload(file: File, ordem: number) {
    await adicionarMidiaPendente({
      imovelId,
      acao: "adicionar",
      arquivo: { nome: file.name, tipo: file.type, blob: file, ordem },
    });
    setAvisoOffline(MENSAGEM_OFFLINE_CURTA);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const vagas = MAX_MIDIAS - midias.length;
    const selecionados = Array.from(files);
    const aEnviar = selecionados.slice(0, Math.max(0, vagas));

    if (selecionados.length > aEnviar.length) {
      setErro(
        `Limite de ${MAX_MIDIAS} fotos/vídeos por imóvel. ${
          aEnviar.length > 0
            ? `Enviando só os primeiros ${aEnviar.length}.`
            : "Remova alguma mídia antes de enviar mais."
        }`,
      );
    } else {
      setErro(null);
    }

    if (aEnviar.length === 0) {
      e.target.value = "";
      return;
    }

    const supabase = createClient();
    let ordem =
      midias.length > 0 ? Math.max(...midias.map((m) => m.ordem)) + 1 : 0;

    const temImagemGrande = aEnviar.some(
      (file) =>
        file.type.startsWith("image/") && file.size > LIMITE_COMPRESSAO_BYTES,
    );
    setStatusEnvio(temImagemGrande ? "Compactando fotos..." : "Enviando...");

    for (const file of aEnviar) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enfileirarUpload(file, ordem);
        ordem += 1;
        continue;
      }

      setStatusEnvio(
        file.type.startsWith("image/") && file.size > LIMITE_COMPRESSAO_BYTES
          ? "Compactando fotos..."
          : "Enviando...",
      );

      try {
        const midia = await uploadMidiaParaImovel(
          supabase,
          imovelId,
          file,
          file.name,
          ordem,
        );
        setMidias((prev) => [...prev, midia]);
        ordem += 1;
      } catch (erroUpload) {
        if (pareceErroDeRede(erroUpload)) {
          await enfileirarUpload(file, ordem);
          ordem += 1;
          continue;
        }
        setErro(
          erroUpload instanceof Error
            ? erroUpload.message
            : `Falha ao enviar ${file.name}.`,
        );
      }
    }

    setStatusEnvio(null);
    e.target.value = "";
  }

  async function handleRemover(midia: Tables<"midias">) {
    if (!confirm("Remover esta mídia?")) return;

    async function enfileirarRemocao() {
      await adicionarMidiaPendente({
        imovelId,
        acao: "remover",
        midia: { id: midia.id, url: midia.url },
      });
      setMidias((prev) => prev.filter((m) => m.id !== midia.id));
      setAvisoOffline(MENSAGEM_OFFLINE_CURTA);
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enfileirarRemocao();
      return;
    }

    const supabase = createClient();
    try {
      const path = midia.url.split("/imoveis-midia/")[1];
      if (path) {
        await supabase.storage.from("imoveis-midia").remove([path]);
      }
      const { error } = await supabase
        .from("midias")
        .delete()
        .eq("id", midia.id);
      if (error) throw error;
      setMidias((prev) => prev.filter((m) => m.id !== midia.id));
    } catch (erroRemocao) {
      if (pareceErroDeRede(erroRemocao)) {
        await enfileirarRemocao();
        return;
      }
      setErro(
        erroRemocao instanceof Error
          ? erroRemocao.message
          : "Falha ao remover mídia.",
      );
    }
  }

  return (
    <div className="mt-8 max-w-xl">
      <h2 className="mb-1 text-lg font-semibold">Fotos e vídeos</h2>
      <p className="mb-3 text-sm text-neutral-500">
        {midias.length}/{MAX_MIDIAS} mídias
      </p>

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4"
        multiple
        onChange={handleUpload}
        disabled={statusEnvio !== null || midias.length >= MAX_MIDIAS}
        className="mb-4 text-sm"
      />
      {statusEnvio && (
        <p className="text-sm text-neutral-500">{statusEnvio}</p>
      )}
      {avisoOffline && (
        <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
          📶 {avisoOffline}
        </p>
      )}
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {[...midias]
          .sort((a, b) => a.ordem - b.ordem)
          .map((midia) => (
            <div
              key={midia.id}
              className="relative aspect-square overflow-hidden rounded border border-neutral-200 dark:border-neutral-800"
            >
              {midia.tipo === "video" ? (
                <video src={midia.url} className="h-full w-full object-cover" />
              ) : (
                <Image src={midia.url} alt="" fill className="object-cover" />
              )}
              <button
                type="button"
                onClick={() => handleRemover(midia)}
                aria-label="Remover mídia"
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-base leading-none text-white shadow"
              >
                ×
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
