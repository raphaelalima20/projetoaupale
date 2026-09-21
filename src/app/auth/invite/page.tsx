"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { KeyRound, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/layout/Logo";
import Card from "@/components/ui/Card";
import PasswordInput from "@/components/ui/PasswordInput";
import Button from "@/components/ui/Button";

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteForm />
    </Suspense>
  );
}

function InviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [supabase] = useState(() => createClient());

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  /** Set the moment the password is successfully created server-side — the token is consumed
   * at that point, so once true we must never fall back to the "invalid/expired" screen again,
   * even if the automatic sign-in afterward fails. */
  const [accountReady, setAccountReady] = useState(false);
  const [autoLoginFailed, setAutoLoginFailed] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }
    fetch(`/api/auth/accept-invite?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((body) => {
        setValid(!!body.valid);
        setFullName(body.fullName ?? "");
      })
      .finally(() => setChecking(false));
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    let body: { success?: boolean; email?: string; error?: string };
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Não foi possível concluir o cadastro.");
        setLoading(false);
        return;
      }
    } catch {
      setError("Não foi possível concluir o cadastro. Verifique sua conexão e tente novamente.");
      setLoading(false);
      return;
    }

    // The password is now set and the invite token consumed server-side — from here on,
    // any failure must land on the success fallback below, never back on the expired-link screen.
    setAccountReady(true);

    if (!body.email) {
      setAutoLoginFailed(true);
      setLoading(false);
      return;
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: body.email,
        password,
      });

      if (signInError || !data.user) {
        setAutoLoginFailed(true);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profile?.role === "admin") {
        router.replace("/admin/dashboard");
      } else if (profile?.role === "collaborator") {
        router.replace("/colaboradora/minha-agenda");
      } else {
        setAutoLoginFailed(true);
        setLoading(false);
      }
    } catch {
      setAutoLoginFailed(true);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-fadeIn">
        <div className="mb-8 flex justify-center">
          <Logo size={64} />
        </div>

        <Card>
          <h1 className="mb-1 text-center font-display text-xl text-text">
            Criar sua senha
          </h1>
          <p className="mb-6 text-center text-sm text-textDim">
            {fullName ? `Bem-vinda, ${fullName.split(" ")[0]}! ` : ""}
            Defina uma senha para acessar o sistema
          </p>

          {accountReady && autoLoginFailed ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 size={28} className="text-success" />
              <p className="text-sm text-textDim">
                Senha criada com sucesso! Faça login em:
              </p>
              <Link href="/login" className="mt-2 w-full">
                <Button className="w-full">Ir para o login</Button>
              </Link>
            </div>
          ) : checking ? (
            <p className="py-4 text-center text-sm text-textDim">Verificando convite...</p>
          ) : !accountReady && (!token || !valid) ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <AlertCircle size={28} className="text-danger" />
              <p className="text-sm text-textDim">
                Este link de convite é inválido ou já foi utilizado. Solicite um novo
                convite à administradora.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <PasswordInput
                label="Nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
              <PasswordInput
                label="Confirmar senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" loading={loading} className="mt-2 w-full">
                <KeyRound size={16} />
                Salvar e entrar
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
