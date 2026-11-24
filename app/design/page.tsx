import type { Metadata } from "next";

export const metadata: Metadata = { title: "Catálogo visual · PGAE" };

const colors = [
  ["--bg", "#F4F2EC", "Fundo"],
  ["--surface", "#FBFAF6", "Cartões"],
  ["--border", "#DCD8CC", "Contornos"],
  ["--ink", "#10162B", "Texto"],
  ["--ink-2", "#1A2240", "Barra lateral"],
  ["--brand", "#004AAD", "Azul institucional"],
  ["--accent", "#C2410C", "Ação principal"],
  ["--accent-on-dark", "#FF6B35", "Ação em fundo escuro"],
  ["--ok", "#15803D", "Destaque / Resolvido"],
  ["--warn", "#B45309", "Atenção"],
  ["--crit", "#B91C1C", "Crítico"],
] as const;

const nav = ["Painel", "Estrutura", "Utilizadores", "Ciclos", "Auditorias", "Relatórios"];

const rows = [
  { nome: "Docente exemplo A", turma: "EI-3A", idd: "4.35", n: 28, estado: "Destaque" },
  { nome: "Docente exemplo B", turma: "EI-3B", idd: "3.62", n: 31, estado: "Estável" },
  { nome: "Docente exemplo C", turma: "EI-2A", idd: "2.81", n: 24, estado: "Alerta" },
  { nome: "Docente exemplo D", turma: "EI-1C", idd: "—", n: 3, estado: "Amostra" },
];

function Badge({ kind, children }: { kind: "ok" | "warn" | "crit"; children: React.ReactNode }) {
  const cls = {
    ok: "bg-ok-bg text-ok",
    warn: "bg-warn-bg text-warn",
    crit: "bg-crit-bg text-crit",
  }[kind];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-4xl font-bold leading-none">{value}</p>
      <p className="mt-2 text-sm text-ink-muted">{hint}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 font-display text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignCatalog() {
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-ink-2 text-white md:w-60 md:shrink-0">
        <div className="px-5 py-5">
          <p className="font-display text-2xl font-bold">PGAE</p>
          <p className="text-xs text-white/60">UGS · GAE</p>
        </div>
        <nav aria-label="Principal" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {nav.map((item, i) => (
            <span
              key={item}
              aria-current={i === 0 ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center rounded-control px-3 text-sm font-semibold ${
                i === 0 ? "bg-brand text-white" : "text-white/75"
              }`}
            >
              {item}
            </span>
          ))}
        </nav>
      </aside>

      <main className="flex-1 px-4 py-6 md:px-8">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Catálogo visual</h1>
            <p className="text-ink-muted">Design system da PGAE · proposta em docs/PROPOSTA-VISUAL.md</p>
          </div>
          <button className="min-h-11 rounded-control bg-accent px-4 font-semibold text-white">
            Exportar Relatório para a Direção (PDF)
          </button>
        </header>

        <Section title="Cor">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {colors.map(([token, hex, uso]) => (
              <div key={token} className="overflow-hidden rounded-card border border-border bg-surface">
                <div className="h-14" style={{ background: hex }} />
                <div className="p-3">
                  <p className="font-mono text-xs font-medium">{token}</p>
                  <p className="font-mono text-xs text-ink-muted">{hex}</p>
                  <p className="text-sm">{uso}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tipografia">
          <div className="rounded-card border border-border bg-surface p-5">
            <p className="font-display text-4xl font-bold">Space Grotesk 700 · KPIs e títulos</p>
            <p className="mt-3 text-base">IBM Plex Sans 400 — texto de leitura, formulários e tabelas.</p>
            <p className="font-semibold">IBM Plex Sans 600 — ênfase e rótulos.</p>
            <p className="mt-3 font-mono text-sm font-medium">EI3A-7K9P · 2026-S2 · IBM Plex Mono 500</p>
          </div>
        </Section>

        <Section title="KPIs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Taxa de adesão global" value="68 %" hint="Votos únicos / alunos estimados" />
            <Kpi label="Média pedagógica UGS" value="3.9" hint="Escala 1–5" />
            <Kpi label="Docentes em destaque" value="12" hint="IDD ≥ 4.20" />
            <Kpi label="Alertas críticos abertos" value="3" hint="Ocorrências sem resolução" />
          </div>
          <p className="mt-2 text-sm text-ink-muted">Valores fictícios, só para demonstração visual.</p>
        </Section>

        <Section title="Tabela de dados e estados">
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Docente</th>
                  <th className="px-4 py-3">Turma</th>
                  <th className="px-4 py-3 text-right">IDD</th>
                  <th className="px-4 py-3 text-right">Votos</th>
                  <th className="px-4 py-3">Classificação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.nome} className="h-11 border-b border-border last:border-0">
                    <td className="px-4">{r.nome}</td>
                    <td className="px-4 font-mono text-xs font-medium">{r.turma}</td>
                    <td className="px-4 text-right font-semibold tabular-nums">{r.idd}</td>
                    <td className="px-4 text-right tabular-nums">{r.n}</td>
                    <td className="px-4">
                      {r.estado === "Destaque" && <Badge kind="ok">Docente Destaque</Badge>}
                      {r.estado === "Estável" && <Badge kind="warn">Desempenho Estável</Badge>}
                      {r.estado === "Alerta" && <Badge kind="crit">Alerta Pedagógico</Badge>}
                      {r.estado === "Amostra" && (
                        <span className="rounded-card border border-dashed border-ink-muted px-2 py-1 text-xs text-ink-muted">
                          Amostra insuficiente para preservação do anonimato (&lt; 5 votos)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Votação anónima (mobile)">
          <div className="max-w-sm rounded-card border border-border bg-surface p-4">
            <div className="mb-4 rounded-control bg-ok-bg p-3 text-ok">
              <p className="text-sm font-semibold">✔ Voto 100% anónimo</p>
              <p className="text-sm">O teu número serve apenas para validar que és desta turma.</p>
            </div>

            <label className="text-sm font-semibold" htmlFor="codigo">
              Código da turma
            </label>
            <input
              id="codigo"
              defaultValue="EI3A-7K9P"
              className="mb-3 mt-1 min-h-11 w-full rounded-control border border-border bg-bg px-3 font-mono font-medium"
            />

            <p className="text-sm font-semibold">Clareza e didática</p>
            <div className="mb-4 mt-2 grid grid-cols-5 gap-2" role="group" aria-label="Nota de 1 a 5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  aria-pressed={n === 4}
                  className={`min-h-11 rounded-control border font-display text-lg font-bold ${
                    n === 4 ? "border-brand bg-brand text-white" : "border-border bg-bg"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <button className="min-h-11 w-full rounded-control bg-accent font-semibold text-white">
              Submeter Avaliação Anónima
            </button>
          </div>
        </Section>

        <Section title="Gravidade e código de turma">
          <div className="flex flex-wrap items-center gap-3">
            <Badge kind="ok">Baixa</Badge>
            <Badge kind="warn">Média</Badge>
            <Badge kind="warn">Alta</Badge>
            <Badge kind="crit">Crítica</Badge>
            <span className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-sm font-medium">
              EI3A-7K9P
            </span>
          </div>
        </Section>
      </main>
    </div>
  );
}
