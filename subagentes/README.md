# Subagentes da PGAE

Especialistas que o Claude pode chamar para trabalhar em partes específicas do projeto. Cada ficheiro é um subagente no formato do Claude Code (cabeçalho YAML + instruções).

| Subagente | Quando usar |
| :--- | :--- |
| [frontend](frontend.md) | Páginas, componentes, formulários, mobile-first |
| [backend](backend.md) | Server Actions, Route Handlers, auth, RBAC, exportações |
| [base-de-dados](base-de-dados.md) | Schema SQL, migrações, queries, seed |
| [seguranca](seguranca.md) | Revisão de segurança, anonimato do voto, testes T1–T8 |
| [ui-design-system](ui-design-system.md) | Tokens, componentes visuais, acessibilidade |
| [qa-testes](qa-testes.md) | Testes automáticos, verificação manual, mobile |
| [devops-deploy](devops-deploy.md) | GitHub Actions, Vercel, releases, variáveis de ambiente |
| [revisor-de-codigo](revisor-de-codigo.md) | Revisão de PRs antes do merge |
| [documentacao](documentacao.md) | README, guias, notas de release, guia do GAE |

## Como ativar no Claude Code

O Claude Code lê agentes de `.claude/agents/`. Para ativar estes ficheiros:

```bash
mkdir -p .claude/agents && cp subagentes/*.md .claude/agents/ && rm .claude/agents/README.md
```

Para as skills em [skills/](../skills/README.md), copiar para `.claude/skills/`.

## Regras comuns a todos

1. Seguir o [CONTRIBUTING.md](../CONTRIBUTING.md): branches em kebab-case, PR sempre para `develop`, nunca para `main`.
2. Commits em Conventional Commits, **sem linhas de coautoria** e sem notas de ferramenta nos PRs.
3. A [Especificação](../docs/ESPECIFICACAO-ARQUITETURAL.md) é a fonte de verdade; propor alteração antes de divergir.
4. Nunca expor segredos, dados reais de estudantes/docentes, ou qualquer elo aluno ↔ voto.
