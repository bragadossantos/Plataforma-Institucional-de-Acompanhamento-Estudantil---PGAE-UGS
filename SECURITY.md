# Política de Segurança

A PGAE trata dados sensíveis (avaliação docente, ocorrências de sala de aula). Levamos a segurança a sério.

## Como reportar uma vulnerabilidade

**Não abra uma issue pública.** Use o separador *Security → Report a vulnerability* deste repositório (relatório privado) ou contacte diretamente a equipa responsável.

Indique: o que encontrou, passos para reproduzir, impacto previsto. Não aceda, copie ou divulgue dados reais.

## Âmbito prioritário

- Quebra do anonimato do voto (ligação aluno ↔ voto).
- Escalada de privilégios / acesso cruzado entre turmas.
- Acesso do perfil `FENT_OBSERVER` a dados fora de `/insights`.
- Exposição de segredos, injeção SQL, XSS, CSRF.

Os requisitos de segurança completos estão na [Especificação](docs/ESPECIFICACAO-ARQUITETURAL.md), secções 4 e 8.
