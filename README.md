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

## Começar (a partir da Fase 1)

```bash
git clone https://github.com/bragadossantos/Plataforma-Institucional-de-Acompanhamento-Estudantil---PGAE-UGS.git
cd Plataforma-Institucional-de-Acompanhamento-Estudantil---PGAE-UGS
git switch develop
```

As instruções de instalação, variáveis de ambiente (`DATABASE_URL`, `SESSION_SECRET`, `VOTE_PEPPER`, `IP_SALT`) e scripts serão adicionadas na Fase 1, quando o código existir.

## Estado atual

Fase 0 (Fundação): repositório, governança e documentação. Ver [Roadmap](docs/ROADMAP.md).

## Licença

Projeto institucional da UGS/GAE. Todos os direitos reservados até definição de licença pela Direção.
