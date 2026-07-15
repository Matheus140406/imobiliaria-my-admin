import Link from "next/link";
import { getCorretorAtual } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { SincronizadorOffline } from "@/components/SincronizadorOffline";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const corretor = await getCorretorAtual();

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
        <Link href="/dashboard" className="font-semibold">
          Imobiliária M&amp;Y
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <SincronizadorOffline />
          {corretor && (
            <span className="text-neutral-500">
              {corretor.nome} ({corretor.papel})
            </span>
          )}
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 p-6">
        {corretor ? (
          children
        ) : (
          <p className="text-sm text-red-600">
            Sua conta está autenticada, mas ainda não foi associada a um
            corretor. Peça para um administrador cadastrá-la em
            &quot;corretores&quot;.
          </p>
        )}
      </main>
    </div>
  );
}
