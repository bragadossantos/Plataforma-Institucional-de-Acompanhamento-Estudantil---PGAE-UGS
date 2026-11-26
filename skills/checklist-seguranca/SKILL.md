---
name: checklist-seguranca
description: Verificação de segurança e privacidade antes de abrir ou fundir um PR da PGAE que toque em auth, votos, RBAC, exportações ou dados.
---

- [ ] `requireAuth(roles)` em todas as Server Actions/Route Handlers; `turma_id`/`autor_id` vêm da sessão.
- [ ] Entradas validadas com Zod; SQL parametrizado; honeypot nos formulários públicos.
- [ ] `votos_docentes` sem aluno, IP, hora exata ou FK para `votos_controlo`.
- [ ] Médias e comentários ocultos com menos de 5 votos.
- [ ] `FENT_OBSERVER` só acede a `/insights` e vê apenas registos aprovados e anonimizados.
- [ ] Ações administrativas, negações e exportações registadas em `audit_logs`.
- [ ] Sem segredos no código, logs ou bundle cliente (`grep` por `SESSION_SECRET`, `VOTE_PEPPER`, `DATABASE_URL` em `.next/static`).
- [ ] Erros genéricos ao utilizador.
- [ ] Cenários T1–T8 relevantes testados.
