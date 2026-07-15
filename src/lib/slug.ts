export function gerarSlug(titulo: string) {
  const base = titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const sufixo = Math.random().toString(36).slice(2, 8);
  return `${base}-${sufixo}`;
}
