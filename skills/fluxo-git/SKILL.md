---
name: fluxo-git
description: Criar branch em kebab-case, fazer commits Conventional Commits e abrir PR para develop na PGAE. Usar sempre que for começar ou entregar uma alteração.
---

1. `git switch develop && git pull`.
2. `git switch -c <tipo>/<descricao-em-kebab-case>` (tipos: feat, fix, hotfix, docs, refactor, test, chore, ci, style).
3. Commits pequenos: `<tipo>(<âmbito>): <resumo no imperativo>`. **Sem linhas `Co-Authored-By`** e sem notas de ferramenta.
4. `git push -u origin <branch>`.
5. `gh pr create --base develop` com o modelo `.github/PULL_REQUEST_TEMPLATE.md` preenchido (o quê, porquê, como testar, checklist). **Nunca** `--base main` (exceto PR de release a partir de `develop`).
6. Não contornar checks nem proteções; se um check falhar por razões externas, parar e avisar o utilizador.
7. Depois do merge: apagar a branch e sincronizar `develop`.
