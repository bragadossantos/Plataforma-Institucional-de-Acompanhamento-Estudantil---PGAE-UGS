# Guia de Contribuição

Este projeto lida com dados sensíveis (avaliação docente, anonimato de estudantes). O fluxo abaixo existe para que nada chegue a produção sem revisão.

## 1. Modelo de branches

Só existem **duas branches permanentes**:

| Branch | Função | Quem escreve nela |
| :--- | :--- | :--- |
| `main` | Produção. Cada commit é uma release, marcada com tag e com deploy na Vercel. | Apenas via PR vindo de `develop` |
| `develop` | Integração. Onde as alterações se juntam e são testadas antes do release. | Apenas via PR de branches de trabalho |

Regras:

1. **Nunca** commits diretos em `main` ou `develop`.
2. **Nunca** PR de uma branch de trabalho para `main`. Tudo vai para `develop`.
3. `develop` → `main` só quando a fase/release estiver aprovada e verificada.
4. Toda a mudança, incluindo correções urgentes (*hotfix*), passa por `develop` primeiro.

## 2. Nomes de branches (kebab-case)

Formato: `<tipo>/<descricao-em-kebab-case>`, minúsculas, sem acentos, curto e descritivo.

| Tipo | Uso | Exemplo |
| :--- | :--- | :--- |
| `feat` | Nova funcionalidade | `feat/votacao-anonima-nullifier` |
| `fix` | Correção de bug | `fix/bloqueio-login-apos-5-falhas` |
| `hotfix` | Correção urgente de produção (também via `develop`) | `hotfix/cookie-sessao-sem-secure` |
| `docs` | Documentação | `docs/guia-gae-uma-pagina` |
| `refactor` | Reestruturação sem mudar comportamento | `refactor/validators-zod` |
| `test` | Testes | `test/rbac-escalada-privilegio` |
| `chore` | Tooling, dependências, configuração | `chore/atualizar-next-16` |
| `ci` | Pipelines e automação | `ci/workflow-lint-e-build` |
| `style` | Apenas UI/estilo, sem lógica | `style/tokens-de-cor` |

Fluxo:

```bash
git switch develop && git pull
git switch -c feat/dashboard-kpis
# ... trabalho, commits pequenos ...
git push -u origin feat/dashboard-kpis
# abrir PR com base em develop
```

## 3. Commits (Conventional Commits)

```
<tipo>(<âmbito opcional>): <resumo no imperativo, até 72 caracteres>

<corpo opcional: o quê e porquê>
```

Exemplos:

```
feat(votacao): calcular nullifier HMAC-SHA256 em memória
fix(auth): bloquear conta 15 min após 5 tentativas falhadas
docs(roadmap): detalhar critérios de conclusão da Fase 2
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Mudança incompatível: `!` após o tipo (`feat(db)!: ...`) e `BREAKING CHANGE:` no corpo.

## 4. Pull Requests

1. Base **sempre** `develop` (exceto o PR de release `develop` → `main`).
2. Título no formato de Conventional Commit.
3. Preencher o modelo de PR (o quê, porquê, como testar, checklist de segurança).
4. PR pequeno e focado: uma funcionalidade ou correção.
5. CI verde e pelo menos **1 aprovação** antes de *merge*.
6. *Merge* com **squash** para `develop` (histórico linear e limpo) e com **merge commit** de `develop` para `main` (preserva a fronteira de cada release).
7. Apagar a branch de trabalho após o *merge*.

Um workflow (`pr-target-guard`) falha automaticamente qualquer PR para `main` que não venha de `develop`.

### Checklist de segurança (obrigatória quando aplicável)

- [ ] Server Actions e Route Handlers usam `requireAuth(roles)` e validam o escopo da turma no servidor.
- [ ] Nenhum `turma_id`/`autor_id` é aceite do cliente; usa-se sempre a sessão.
- [ ] Entradas validadas com Zod; SQL só parametrizado.
- [ ] Nada que identifique o aluno é gravado em `votos_docentes` (sem IP, sem hora exata, sem FK para `votos_controlo`).
- [ ] Nenhum segredo no código, nos logs ou no bundle cliente.
- [ ] Ações administrativas registadas em `audit_logs`.

## 5. Versões, tags e releases

Versionamento semântico (`vMAJOR.MINOR.PATCH`). Cada **fase** do [Roadmap](docs/ROADMAP.md) fecha com um release:

1. Todos os PRs da fase estão em `develop` e a fase cumpre os critérios de conclusão.
2. Abrir PR `develop` → `main` com título `release: vX.Y.Z — <nome da fase>`.
3. Após aprovação e merge, criar a tag anotada em `main`:
   ```bash
   git switch main && git pull
   git tag -a vX.Y.Z -m "Fase N — <nome>"
   git push origin vX.Y.Z
   ```
4. Criar o **GitHub Release** a partir da tag, com notas (novidades, correções, mudanças na base de dados, passos de migração).
5. A Vercel faz o deploy de produção a partir de `main`; `develop` gera *preview deployments*.
6. **Packages**: quando fizer sentido (decisão na Fase 4), publicar a imagem de contentor em GitHub Container Registry (`ghcr.io`) com a mesma tag do release.

Pré-releases (`v0.2.0-rc.1`) podem ser marcados a partir de `develop`.

## 6. Segredos e dados

- Nunca fazer commit de `.env*` (exceto `.env.example` sem valores reais).
- Segredos de produção (`DATABASE_URL`, `SESSION_SECRET`, `VOTE_PEPPER`, `IP_SALT`) vivem só nas variáveis de ambiente da Vercel.
- Nunca colar dados reais de estudantes ou docentes em issues, PRs ou logs.
- Vulnerabilidades: ver [SECURITY.md](SECURITY.md); não abrir issue pública.

## 7. Idioma

Documentação, mensagens de UI e descrições de PR em **português (Angola)**. Identificadores de código e nomes de tabelas seguem a especificação (português, `snake_case` na base de dados).
