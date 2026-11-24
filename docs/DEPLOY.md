# Deploy em produção (Neon + Vercel)

Passos para pôr a PGAE no ar. **Ainda não foram executados**: exigem as suas contas no Neon e na Vercel. O código foi verificado com build de produção e testes no browser (ver [VALIDACAO-SEGURANCA.md](VALIDACAO-SEGURANCA.md)).

## 1. Base de dados no Neon

1. Criar um projeto no [Neon](https://neon.tech) (plano gratuito serve para o arranque). Escolher a região mais próxima da região das funções da Vercel; o tempo de ida e volta à base de dados pesa mais do que a distância ao utilizador.
2. Copiar a *connection string* **com `sslmode=require`** (`postgres://…neon.tech/…?sslmode=require`). A aplicação exige TLS para qualquer base que não seja local.
3. Num terminal, com essa URL (sem a gravar em ficheiros do repositório):
   ```bash
   # PowerShell: $env:DATABASE_URL="postgres://…"   ·   bash: export DATABASE_URL="postgres://…"
   node db/migrate.ts          # cria o esquema (só corre numa base vazia)
   node db/upgrade.ts          # aplica as migrações (rate_limits)
   ```
4. Criar os utilizadores iniciais (uma só vez). Escolha credenciais fortes e **troque-as no 1.º acesso** (o sistema obriga):
   ```bash
   SEED_ADMIN_IDENTIFICADOR=… SEED_ADMIN_PASSWORD=… SEED_OBSERVER_IDENTIFICADOR=… SEED_OBSERVER_PASSWORD=… node db/seed.ts
   ```
   O seed cria só a FENT e Engenharia Informática; o GAE completa o resto em **Estrutura**.

## 2. Segredos

Gerar três valores aleatórios (um por variável):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # SESSION_SECRET e VOTE_PEPPER (64 hex)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"   # IP_SALT (32 hex)
```

| Variável | Para quê | Atenção |
| :-- | :-- | :-- |
| `DATABASE_URL` | Ligação ao Neon | Com `sslmode=require` |
| `SESSION_SECRET` | Assina as sessões e o cookie de votação | Trocar termina todas as sessões (aceitável) |
| `VOTE_PEPPER` | Chave do nullifier do voto | **Nunca trocar depois de haver votos**: os nullifiers antigos deixariam de coincidir e permitiria votar de novo. Guardar uma cópia segura |
| `IP_SALT` | Anonimiza IPs em `rate_limits` e `audit_logs` | Trocar só reinicia as contagens |
| `NODE_ENV=production` | Cookies `Secure`, sem stack traces | A Vercel já define em produção |

## 3. Vercel

1. *Add New → Project* e importar este repositório do GitHub. A framework é detetada (Next.js); o `vercel.json` só a confirma.
2. Em **Settings → Environment Variables**, definir as quatro variáveis acima para **Production** (e, se quiser *previews*, para **Preview** com uma base Neon separada: use um *branch* do Neon, nunca a base de produção).
3. **Production Branch**: `main`. Os PRs e a `develop` geram *preview deployments*.
4. Fazer o primeiro deploy e abrir o URL `https://…vercel.app`.

## 4. Verificação depois do deploy

- [ ] `https://…/login` abre por HTTPS e o certificado é válido.
- [ ] Entrar com o admin do seed → obriga a trocar a palavra-passe → painel `/gae`.
- [ ] Em **Estrutura**, criar uma turma de teste com um docente; em **Ciclos**, abrir um ciclo; votar pelo telemóvel em `/votar` com o código da turma; confirmar o painel e a exportação PDF.
- [ ] Cabeçalhos: `curl -I https://…/login` mostra `strict-transport-security`, `content-security-policy` com `nonce-`, `x-frame-options: DENY`.
- [ ] Nada de segredos no browser: *Ver código-fonte* não mostra `SESSION_SECRET`, `VOTE_PEPPER`, `IP_SALT` nem a URL da base.
- [ ] Apagar a turma/ciclo de teste (desativar; não se apagam registos com votos) antes de entregar ao GAE.

## 5. Antes de entregar ao GAE

- Rever as pendências de [VALIDACAO-SEGURANCA.md](VALIDACAO-SEGURANCA.md) ("O que NÃO está verificado"), em especial o Wi-Fi do campus e a ausência de lista de alunos.
- Entregar o [guia de 1 página](GUIA-GAE.md).
- Ativar cópias de segurança no Neon (histórico de *point-in-time restore*) e definir quem as gere.
- Definir domínio institucional (ex.: um subdomínio da UGS) em **Settings → Domains**.

## Reverter

- **Deploy com problema**: em *Deployments*, promover a versão anterior (*Promote to Production*), sem tocar na base de dados.
- **Migração com problema**: cada ficheiro de `db/migrations/` indica a sua reversão no cabeçalho.
