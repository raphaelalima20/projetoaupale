"use client";

import { useState, useEffect, Suspense, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, UserPlus, ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/layout/Logo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { useSalonSettings } from "@/components/layout/SalonSettingsProvider";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import Button from "@/components/ui/Button";

type Mode = "login" | "signup" | "reset";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());
  const { name: salonName } = useSalonSettings();
  const [mode, setMode] = useState<Mode>("login");
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Visitors can't read profiles; this RPC only answers "does an admin exist yet?".
    supabase.rpc("admin_exists").then(({ data, error: rpcError }) => {
      // On failure stay "unknown" (null) rather than offering first-access setup by mistake.
      if (!mounted || rpcError) return;
      const exists = data === true;
      setAdminExists(exists);

      if (searchParams.get("mode") === "signup") {
        if (exists) {
          router.replace("/login");
        } else {
          setMode("signup");
        }
      }
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // signup fields
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");

  // reset field
  const [resetEmail, setResetEmail] = useState("");

  function goToMode(next: Mode) {
    if (next === "signup" && adminExists) return;
    setError("");
    setResetSent(false);
    setMode(next);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError || !data.user) {
      setError("E-mail ou senha inválidos.");
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
      setError("Perfil sem permissão de acesso configurada.");
      setLoading(false);
    }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (signupPassword !== signupConfirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/signup-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: signupName,
        email: signupEmail,
        password: signupPassword,
      }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "Não foi possível criar a conta.");
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: signupEmail,
      password: signupPassword,
    });

    if (signInError) {
      setError("Conta criada. Faça login para continuar.");
      setLoading(false);
      goToMode("login");
      return;
    }

    router.replace("/admin/dashboard");
  }

  /**
   * Sends a recovery link to the e-mail. The link signs the admin in and lands on Configurações,
   * where the password can be changed. The response is the same whether or not the e-mail exists,
   * so this can't be used to discover accounts.
   */
  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/admin/configuracoes`,
    });

    setLoading(false);
    if (resetError && resetError.status === 429) {
      setError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      return;
    }
    setResetSent(true);
    setEmail(resetEmail.trim());
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm animate-fadeIn">
        <div className="mb-8 flex justify-center">
          <Logo size={112} />
        </div>

        <Card className="p-6">
          {mode === "login" && (
            <>
              <h1 className="mb-1 text-center font-display text-2xl tracking-[0.18em] text-text">
                {salonName.toUpperCase()}
              </h1>
              <p className="mb-6 text-center text-sm text-textDim">
                Entre com sua conta para continuar
              </p>

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <Input
                  label="E-mail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  required
                  autoFocus
                />
                <PasswordInput
                  label="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                {error && <p className="text-sm text-danger">{error}</p>}
                <Button type="submit" loading={loading} className="mt-2 w-full">
                  <LogIn size={16} />
                  Entrar
                </Button>
              </form>

              <div className="mt-6 flex flex-col items-center gap-2 text-sm">
                <button
                  onClick={() => goToMode("reset")}
                  className="text-textDim transition duration-200 hover:text-gold"
                >
                  Esqueci minha senha
                </button>
                {adminExists === false && (
                  <button
                    onClick={() => goToMode("signup")}
                    className="text-textDim/70 transition duration-200 hover:text-gold"
                  >
                    Primeiro acesso? Criar conta admin
                  </button>
                )}
              </div>
            </>
          )}

          {mode === "signup" && (
            <>
              <button
                onClick={() => goToMode("login")}
                className="mb-4 flex items-center gap-1.5 text-sm text-textDim hover:text-text"
              >
                <ArrowLeft size={15} /> Voltar
              </button>
              <h1 className="mb-1 text-center font-display text-xl text-text">Criar conta admin</h1>
              <p className="mb-6 text-center text-sm text-textDim">
                Disponível apenas para o primeiro acesso ao sistema
              </p>

              <form onSubmit={handleSignup} className="flex flex-col gap-4">
                <Input
                  label="Nome completo"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  required
                  autoFocus
                />
                <Input
                  label="E-mail"
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                />
                <PasswordInput
                  label="Senha"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <PasswordInput
                  label="Confirmar senha"
                  value={signupConfirm}
                  onChange={(e) => setSignupConfirm(e.target.value)}
                  required
                />
                {error && <p className="text-sm text-danger">{error}</p>}
                <Button type="submit" loading={loading} className="mt-2 w-full">
                  <UserPlus size={16} />
                  Criar conta
                </Button>
              </form>
            </>
          )}

          {mode === "reset" && (
            <>
              <button
                onClick={() => goToMode("login")}
                className="mb-4 flex items-center gap-1.5 text-sm text-textDim hover:text-text"
              >
                <ArrowLeft size={15} /> Voltar
              </button>
              <h1 className="mb-1 text-center font-display text-xl text-text">Recuperar senha</h1>

              {resetSent ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <CheckCircle2 size={28} className="text-success" />
                  <p className="text-sm text-textDim">
                    Se houver uma conta com este e-mail, enviamos um link para redefinir a senha.
                    Confira também o spam.
                  </p>
                  <Button onClick={() => goToMode("login")} className="mt-2 w-full">
                    Voltar ao login
                  </Button>
                </div>
              ) : (
                <>
                  <p className="mb-6 text-center text-sm text-textDim">
                    Informe seu e-mail e enviaremos um link de recuperação.
                  </p>
                  <form onSubmit={handleReset} className="flex flex-col gap-4">
                    <Input
                      label="E-mail"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      autoFocus
                    />
                    {error && <p className="text-sm text-danger">{error}</p>}
                    <Button type="submit" loading={loading} className="mt-2 w-full">
                      <Mail size={16} />
                      Enviar link
                    </Button>
                  </form>
                  <p className="mt-5 rounded-btn bg-surface2 p-3 text-xs leading-relaxed text-textDim">
                    <strong className="font-medium text-text">Colaboradora?</strong> Peça à
                    administradora um novo link de convite — por ele você cria uma nova senha.
                  </p>
                </>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
