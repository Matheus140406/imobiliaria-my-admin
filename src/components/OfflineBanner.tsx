export function OfflineBanner({ mensagem }: { mensagem: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <span aria-hidden className="text-lg leading-none">
        📶
      </span>
      <p className="font-medium">{mensagem}</p>
    </div>
  );
}
