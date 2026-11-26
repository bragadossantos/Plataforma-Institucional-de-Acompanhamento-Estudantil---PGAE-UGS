---
name: release-de-fase
description: Fechar uma fase do roadmap da PGAE com PR develop → main, tag anotada, GitHub Release e deploy.
---

1. Confirmar que todos os PRs da fase estão em `develop`, o CI está verde e os critérios de conclusão foram cumpridos e demonstrados.
2. Abrir PR `develop` → `main` com título `release: vX.Y.Z — <nome da fase>` e notas (novidades, correções, alterações de BD).
3. Aguardar aprovação do utilizador; **não** contornar checks nem proteções.
4. Após o merge: `git switch main && git pull`, `git tag -a vX.Y.Z -m "Fase N — <nome>"`, `git push origin vX.Y.Z`.
5. `gh release create vX.Y.Z --title "..." --notes-file ...`.
6. Verificar o deploy na Vercel e o fluxo principal em produção.
7. Atualizar o estado no `README.md` e no `docs/ROADMAP.md` via PR para `develop`.
