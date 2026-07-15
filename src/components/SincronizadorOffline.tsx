"use client";

import { useCallback, useEffect, useState } from "react";
import {
  contarImoveisPendentes,
  contarEdicoesPendentes,
  contarMidiasPendentes,
  EVENTO_FILA_MUDOU,
} from "@/lib/offlineQueue";
import { sincronizarTudoPendente } from "@/lib/syncOffline";

// A Background Sync API não faz parte do lib.dom.ts padrão do TypeScript
// (não existe no Safari/iOS, então nem todo navegador a implementa).
type RegistrationComSync = ServiceWorkerRegistration & {
  sync?: { register(tag: string): Promise<void> };
};

/**
 * Componente "invisível" (só mostra um badge no header) responsável por:
 * 1. Registrar o service worker e, quando suportado, o Background Sync
 *    (otimização best-effort — não existe no Safari/iOS).
 * 2. Garantir a sincronização em QUALQUER navegador via listener de
 *    `online` + tentativa ao montar o dashboard. Esse é o mecanismo
 *    universal; o Background Sync só acelera a entrega quando disponível.
 */
export function SincronizadorOffline() {
  const [pendentes, setPendentes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);

  const atualizarContagem = useCallback(async () => {
    const [imoveis, edicoes, midias] = await Promise.all([
      contarImoveisPendentes(),
      contarEdicoesPendentes(),
      contarMidiasPendentes(),
    ]);
    setPendentes(imoveis + edicoes + midias);
  }, []);

  const sincronizar = useCallback(async () => {
    setSincronizando(true);
    try {
      await sincronizarTudoPendente();
    } finally {
      setSincronizando(false);
      await atualizarContagem();
    }
  }, [atualizarContagem]);

  useEffect(() => {
    // Carrega a contagem inicial da fila (IndexedDB) ao montar o dashboard.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    atualizarContagem();

    // Fallback universal: funciona em qualquer navegador, com ou sem
    // Background Sync (é o que garante a sincronização no Safari/iOS).
    window.addEventListener("online", sincronizar);
    // Reage a qualquer item novo na fila tentando sincronizar na hora (não só
    // recontando): cobre o caso de um item ser enfileirado enquanto o
    // dispositivo já está online (ex: heurística de rede com falso positivo),
    // que de outra forma só sincronizaria num futuro evento "online" que
    // nunca chega.
    window.addEventListener(EVENTO_FILA_MUDOU, sincronizar);

    // Já tenta sincronizar ao montar, caso o dashboard abra com sinal e
    // existam itens pendentes de uma sessão offline anterior.
    if (navigator.onLine) {
      sincronizar();
    }

    let registration: ServiceWorkerRegistration | undefined;

    function onMensagemServiceWorker(event: MessageEvent) {
      if (event.data?.type === "sync-imoveis-pendentes") {
        sincronizar();
      }
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "message",
        onMensagemServiceWorker,
      );

      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          registration = reg;
          // Background Sync é só uma otimização best-effort: não existe no
          // Safari/iOS, então nunca é a única via de sincronização.
          const regComSync = reg as RegistrationComSync;
          if ("SyncManager" in window && regComSync.sync) {
            regComSync.sync
              .register("sync-imoveis-pendentes")
              .catch(() => {
                /* best-effort: sem Background Sync, o listener de "online" cobre. */
              });
          }
        })
        .catch(() => {
          /* sem service worker, o listener de "online" ainda funciona. */
        });
    }

    return () => {
      window.removeEventListener("online", sincronizar);
      window.removeEventListener(EVENTO_FILA_MUDOU, sincronizar);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "message",
          onMensagemServiceWorker,
        );
      }
      void registration;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pendentes === 0) return null;

  return (
    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
      {sincronizando
        ? "Sincronizando..."
        : `${pendentes} publicação${pendentes > 1 ? "ões" : ""} pendente${
            pendentes > 1 ? "s" : ""
          } de sincronizar`}
    </span>
  );
}
