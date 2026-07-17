"use client";

/**
 * Filas locais (IndexedDB) de operações feitas enquanto o dispositivo está
 * sem internet: criação de imóvel, edição de imóvel e alterações de mídia
 * (adicionar/remover foto ou vídeo). Cada fila guarda o necessário para
 * refazer a operação no Supabase assim que a conexão voltar. Ver
 * `src/lib/syncOffline.ts` para a sincronização.
 */

const DB_NAME = "imobiliaria-admin";
const DB_VERSION = 2;
const STORE_IMOVEIS = "imoveis-pendentes";
const STORE_EDICOES = "edicoes-pendentes";
const STORE_MIDIAS = "midias-pendentes";
export const EVENTO_FILA_MUDOU = "imoveis-pendentes:mudou";

export type ImovelPendentePayload = {
  titulo: string;
  descricao: string | null;
  preco: number | null;
  localizacao: string | null;
  status: string;
  data_venda: string | null;
  corretor_id: string;
  slug: string;
};

export type ArquivoPendente = {
  nome: string;
  tipo: string;
  blob: Blob;
};

export type ImovelPendente = {
  id: string;
  payload: ImovelPendentePayload;
  arquivos: ArquivoPendente[];
  criadoEm: number;
  status: "pendente" | "enviando" | "erro";
};

export type EdicaoPendentePayload = {
  titulo: string;
  descricao: string | null;
  preco: number | null;
  localizacao: string | null;
  status: string;
  data_venda: string | null;
  corretor_id: string;
};

export type EdicaoPendente = {
  id: string;
  imovelId: string;
  payload: EdicaoPendentePayload;
  criadoEm: number;
  status: "pendente" | "enviando" | "erro";
};

export type MidiaPendenteRemover = {
  id: string;
  url: string;
};

export type MidiaPendente = {
  id: string;
  imovelId: string;
  acao: "adicionar" | "remover";
  // presente quando acao === "adicionar"
  arquivo?: ArquivoPendente & { ordem: number };
  // presente quando acao === "remover"
  midia?: MidiaPendenteRemover;
  criadoEm: number;
  status: "pendente" | "enviando" | "erro";
};

function bancoDisponivel(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_IMOVEIS)) {
        db.createObjectStore(STORE_IMOVEIS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_EDICOES)) {
        db.createObjectStore(STORE_EDICOES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_MIDIAS)) {
        db.createObjectStore(STORE_MIDIAS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function notificarMudancaFila() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENTO_FILA_MUDOU));
  }
}

// ---------------------------------------------------------------------------
// Criação de imóvel
// ---------------------------------------------------------------------------

export async function adicionarImovelPendente(
  payload: ImovelPendentePayload,
  arquivos: ArquivoPendente[],
  idIdempotencia?: string,
): Promise<ImovelPendente> {
  const db = await abrirBanco();
  const registro: ImovelPendente = {
    // Importante: se o formulário já gerou um id de idempotência (caso de
    // fallback após uma tentativa online que falhou só na resposta), reusa
    // o MESMO id aqui. Isso garante que, quando essa fila for sincronizada,
    // o upsert caia na mesma linha em vez de criar um imóvel duplicado.
    id: idIdempotencia ?? crypto.randomUUID(),
    payload,
    arquivos,
    criadoEm: Date.now(),
    status: "pendente",
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_IMOVEIS, "readwrite");
    tx.objectStore(STORE_IMOVEIS).put(registro);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  notificarMudancaFila();
  return registro;
}

export async function listarImoveisPendentes(): Promise<ImovelPendente[]> {
  if (!bancoDisponivel()) return [];
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMOVEIS, "readonly");
    const req = tx.objectStore(STORE_IMOVEIS).getAll();
    req.onsuccess = () => resolve((req.result as ImovelPendente[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function contarImoveisPendentes(): Promise<number> {
  if (!bancoDisponivel()) return 0;
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMOVEIS, "readonly");
    const req = tx.objectStore(STORE_IMOVEIS).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function atualizarStatusPendente(
  id: string,
  status: ImovelPendente["status"],
): Promise<void> {
  const db = await abrirBanco();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_IMOVEIS, "readwrite");
    const store = tx.objectStore(STORE_IMOVEIS);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result as ImovelPendente | undefined;
      if (item) {
        item.status = status;
        store.put(item);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notificarMudancaFila();
}

export async function removerImovelPendente(id: string): Promise<void> {
  const db = await abrirBanco();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_IMOVEIS, "readwrite");
    tx.objectStore(STORE_IMOVEIS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notificarMudancaFila();
}

// ---------------------------------------------------------------------------
// Edição de imóvel existente
// ---------------------------------------------------------------------------

export async function adicionarEdicaoPendente(
  imovelId: string,
  payload: EdicaoPendentePayload,
): Promise<EdicaoPendente> {
  const db = await abrirBanco();
  const registro: EdicaoPendente = {
    id: crypto.randomUUID(),
    imovelId,
    payload,
    criadoEm: Date.now(),
    status: "pendente",
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_EDICOES, "readwrite");
    tx.objectStore(STORE_EDICOES).put(registro);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  notificarMudancaFila();
  return registro;
}

export async function listarEdicoesPendentes(): Promise<EdicaoPendente[]> {
  if (!bancoDisponivel()) return [];
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EDICOES, "readonly");
    const req = tx.objectStore(STORE_EDICOES).getAll();
    req.onsuccess = () => resolve((req.result as EdicaoPendente[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function contarEdicoesPendentes(): Promise<number> {
  if (!bancoDisponivel()) return 0;
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EDICOES, "readonly");
    const req = tx.objectStore(STORE_EDICOES).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function atualizarStatusEdicaoPendente(
  id: string,
  status: EdicaoPendente["status"],
): Promise<void> {
  const db = await abrirBanco();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_EDICOES, "readwrite");
    const store = tx.objectStore(STORE_EDICOES);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result as EdicaoPendente | undefined;
      if (item) {
        item.status = status;
        store.put(item);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notificarMudancaFila();
}

export async function removerEdicaoPendente(id: string): Promise<void> {
  const db = await abrirBanco();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_EDICOES, "readwrite");
    tx.objectStore(STORE_EDICOES).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notificarMudancaFila();
}

// ---------------------------------------------------------------------------
// Mídias (adicionar/remover foto ou vídeo de um imóvel existente)
// ---------------------------------------------------------------------------

export async function adicionarMidiaPendente(
  item: Omit<MidiaPendente, "id" | "criadoEm" | "status">,
): Promise<MidiaPendente> {
  const db = await abrirBanco();
  const registro: MidiaPendente = {
    ...item,
    id: crypto.randomUUID(),
    criadoEm: Date.now(),
    status: "pendente",
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_MIDIAS, "readwrite");
    tx.objectStore(STORE_MIDIAS).put(registro);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  notificarMudancaFila();
  return registro;
}

export async function listarMidiasPendentes(): Promise<MidiaPendente[]> {
  if (!bancoDisponivel()) return [];
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MIDIAS, "readonly");
    const req = tx.objectStore(STORE_MIDIAS).getAll();
    req.onsuccess = () => resolve((req.result as MidiaPendente[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function contarMidiasPendentes(): Promise<number> {
  if (!bancoDisponivel()) return 0;
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MIDIAS, "readonly");
    const req = tx.objectStore(STORE_MIDIAS).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function atualizarStatusMidiaPendente(
  id: string,
  status: MidiaPendente["status"],
): Promise<void> {
  const db = await abrirBanco();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_MIDIAS, "readwrite");
    const store = tx.objectStore(STORE_MIDIAS);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result as MidiaPendente | undefined;
      if (item) {
        item.status = status;
        store.put(item);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notificarMudancaFila();
}

export async function removerMidiaPendente(id: string): Promise<void> {
  const db = await abrirBanco();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_MIDIAS, "readwrite");
    tx.objectStore(STORE_MIDIAS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notificarMudancaFila();
}
