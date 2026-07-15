"use client";

import { createClient } from "@/lib/supabase-db/client";
import { gerarSlug } from "@/lib/slug";
import {
  listarImoveisPendentes,
  atualizarStatusPendente,
  removerImovelPendente,
  listarEdicoesPendentes,
  atualizarStatusEdicaoPendente,
  removerEdicaoPendente,
  listarMidiasPendentes,
  atualizarStatusMidiaPendente,
  removerMidiaPendente,
} from "@/lib/offlineQueue";
import { uploadMidiaParaImovel } from "@/lib/uploadMidias";

let sincronizacaoEmAndamento = false;

type ResultadoSync = { sincronizados: number; restantes: number };

/**
 * Percorre a fila de imóveis pendentes no IndexedDB e tenta enviar cada um
 * ao Supabase (imóvel + mídias). Itens enviados com sucesso são removidos
 * da fila; itens que falharem novamente permanecem para uma próxima
 * tentativa.
 */
export async function sincronizarImoveisPendentes(): Promise<ResultadoSync> {
  if (typeof window === "undefined" || !navigator.onLine) {
    const restantes = typeof window === "undefined"
      ? 0
      : (await listarImoveisPendentes()).length;
    return { sincronizados: 0, restantes };
  }

  let sincronizados = 0;
  const pendentes = await listarImoveisPendentes();

  for (const item of pendentes) {
    try {
      await atualizarStatusPendente(item.id, "enviando");
      const supabase = createClient();

      const slug = item.payload.slug || gerarSlug(item.payload.titulo);
      const { data: imovel, error } = await supabase
        .from("imoveis")
        .insert({ ...item.payload, slug })
        .select()
        .single();

      if (error || !imovel) {
        throw error ?? new Error("Falha ao criar imóvel a partir da fila.");
      }

      let ordem = 0;
      for (const arquivo of item.arquivos) {
        await uploadMidiaParaImovel(
          supabase,
          imovel.id,
          arquivo.blob,
          arquivo.nome,
          ordem,
        );
        ordem += 1;
      }

      await removerImovelPendente(item.id);
      sincronizados += 1;
    } catch (erro) {
      console.error("Erro ao sincronizar imóvel pendente", item.id, erro);
      await atualizarStatusPendente(item.id, "erro");
    }
  }

  const restantes = (await listarImoveisPendentes()).length;
  return { sincronizados, restantes };
}

/**
 * Percorre a fila de edições pendentes (imóveis já existentes alterados
 * enquanto offline) e aplica cada alteração no Supabase.
 */
export async function sincronizarEdicoesPendentes(): Promise<ResultadoSync> {
  if (typeof window === "undefined" || !navigator.onLine) {
    const restantes = typeof window === "undefined"
      ? 0
      : (await listarEdicoesPendentes()).length;
    return { sincronizados: 0, restantes };
  }

  let sincronizados = 0;
  const pendentes = await listarEdicoesPendentes();

  for (const item of pendentes) {
    try {
      await atualizarStatusEdicaoPendente(item.id, "enviando");
      const supabase = createClient();

      const { error } = await supabase
        .from("imoveis")
        .update(item.payload)
        .eq("id", item.imovelId);

      if (error) throw error;

      await removerEdicaoPendente(item.id);
      sincronizados += 1;
    } catch (erro) {
      console.error("Erro ao sincronizar edição pendente", item.id, erro);
      await atualizarStatusEdicaoPendente(item.id, "erro");
    }
  }

  const restantes = (await listarEdicoesPendentes()).length;
  return { sincronizados, restantes };
}

/**
 * Percorre a fila de alterações de mídia pendentes (fotos/vídeos
 * adicionados ou removidos enquanto offline) e refaz cada operação no
 * Supabase.
 */
export async function sincronizarMidiasPendentes(): Promise<ResultadoSync> {
  if (typeof window === "undefined" || !navigator.onLine) {
    const restantes = typeof window === "undefined"
      ? 0
      : (await listarMidiasPendentes()).length;
    return { sincronizados: 0, restantes };
  }

  let sincronizados = 0;
  const pendentes = await listarMidiasPendentes();

  for (const item of pendentes) {
    try {
      await atualizarStatusMidiaPendente(item.id, "enviando");
      const supabase = createClient();

      if (item.acao === "adicionar" && item.arquivo) {
        await uploadMidiaParaImovel(
          supabase,
          item.imovelId,
          item.arquivo.blob,
          item.arquivo.nome,
          item.arquivo.ordem,
        );
      } else if (item.acao === "remover" && item.midia) {
        const path = item.midia.url.split("/imoveis-midia/")[1];
        if (path) {
          await supabase.storage.from("imoveis-midia").remove([path]);
        }
        const { error } = await supabase
          .from("midias")
          .delete()
          .eq("id", item.midia.id);
        if (error) throw error;
      }

      await removerMidiaPendente(item.id);
      sincronizados += 1;
    } catch (erro) {
      console.error("Erro ao sincronizar mídia pendente", item.id, erro);
      await atualizarStatusMidiaPendente(item.id, "erro");
    }
  }

  const restantes = (await listarMidiasPendentes()).length;
  return { sincronizados, restantes };
}

/**
 * Sincroniza todas as filas pendentes (criação de imóvel, edição e mídia).
 * Chamado tanto pelo listener de `online` (funciona em qualquer navegador)
 * quanto, quando disponível, pelo Background Sync do service worker.
 */
export async function sincronizarTudoPendente(): Promise<ResultadoSync> {
  if (typeof window === "undefined") {
    return { sincronizados: 0, restantes: 0 };
  }

  if (!navigator.onLine) {
    const restantes =
      (await listarImoveisPendentes()).length +
      (await listarEdicoesPendentes()).length +
      (await listarMidiasPendentes()).length;
    return { sincronizados: 0, restantes };
  }

  // Evita duas sincronizações concorrentes (ex: evento "online" disparando
  // ao mesmo tempo que o Background Sync do service worker).
  if (sincronizacaoEmAndamento) {
    const restantes =
      (await listarImoveisPendentes()).length +
      (await listarEdicoesPendentes()).length +
      (await listarMidiasPendentes()).length;
    return { sincronizados: 0, restantes };
  }
  sincronizacaoEmAndamento = true;

  try {
    const [imoveis, edicoes, midias] = await Promise.all([
      sincronizarImoveisPendentes(),
      sincronizarEdicoesPendentes(),
      sincronizarMidiasPendentes(),
    ]);

    return {
      sincronizados:
        imoveis.sincronizados + edicoes.sincronizados + midias.sincronizados,
      restantes: imoveis.restantes + edicoes.restantes + midias.restantes,
    };
  } finally {
    sincronizacaoEmAndamento = false;
  }
}
