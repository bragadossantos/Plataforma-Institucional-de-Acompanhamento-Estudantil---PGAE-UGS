## O quê

<!-- Resumo da alteração em 1–3 frases. -->

## Porquê

<!-- Problema que resolve / secção da especificação ou fase do roadmap. Ex.: Fase 2, ponto 1. -->

## Como testar

<!-- Passos para verificar. -->

## Tipo

- [ ] feat
- [ ] fix
- [ ] docs
- [ ] refactor / chore / ci / test / style

## Checklist

- [ ] A base deste PR é `develop` (exceto PR de release `develop` → `main`)
- [ ] Branch em kebab-case e título em Conventional Commits
- [ ] CI verde
- [ ] Sem segredos ou dados reais no diff

### Segurança (se tocar em auth, votos, RBAC, exportações ou dados)

- [ ] `requireAuth(roles)` e escopo de turma validados no servidor
- [ ] Entradas validadas com Zod; SQL parametrizado
- [ ] Nada identificável em `votos_docentes`
- [ ] Ações administrativas registadas em `audit_logs`
- [ ] Não aplicável
