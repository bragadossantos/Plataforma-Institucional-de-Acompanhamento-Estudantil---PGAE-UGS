# Roadmap e Fases de Construção

Derivado da [Especificação Arquitetural](ESPECIFICACAO-ARQUITETURAL.md) (secções 7 e 8). Cada fase termina com **PR `develop` → `main`**, **tag**, **GitHub Release** e deploy, conforme o [Guia de Contribuição](../CONTRIBUTING.md).

| Fase | Versão | Nome | Duração prevista | Estado |
| :---: | :---: | :--- | :--- | :--- |
| 0 | `v0.1.0` | Fundação e governança | — | Concluída |
| 1 | `v0.2.0` | Base de dados, autenticação e estrutura académica | Dia 1 (6–8 h) | Concluída |
| 2 | `v0.3.0` | Votação anónima e auditoria do Delegado | Dia 2 (6–8 h) | Concluída |
| 3 | `v0.4.0` | BI, relatórios e painel de desafios | Dia 3 (6–8 h) | Concluída |
| 4 | `v1.0.0` | Segurança, UX mobile e produção | Dia 4 (4–6 h) | Código e documentação prontos; falta deploy |

---

## Fase 0 — Fundação e governança · `v0.1.0`

- Repositório com `main` + `develop`, proteção de branches, modelo de PR, issues, CODEOWNERS.
- README, CONTRIBUTING, SECURITY, especificação e roadmap.
- Workflow `pr-target-guard` (PR para `main` só a partir de `develop`; branches em kebab-case).
- Proposta visual (design system) aprovada.

**Concluída quando:** o fluxo `feat/* → develop → main` funciona e está protegido no GitHub.

## Fase 1 — Base de dados, autenticação e estrutura académica · `v0.2.0`

Branches sugeridas: `chore/scaffold-nextjs-16`, `feat/schema-sql-e-seed`, `feat/auth-sessoes-rbac`, `feat/gae-estrutura-academica`, `feat/gae-utilizadores`.

1. Scaffold Next.js 16 + React 19 + Tailwind 4 + Zod; tokens do design system.
2. `db/schema.sql` aplicado no Neon; `db/seed.ts` (1.º `GAE_ADMIN`, 1 `FENT_OBSERVER`, faculdades/cursos).
3. `lib/auth.ts` + `lib/audit.ts`: scrypt, cookie `HttpOnly`, `session_version`, bloqueio após 5 falhas, guards RBAC, troca obrigatória de palavra-passe no 1.º acesso.
4. `/gae/estrutura` e `/gae/utilizadores`: CRUD de Faculdades, Cursos, Turmas (máx. 4), Docentes e Liderança (máx. 3).

**Concluída quando:** o `GAE_ADMIN` faz login, cria a turma `EI-3A`, associa 3 docentes, cadastra 1 Delegado; o sistema bloqueia uma 5.ª turma e um 2.º Delegado ativo.

## Fase 2 — Votação anónima e auditoria do Delegado · `v0.3.0`

Branches sugeridas: `feat/crypto-vote-nullifier`, `feat/rate-limit-campus`, `feat/gae-ciclos`, `feat/votar-mobile-first`, `feat/delegado-painel-auditoria`.

1. `lib/crypto-vote.ts` e `lib/rate-limit.ts`: nullifier HMAC-SHA256, transação atómica, honeypot, limites adaptados ao Wi-Fi do campus.
2. `/gae/ciclos`: abrir/fechar ciclos, rodar códigos de turma.
3. `/votar`: fluxo de 3 toques (< 90 s) + inquietação opcional.
4. `/delegado` e `/delegado/auditoria`: código da turma, medidor TPT, formulário de auditoria.

**Concluída quando:** um aluno vota pelo telemóvel; a 2.ª tentativa é bloqueada; `votos_docentes` não contém dados identificativos; a ocorrência do Delegado aparece na fila do GAE.

## Fase 3 — BI, relatórios e painel de desafios · `v0.4.0`

Branches sugeridas: `feat/bi-metrics-idd-tpt`, `feat/gae-dashboard-bi`, `feat/gae-auditorias-triagem`, `feat/export-pdf-csv`, `feat/insights-fent-observer`.

1. `lib/bi-metrics.ts`: IDD, TPT, rankings, barreira k ≥ 5.
2. `/gae`: 4 KPIs, filtros (Ciclo/Faculdade/Curso/Turma), Docentes Destaque, Alertas Críticos.
3. `/gae/auditorias`: estados das ocorrências + curadoria anonimizada para o FENT Fest.
4. `/api/export/pdf` e `/api/export/csv` com RBAC e registo em `audit_logs`.
5. `/insights` para `FENT_OBSERVER`.

**Concluída quando:** o GAE vê rankings com k ≥ 5, exporta PDF para a Direção e aprova 2 problemas visíveis em `/insights` sem nomes de docentes ou alunos.

## Fase 4 — Segurança, UX mobile e produção · `v1.0.0`

Branches sugeridas: `test/bateria-seguranca-t1-t8`, `style/polimento-mobile`, `chore/headers-seguranca`, `ci/deploy-vercel`, `docs/guia-gae-uma-pagina`.

1. Testes T1–T8 da secção 8 da especificação, todos a 100%.
2. Fluxo de votação testado a 360 px e 390 px, abaixo de 90 s.
3. Cabeçalhos de segurança em `next.config.ts`; verificação de segredos no bundle.
4. Deploy na Vercel com `DATABASE_URL`, `SESSION_SECRET`, `VOTE_PEPPER`, `IP_SALT`, `NODE_ENV=production`.
5. Guia de 1 página para a equipa do GAE.
6. Decisão sobre publicar imagem em GitHub Container Registry (opcional; o deploy na Vercel não a exige).

**Concluída quando:** T1–T8 passam em produção e o link oficial é entregue ao GAE.

---

Todas as fases estão fundidas na `develop`; ainda não houve release para a `main` (sem tags). Ver [CHANGELOG](../CHANGELOG.md).

## Pontos em aberto

- Deploy: contas Neon e Vercel, domínio/URL final (ver [DEPLOY.md](DEPLOY.md)).
- Lista de alunos para validar a pertença à turma (limitação da especificação v1.0).
- Logótipos oficiais da UGS/GAE (ver [Proposta Visual](PROPOSTA-VISUAL.md)).
- Região e plano do Neon; política de retenção de dados (Lei n.º 22/11).
