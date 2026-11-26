---
name: migracao-bd
description: Alterar o esquema PostgreSQL da PGAE com migração numerada, validação e nota de reversão.
---

1. Criar `db/migrations/NNN_descricao.sql` (NNN sequencial) e refletir o estado final em `db/schema.sql`.
2. Preferir `IF NOT EXISTS`/constraints nomeadas; nunca remover ou renomear colunas sem plano de dados.
3. Regras que não podem ser quebradas: `votos_docentes` sem identificadores; `votos_controlo` sem notas; `audit_logs` só inserção.
4. Validar num Postgres local ou ramo Neon: aplicar, testar constraints (5.ª turma, 2.º Delegado, voto duplicado) e confirmar reversão.
5. No PR: descrever a migração, o impacto e como reverter.
6. Produção: só com confirmação explícita do utilizador, após backup/ramo de segurança.
