export const ROLES = [
  "GAE_ADMIN",
  "GAE_ANALISTA",
  "DELEGADO",
  "SUBDELEGADO",
  "SECRETARIO",
  "FENT_OBSERVER",
] as const;

export type Role = (typeof ROLES)[number];

export const GAE_ROLES: readonly Role[] = ["GAE_ADMIN", "GAE_ANALISTA"];
export const LIDERANCA_ROLES: readonly Role[] = ["DELEGADO", "SUBDELEGADO", "SECRETARIO"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isAllowed(role: Role, allowed: readonly Role[]): boolean {
  return allowed.includes(role);
}

/** Página inicial de cada perfil após o login. */
export function homeFor(role: Role): string {
  if (role === "FENT_OBSERVER") return "/insights";
  if (LIDERANCA_ROLES.includes(role)) return "/delegado";
  return "/gae";
}

export type NavItem = { label: string; href: string; ready: boolean };

/** Menu lateral por perfil. `ready: false` = rota ainda não construída. */
export function navFor(role: Role): NavItem[] {
  switch (role) {
    case "GAE_ADMIN":
      return [
        { label: "Painel", href: "/gae", ready: true },
        { label: "Estrutura", href: "/gae/estrutura", ready: true },
        { label: "Utilizadores", href: "/gae/utilizadores", ready: true },
        { label: "Ciclos", href: "/gae/ciclos", ready: true },
        { label: "Auditorias", href: "/gae/auditorias", ready: false },
        { label: "Relatórios", href: "/gae/relatorios", ready: false },
      ];
    case "GAE_ANALISTA":
      return [
        { label: "Painel", href: "/gae", ready: true },
        { label: "Ciclos", href: "/gae/ciclos", ready: true },
        { label: "Auditorias", href: "/gae/auditorias", ready: false },
        { label: "Relatórios", href: "/gae/relatorios", ready: false },
      ];
    case "FENT_OBSERVER":
      return [{ label: "Desafios", href: "/insights", ready: true }];
    default:
      return [
        { label: "Painel da turma", href: "/delegado", ready: true },
        { label: "Auditoria de sala", href: "/delegado/auditoria", ready: false },
      ];
  }
}
