import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4 py-10">
      <p className="font-display text-sm font-medium text-ink-muted">Erro 403</p>
      <h1 className="font-display text-3xl font-bold">Acesso negado</h1>
      <p className="text-ink-muted">O seu perfil não tem permissão para ver esta página. A tentativa foi registada.</p>
      <Link href="/" className="font-semibold text-brand underline">
        Voltar ao início
      </Link>
    </main>
  );
}
