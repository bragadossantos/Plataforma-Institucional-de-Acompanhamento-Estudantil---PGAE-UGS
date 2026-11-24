# PGAE — Plataforma Institucional de Acompanhamento Estudantil

> Sistema do **Grupo de Acompanhamento Estudantil (GAE)** da **Universidade Gregório Semedo (UGS)** para avaliação docente anónima, auditoria de sala de aula e Business Intelligence académico.

![Estado](https://img.shields.io/badge/estado-Fase%200%20·%20Fundação-orange)
![Stack](https://img.shields.io/badge/stack-Next.js%2016%20·%20React%2019%20·%20PostgreSQL-blue)
![Licença](https://img.shields.io/badge/licen%C3%A7a-proprietária-lightgrey)

## O que é

A PGAE liga as salas de aula da UGS à Direção da Universidade:

- **Votação docente 100% anónima** por código de turma, pelo telemóvel, sem conta individual do aluno e com garantia criptográfica contra votos duplicados.
- **Auditoria de sala de aula** registada pela liderança de turma (Delegado, Subdelegado, Secretário).
- **Dashboard de BI** em tempo real, com k-anonimato (k ≥ 5) e exportação **PDF/CSV** para a Direção.
- **Banco de Desafios FENT Fest**: vista isolada, só de leitura, com problemas académicos anonimizados e aprovados pelo GAE.

É uma **plataforma de apoio institucional** (ferramenta de trabalho, orientada a dados), não um site de divulgação.

## Documentação

| Documento | Conteúdo |
| :--- | :--- |
| [Especificação Arquitetural e de Segurança](docs/ESPECIFICACAO-ARQUITETURAL.md) | Fonte de verdade: arquitetura, modelo de dados, segurança, BI, testes |
| [Roadmap e Fases](docs/ROADMAP.md) | Fases de construção, versões e critérios de conclusão |
| [Proposta Visual](docs/PROPOSTA-VISUAL.md) | Design system da plataforma (cores, tipografia, componentes) |
| [Validação de Segurança](docs/VALIDACAO-SEGURANCA.md) | Testes T1–T8, evidência, o que falta verificar |
| [Deploy](docs/DEPLOY.md) | Neon + Vercel, variáveis de ambiente, verificação |
| [Guia rápido do GAE](docs/GUIA-GAE.md) | Uma página para a equipa do GAE |
| [Guia de Contribuição](CONTRIBUTING.md) | Fluxo Git, branches, commits, PRs, releases |
| [Política de Segurança](SECURITY.md) | Como reportar vulnerabilidades |

## Stack

Next.js 16 (App Router + Server Actions) · React 19 · Tailwind CSS 4 · Zod · PostgreSQL (Neon) com cliente `postgres` · `crypto` nativo do Node.js (scrypt, HMAC-SHA256) · Deploy na Vercel.

## Fluxo de trabalho (resumo)

```
feat/nome-em-kebab-case ──PR──▶ develop ──PR (verificada)──▶ main ──▶ tag + release + deploy
```

- `main` = produção/releases. `develop` = integração.
- **Nunca** se abre PR diretamente para `main` a partir de uma branch de trabalho: tudo entra por `develop`.
- Detalhes completos em [CONTRIBUTING.md](CONTRIBUTING.md).

## Desenvolvimento local

Requisitos: Node.js 24+.

```bash
git clone https://github.com/bragadossantos/Plataforma-Institucional-de-Acompanhamento-Estudantil---PGAE-UGS.git
cd Plataforma-Institucional-de-Acompanhamento-Estudantil---PGAE-UGS
git switch develop
npm install
cp .env.example .env.local      # preencher (ver abaixo)
npm run db:local                # terminal 1: PostgreSQL local (PGlite), dados em .pglite/
npm run db:seed                 # terminal 2: cria o GAE_ADMIN e o FENT_OBSERVER iniciais
npm run dev                     # terminal 2: http://localhost:3000
npm test                        # testes de regras e base de dados
npm run e2e                     # testes no browser (precisa do Edge ou Chrome)
```

Variáveis em `.env.local` (nunca fazer commit): `DATABASE_URL`, `SESSION_SECRET` (≥ 32 caracteres, ex.: `openssl rand -hex 32`), `VOTE_PEPPER`, `IP_SALT` e as `SEED_*` (só para o seed). Para uma base Neon, usar a `DATABASE_URL` do Neon e `npm run db:migrate` em vez de `db:local`.

O primeiro acesso de cada utilizador obriga a trocar a palavra-passe provisória.

## Estado atual

Fases 1 a 4 construídas e fundidas na `develop`: autenticação e RBAC, estrutura académica, votação anónima, painel do Delegado, dashboard de BI, triagem, Banco de Desafios, exportações PDF/CSV, cabeçalhos de segurança e guias. `npm test` (115 testes) e `npm run e2e` (69 verificações no browser) passam.

**Falta:** deploy em produção (Neon e Vercel, ver [DEPLOY.md](docs/DEPLOY.md)) e o release na `main`. Ver [Roadmap](docs/ROADMAP.md).

## Licença

Projeto institucional da UGS/GAE. Todos os direitos reservados até definição de licença pela Direção.
