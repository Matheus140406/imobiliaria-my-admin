"use client";

import Link from "next/link";

/**
 * Botão de "Voltar" explícito, que não depende do gesto/botão nativo do
 * navegador. Sempre navega para uma rota fixa dentro do painel (nunca para
 * fora do app nem desloga), e pede confirmação antes de descartar
 * alterações não salvas quando `confirmar` é passado.
 */
export function BotaoVoltar({
  href = "/dashboard",
  confirmar,
}: {
  href?: string;
  confirmar?: string;
}) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (confirmar && !window.confirm(confirmar)) {
      e.preventDefault();
    }
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
    >
      <span aria-hidden="true">←</span> Voltar
    </Link>
  );
}
