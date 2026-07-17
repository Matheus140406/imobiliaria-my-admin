"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-db/client";

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"senha" | "link">("link");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [linkEnviado, setLinkEnviado] = useState(false);

  async function handleSubmitSenha(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    setEnviando(false);

    if (error) {
      setErro("E-mail ou senha inválidos.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleSubmitLink(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Importante: sem isso, QUALQUER e-mail digitado aqui cria um novo
        // usuário no Supabase Auth (mesmo que não seja um corretor
        // cadastrado). Isso permitia gerar contas à toa e mandar e-mail
        // pra qualquer endereço só preenchendo esse campo. Só quem já tem
        // linha em "corretores" deve conseguir entrar.
        shouldCreateUser: false,
      },
    });

    setEnviando(false);

    if (error) {
      setErro("Não foi possível enviar o link. Confira o e-mail e tente de novo.");
      return;
    }

    setLinkEnviado(true);
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <div>
          <h1 className="text-xl font-semibold">Imobiliária M&amp;Y</h1>
          <p className="text-sm text-neutral-500">Painel administrativo</p>
        </div>

        {linkEnviado ? (
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            Enviamos um link de acesso para <strong>{email}</strong>. Abra o
            e-mail no celular ou computador e clique nele para entrar — não
            precisa de senha.
          </p>
        ) : modo === "link" ? (
          <form onSubmit={handleSubmitLink} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
            >
              {enviando ? "Enviando..." : "Enviar link de acesso"}
            </button>

            <button
              type="button"
              onClick={() => setModo("senha")}
              className="w-full text-center text-xs text-neutral-500 underline"
            >
              Entrar com senha em vez disso
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmitSenha} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Senha</label>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
            >
              {enviando ? "Entrando..." : "Entrar"}
            </button>

            <button
              type="button"
              onClick={() => setModo("link")}
              className="w-full text-center text-xs text-neutral-500 underline"
            >
              Entrar sem senha (link por e-mail)
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
