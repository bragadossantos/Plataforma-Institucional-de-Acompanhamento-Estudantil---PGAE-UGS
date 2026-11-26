import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { Emblema } from "@/components/logo";
import type { SessionUser } from "@/lib/auth";
import { navFor, type Role } from "@/lib/rbac";

const ROLE_LABEL: Record<Role, string> = {
  GAE_ADMIN: "Administrador GAE",
  GAE_ANALISTA: "Analista GAE",
  DELEGADO: "Delegado",
  SUBDELEGADO: "Subdelegado",
  SECRETARIO: "Secretário",
  FENT_OBSERVER: "Observador",
};

export function AppShell({
  user,
  current,
  title,
  children,
}: {
  user: SessionUser;
  current: string;
  title: string;
  children: React.ReactNode;
}) {
  const items = navFor(user.role);
  return (
    <div className="min-h-screen md:flex">
      <aside className="flex flex-col bg-ink-2 text-white md:w-60 md:shrink-0">
        <div className="flex items-center gap-3 px-5 py-5">
          <Emblema tamanho={44} priority />
          <div>
            <p className="font-display text-2xl font-bold leading-none">PGAE</p>
            <p className="mt-1 text-xs text-white/60">UGS · GAE</p>
          </div>
        </div>
        <nav aria-label="Principal" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:pb-0">
          {items.map((item) =>
            item.ready ? (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.href === current ? "page" : undefined}
                className={`flex min-h-11 shrink-0 items-center rounded-control px-3 text-sm font-semibold ${
                  item.href === current ? "bg-brand text-white" : "text-white/80 hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.href}
                title="Disponível numa fase seguinte"
                className="flex min-h-11 shrink-0 cursor-not-allowed items-center rounded-control px-3 text-sm text-white/40"
              >
                {item.label}
              </span>
            ),
          )}
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-sm">
          <p className="font-semibold">{user.nome}</p>
          <p className="text-white/60">{ROLE_LABEL[user.role]}</p>
          <form action={logoutAction} className="mt-3">
            <button className="min-h-11 w-full rounded-control border border-white/25 px-3 text-sm font-semibold hover:bg-white/10">
              Sair
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-8">
        <h1 className="mb-6 font-display text-3xl font-bold">{title}</h1>
        {children}
      </main>
    </div>
  );
}
