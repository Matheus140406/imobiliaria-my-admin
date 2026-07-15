import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase-db/types";
import { comprimirImagemSeNecessario } from "@/lib/imageCompression";

/**
 * Envia um único arquivo (imagem ou vídeo) para o bucket "imoveis-midia" e
 * cria o registro correspondente na tabela "midias". Usado tanto pelo
 * MediaManager (edição de imóvel existente) quanto pelo fluxo de
 * cadastro rápido / sincronização offline, para manter o mesmo caminho de
 * upload em todos os lugares.
 */
export async function uploadMidiaParaImovel(
  supabase: SupabaseClient<Database>,
  imovelId: string,
  arquivo: File | Blob,
  nomeArquivo: string,
  ordem: number,
): Promise<Tables<"midias">> {
  const tipoMime =
    arquivo instanceof File ? arquivo.type : (arquivo as Blob).type;
  const ehVideo = tipoMime.startsWith("video");
  const tipo = ehVideo ? "video" : "imagem";

  const arquivoFinal =
    !ehVideo && arquivo instanceof File
      ? await comprimirImagemSeNecessario(arquivo)
      : arquivo;

  const ext = nomeArquivo.split(".").pop() || "bin";
  const path = `${imovelId}/${crypto.randomUUID()}.${ext}`;

  const { data: signed, error: signedError } = await supabase.storage
    .from("imoveis-midia")
    .createSignedUploadUrl(path);

  if (signedError || !signed) {
    throw new Error(`Falha ao preparar upload de ${nomeArquivo}.`);
  }

  const { error: uploadError } = await supabase.storage
    .from("imoveis-midia")
    .uploadToSignedUrl(path, signed.token, arquivoFinal);

  if (uploadError) {
    throw new Error(`Falha ao enviar ${nomeArquivo}.`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("imoveis-midia").getPublicUrl(path);

  const { data: midia, error: insertError } = await supabase
    .from("midias")
    .insert({ imovel_id: imovelId, url: publicUrl, tipo, ordem })
    .select()
    .single();

  if (insertError || !midia) {
    throw new Error(`Falha ao salvar mídia ${nomeArquivo}.`);
  }

  return midia;
}
