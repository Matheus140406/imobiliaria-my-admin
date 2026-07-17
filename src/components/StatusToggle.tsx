export function StatusToggle({
  status,
  onChange,
}: {
  status: string;
  onChange: (novoStatus: "disponivel" | "ocupada") => void;
}) {
  const disponivel = status === "disponivel";

  return (
    <div>
      <span className="mb-2 block text-sm font-medium">Situação do imóvel</span>
      <button
        type="button"
        role="switch"
        aria-checked={disponivel}
        onClick={() => onChange(disponivel ? "ocupada" : "disponivel")}
        className={`relative flex h-16 w-full items-center rounded-full px-2 transition-colors ${
          disponivel
            ? "bg-green-500 dark:bg-green-600"
            : "bg-neutral-400 dark:bg-neutral-600"
        }`}
      >
        <span
          className={`absolute top-1 flex h-14 w-1/2 items-center justify-center rounded-full bg-white text-sm font-semibold text-neutral-900 shadow transition-transform ${
            disponivel ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {disponivel ? "Disponível" : "Indisponível"}
        </span>
        <span className="flex-1 text-center text-sm font-semibold text-white">
          Disponível
        </span>
        <span className="flex-1 text-center text-sm font-semibold text-white">
          Indisponível
        </span>
      </button>
    </div>
  );
}
