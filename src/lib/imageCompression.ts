const LIMITE_PARA_COMPRIMIR_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Comprime uma imagem no navegador se ela for maior que 5MB.
 * Reduz para no máximo ~1920px no maior lado, mantendo o formato original.
 * Vídeos e imagens já pequenas passam direto, sem alteração.
 */
export async function comprimirImagemSeNecessario(file: File): Promise<File> {
  const ehImagem = file.type.startsWith("image/");
  if (!ehImagem || file.size <= LIMITE_PARA_COMPRIMIR_BYTES) {
    return file;
  }

  try {
    const imageCompression = (await import("browser-image-compression"))
      .default;
    const comprimido = await imageCompression(file, {
      maxSizeMB: 2,
      maxWidthOrHeight: 1920,
      initialQuality: 0.8,
      useWebWorker: true,
      fileType: file.type,
    });

    // browser-image-compression retorna um Blob; reconstituímos um File
    // preservando o nome original e o tipo MIME.
    return new File([comprimido], file.name, {
      type: comprimido.type || file.type,
      lastModified: Date.now(),
    });
  } catch (erro) {
    console.error("Falha ao comprimir imagem, enviando original:", erro);
    return file;
  }
}
