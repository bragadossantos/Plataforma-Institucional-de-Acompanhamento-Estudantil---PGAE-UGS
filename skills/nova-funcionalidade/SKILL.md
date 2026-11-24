---
name: nova-funcionalidade
description: Implementar uma funcionalidade da PGAE a partir do roadmap, de ponta a ponta (BD, backend, UI, testes, PR).
---

1. Ler o item no `docs/ROADMAP.md` e as secções relevantes da especificação; confirmar o critério de conclusão.
2. Criar a branch (skill `fluxo-git`).
3. Se mexe em dados: migração (skill `migracao-bd`).
4. Backend: Zod + `requireAuth` + escopo pela sessão + `audit_logs`.
5. UI: tokens do design system, mobile-first, estados vazio/erro/carregamento.
6. Testes das regras de negócio e de acesso.
7. `npm run lint && npm run build` e testar no servidor de desenvolvimento.
8. Skill `checklist-seguranca`; abrir PR para `develop`.
9. Atualizar a documentação se o comportamento mudou.
