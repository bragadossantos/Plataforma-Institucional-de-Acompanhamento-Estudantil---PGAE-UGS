# Validação de segurança (T1–T8) e checklist de go-live

Evidência automática para a secção 8 da [Especificação](ESPECIFICACAO-ARQUITETURAL.md). Todos os testes correm em PostgreSQL real (PGlite) e, os de interface, num browser real (Edge).

Como reproduzir:

```bash
npm test                      # testes de regras e de base de dados
npm run e2e                   # browser, servidor de desenvolvimento
NEXT_DIST_DIR=.next-build npx next build && npm run e2e:prod   # browser, servidor de produção
npm run verificar:bundle      # segredos no bundle do browser
```

| # | Cenário | Resultado esperado | Evidência |
| :-- | :-- | :-- | :-- |
| **T1** | Delegado tenta aceder a `/gae` ou invocar ações de GAE | 403 no servidor e registo em `audit_logs` | E2E: delegado em `/gae` recebe "Acesso negado" e fica `ACESSO_NEGADO` em `audit_logs`. Todas as ações usam `requireAuth(perfis)`; testes de `rbac` |
| **T2** | Delegado da turma A altera o `turma_id`/docente para a turma B | Recusado; o servidor usa `session.turma_id` | E2E: docente da turma B injetado no formulário → 403, nada gravado, `ACESSO_NEGADO` registado. E2E: `turma_id=999` injetado → gravado com a turma da sessão. Teste de `auditoria-core` |
| **T3** | Votar de novo mudando maiúsculas, espaços ou separadores | Bloqueado pela normalização + `UNIQUE(nullifier_hash)` | Testes de `vote-core` (3 variações + pedidos simultâneos). E2E: `" ugs-2024-0001 "` bloqueado |
| **T4** | Inspecionar `votos_docentes` após votos | Sem nome, n.º de estudante, IP, hora exata nem ligação a `votos_controlo` | Testes de `vote-core` (colunas, tipo `date`, UUID, ausência de FK e do identificador/hash). E2E: o identificador não aparece em nenhuma tabela de conteúdo |
| **T5** | Docente com menos de 5 votos | Média e comentários ocultos; aviso de amostra insuficiente | Testes de `bi-core` (SQL devolve nulos; 4.º voto não desbloqueia; comentários só com ≥ 5). E2E: dashboard, CSV e PDF mostram o aviso |
| **T6** | Observador tenta `/gae`, exportações ou avaliações | 403; só `/insights` | E2E: 403 em `/gae`, `/gae/ciclos`, `/gae/utilizadores`, `/gae/auditorias`, `/delegado`, `/api/export/*`. Teste de `insights-core`: nada de docentes, autores, turmas ou títulos |
| **T7** | 5.ª turma no mesmo curso/ano ou 4.º cargo de turma | Recusado pelo Zod e pelas constraints | Testes de esquema e de `estrutura-core`/`utilizadores-core`. E2E: a interface recusa a 5.ª turma e um 2.º Delegado ativo |
| **T8** | Admin desativa um Delegado com sessão aberta noutro browser | Próxima ação bloqueada e redirecionada para `/login` | E2E: dois browsers; após "Desativar", `/delegado/auditoria` e `/delegado` redirecionam para `/login`. Testes de `utilizadores-core` (`session_version`) |

## Outros requisitos verificados

| Requisito | Evidência |
| :-- | :-- |
| Bloqueio após 5 falhas durante 15 min (4.1) | `login-core.test.ts` |
| Troca obrigatória da palavra-passe no 1.º acesso (4.1) | E2E (GAE, delegado e observador) |
| Honeypot e rate limit (4.4) | E2E: honeypot não grava; 5 códigos errados bloqueiam o IP |
| Cabeçalhos HTTP e CSP com nonce (4.4) | E2E em desenvolvimento e produção: CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy; **zero violações da CSP** em todas as páginas |
| Sem segredos no bundle do browser (Dia 4) | `npm run verificar:bundle` (22 ficheiros); testado em negativo |
| Fluxo de voto < 90 s a 360 px e 390 px | E2E: ~5 s a 360×740 e entre 9 e 30 s a 390×844 (conforme a carga da máquina) (alvos táteis ≥ 44 px, sem scroll horizontal) |
| Exportações só para o GAE e registadas | E2E: 401 sem sessão, 403 Observador, `audit_logs` |

## O que NÃO está verificado

Estes pontos exigem o ambiente de produção e não foram testados:

- Ligação ao **Neon** (TLS, `npm run db:migrate` e `npm run db:upgrade` num Neon real).
- **Deploy na Vercel** e as variáveis de produção (ver [DEPLOY.md](DEPLOY.md)).
- Teste em **telemóveis reais** (Android/iOS): foi simulado o tamanho do ecrã e o toque num browser real.
- **Wi-Fi do campus**: o rate limit usa o IP do pedido; confirmar que a rede da UGS não partilha um único IP para todos os alunos de forma a bloquear a turma inteira (limite: 40 pedidos por 10 min por IP).
- Teste de penetração independente.

## Limitações conhecidas da especificação

- Não há lista de alunos: o n.º de estudante distingue votantes mas não prova pertença à turma. Quem tiver o código de uma turma pode votar com qualquer número.
- A ordem de inserção das linhas em `votos_controlo` e `votos_docentes` pode, em teoria, correlacionar-se na ordem física de armazenamento. O sistema embaralha a ordem de inserção dos votos dentro de cada submissão, mas não elimina o risco para quem tenha acesso direto ao ficheiro de dados da base.
- O resumo para o Banco de Desafios só verifica automaticamente os nomes do docente e de quem registou; nomes de terceiros dependem da revisão do GAE.
