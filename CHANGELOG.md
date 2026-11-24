# Changelog

Segue [Versionamento Semântico](https://semver.org/lang/pt-BR/). Nenhuma versão foi ainda publicada na `main`: tudo abaixo está na `develop`.

## [Por lançar]

### Fase 4 — Segurança, UX mobile e produção (`v1.0.0`)
- CSP com nonce por pedido, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy; `robots` sem indexação; páginas 404 e de erro genéricas.
- `npm run verificar:bundle` (segredos no bundle do browser) e primeiro build de produção verificado.
- Bateria T1–T8 no browser e fluxo de voto a 360×740 e 390×844; `npm run e2e` (69 verificações) e `npm run e2e:prod`.
- Documentação: validação de segurança, deploy (Neon + Vercel) e guia de 1 página para o GAE.

### Fase 3 — BI, relatórios e painel de desafios (`v0.4.0`)
- Dashboard de BI em `/gae`: KPIs, filtros, IDD, classificação e alertas, com a barreira k ≥ 5 aplicada no SQL.
- Triagem de ocorrências com parecer e envio para o Banco de Desafios com resumo impessoal verificado.
- `/insights` para o Observador (só o que o GAE aprovou, sem dados identificáveis).
- Exportações PDF e CSV para a Direção, só para o GAE e registadas em `audit_logs`.
- "Observador FENT Fest" passa a "Observador" na interface.

### Fase 2 — Votação anónima e auditoria do Delegado (`v0.3.0`)
- Voto cego com nullifier HMAC-SHA256, transação atómica, honeypot e rate limit em base de dados (migração `001_rate_limits`).
- `/gae/ciclos` (abrir/encerrar ciclos, rodar códigos), `/votar` mobile-first, painel do Delegado e auditoria de sala.

### Fase 1 — Base de dados, autenticação e estrutura académica (`v0.2.0`)
- Esquema PostgreSQL, seed, scrypt, sessões assinadas com revogação por `session_version`, RBAC e bloqueio após 5 falhas.
- `/gae/estrutura` (turmas A–D, máx. 4) e `/gae/utilizadores` (máx. 3 cargos por turma, palavra-passe provisória).

### Fase 0 — Fundação e governança (`v0.1.0`)
- Fluxo `feat/* → develop → main`, proteção de branches, modelos de PR, guia de contribuição, especificação e roadmap.
