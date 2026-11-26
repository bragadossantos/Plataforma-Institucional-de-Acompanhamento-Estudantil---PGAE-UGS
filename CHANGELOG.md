# Changelog

Segue [Versionamento Semântico](https://semver.org/lang/pt-BR/).

`v1.0.0-rc.1` é a primeira versão na `main`. É um *release candidate*: o código está completo e testado, mas o deploy (Neon e Vercel), os telemóveis reais e o Wi-Fi do campus ainda não foram verificados (ver [VALIDACAO-SEGURANCA.md](docs/VALIDACAO-SEGURANCA.md)). Passa a `v1.0.0` depois dessa verificação.

## [v1.0.0-rc.1] — 2026-11-26

### Fase 4 — Segurança, UX mobile e produção
- CSP com nonce por pedido, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy; `robots` sem indexação; páginas 404 e de erro genéricas.
- `npm run verificar:bundle` (segredos no bundle do browser) e primeiro build de produção verificado.
- Bateria T1–T8 no browser e fluxo de voto a 360×740 e 390×844; `npm run e2e` (69 verificações) e `npm run e2e:prod`.
- Documentação: validação de segurança, deploy (Neon + Vercel) e guia de 1 página para o GAE.
- Contas e dados de demonstração para a base local (`npm run db:demo`); testes T1/T6 no browser passam a verificar o estado HTTP 403 (antes eram vácuos).

## [v0.4.0] — 2026-11-26

### Fase 3 — BI, relatórios e painel de desafios
- Dashboard de BI em `/gae`: KPIs, filtros, IDD, classificação e alertas, com a barreira k ≥ 5 aplicada no SQL.
- Triagem de ocorrências com parecer e envio para o Banco de Desafios com resumo impessoal verificado.
- `/insights` para o Observador (só o que o GAE aprovou, sem dados identificáveis).
- Exportações PDF e CSV para a Direção, só para o GAE e registadas em `audit_logs`.
- "Observador FENT Fest" passa a "Observador" na interface.

## [v0.3.0] — 2026-11-26

### Fase 2 — Votação anónima e auditoria do Delegado
- Voto cego com nullifier HMAC-SHA256, transação atómica, honeypot e rate limit em base de dados (migração `001_rate_limits`).
- `/gae/ciclos` (abrir/encerrar ciclos, rodar códigos), `/votar` mobile-first, painel do Delegado e auditoria de sala.

## [v0.2.0] — 2026-11-26

### Fase 1 — Base de dados, autenticação e estrutura académica
- Esquema PostgreSQL, seed, scrypt, sessões assinadas com revogação por `session_version`, RBAC e bloqueio após 5 falhas.
- `/gae/estrutura` (turmas A–D, máx. 4) e `/gae/utilizadores` (máx. 3 cargos por turma, palavra-passe provisória).

## [v0.1.0] — 2026-11-26

### Fase 0 — Fundação e governança
- Fluxo `feat/* → develop → main`, proteção de branches, modelos de PR, guia de contribuição, especificação e roadmap.
