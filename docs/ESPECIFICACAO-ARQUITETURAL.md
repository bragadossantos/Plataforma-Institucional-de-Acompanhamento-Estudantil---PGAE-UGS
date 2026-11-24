# Especificação Arquitetural e de Segurança — Plataforma GAE (UGS)

> **Sistema Institucional de Acompanhamento Estudantil, Auditoria de Sala de Aula e BI Académico**  
> **Instituição:** Universidade Gregório Semedo (UGS) — Departamento GAE (Grupo de Acompanhamento Estudantil)  
> **Origem Tecnológica:** Clone e evolução do repositório **FENT Fest** (`Next.js 16` + `PostgreSQL/Neon`)  
> **Data da Especificação:** 23 de novembro de 2026  
> **Versão:** 1.0 (MVP Enxuto — Abordagem 1 · Sprint de 4 Dias)

---

## 1. Visão Geral, Escopo e Objetivos

### 1.1 Propósito do Sistema
A **Plataforma GAE** digitaliza e formaliza o elo de comunicação entre as salas de aula da Universidade Gregório Semedo e a Direção da Universidade. O sistema permite que o **Grupo de Acompanhamento Estudantil (GAE)** audite continuamente a qualidade pedagógica, recolha avaliações anónimas sobre o desempenho docente e transforme esses registos num painel de **Business Intelligence (BI)** automatizado para tomada de decisão institucional.

Simultaneamente, a plataforma fornece à equipa criadora do **FENT Fest** acesso controlado e anonimizado às principais dores e inquietações estruturais dos estudantes, convertendo problemas reais da universidade em desafios oficiais do Hackathon e projetos tecnológicos públicos.

### 1.2 O que está DENTRO do Escopo (MVP de 4 Dias)
1. **Gestão Estrutural pelo GAE:** Cadastro centralizado de Faculdades, Cursos, Classes/Anos ($1.^{\circ}$ ao $5.^{\circ}$), Turmas (limite rígido de até 4 turmas por classe/curso), Docentes, Disciplinas e Liderança de Turma (até 3 membros: Delegado, Subdelegado e Secretário).
2. **Votação Docente 100% Anónima por Código de Turma:** Acesso rápido via telemóvel (sem criação de conta individual pelo aluno) com garantia criptográfica contra votos duplicados e contra identificação do votante.
3. **Auditoria de Sala de Aula pela Liderança de Turma:** Registo autenticado e factual de ocorrências pedagógicas, assiduidade, qualidade das avaliações e infraestrutura.
4. **Dashboard de BI e Exportação Executiva:** Indicadores em tempo real (Docentes Destaque, Alertas Críticos, Participação por Faculdade) e exportação imediata de relatórios em **PDF** e **CSV** para a Direção da UGS.
5. **Painel de Desafios FENT Fest:** Vista isolada de leitura que exibe apenas inquietações e problemas académicos agregados e aprovados para criação de soluções no FENT Fest.

### 1.3 O que está FORA do Escopo (Regra YAGNI)
* Auto-registo aberto de estudantes ou professores (bloqueado por segurança).
* Chat em tempo real, fóruns públicos ou redes sociais internas.
* Lançamento de notas académicas, propinas ou integração com ERP financeiro da UGS.
* Aplicação móvel nativa (a plataforma é *Web Mobile-First / PWA-ready*).

---

## 2. Arquitetura do Sistema e Reutilização do FENT Fest

### 2.1 Stack Tecnológica (100% Herdada do FENT Fest)
Para cumprir o prazo de **4 dias** sem introduzir riscos de infraestrutura, a plataforma reutiliza integralmente a stack já testada do projeto FENT Fest:

| Camada | Tecnologia | Papel na Plataforma GAE |
| :--- | :--- | :--- |
| **Framework Full-Stack** | Next.js 16 (App Router + Server Actions) | Rotas separadas por perfil, renderização SSR segura e mutações validadas no servidor. |
| **Interface (UI)** | React 19 + Tailwind CSS 4 | Design system limpo, responsivo e mobile-first herdado do FENT Fest. |
| **Validação de Dados** | Zod | Validação estrita de formulários, parâmetros de API e sanitização de inputs. |
| **Base de Dados** | PostgreSQL (Neon Serverless) via cliente `postgres` | Persistência relacional com transações ACID e queries parametrizadas. |
| **Segurança & Cripto** | Node.js `crypto` nativo (`scrypt`, `HMAC-SHA256`, `timingSafeEqual`) | Hashing de palavras-passe, tokens de sessão e anonimização de votos sem dependências externas frágeis. |
| **Alojamento & Deploy** | Vercel | Deploy contínuo com HTTPS/TLS forçado e variáveis de ambiente isoladas. |

### 2.2 Diagrama de Arquitetura Lógica

```text
                        [ Utilizadores — Mobile & Desktop ]
                                         │
          ┌──────────────────────────────┼──────────────────────────────┐
          ▼                              ▼                              ▼
   [ Estudante ]               [ Delegado / GAE ]              [ Equipa FENT Fest ]
  (Código de Turma)             (Login + Cookie)                (Login + Cookie)
          │                              │                              │
          └──────────────────────────────┴──────────────────────────────┘
                                         │ HTTPS (TLS 1.3)
                                         ▼
              ┌─────────────────────────────────────────────────────┐
              │           Vercel Edge / Next.js 16 Proxy            │
              │  • Security Headers (CSP, HSTS, X-Frame-Options)    │
              │  • Rate Limiter (Campus Wi-Fi Aware)                │
              │  • Proteção de Rotas (/gae, /delegado, /insights)   │
              └──────────────────────────┬──────────────────────────┘
                                         │
              ┌──────────────────────────▼──────────────────────────┐
              │       Camada de Aplicação (Server Actions & API)    │
              │  • Validação Zod + Honeypot                         │
              │  • RBAC Guard (requireRole + requireTurmaScope)     │
              │  • Motor de Voto Cego (HMAC Nullifier em RAM)       │
              │  • Motor de BI (Cálculo de IDD + Regra k >= 5)      │
              │  • Gerador de Relatórios (PDF / CSV)                │
              └──────────────────────────┬──────────────────────────┘
                                         │ SQL Parametrizado (TLS)
                                         ▼
              ┌─────────────────────────────────────────────────────┐
              │            PostgreSQL (Neon Database)               │
              │  [Estrutura Académica]  [Auditoria & Logs]          │
              │  [votos_controlo]  ≠≠≠  [votos_docentes] (Isolado)  │
              └─────────────────────────────────────────────────────┘
```

### 2.3 Estrutura de Pastas (Mapa de Clone do FENT Fest)
A organização abaixo adapta o repositório do FENT Fest mantendo os módulos isolados e fáceis de manter:

```text
gae-ugs/
├── app/
│   ├── layout.tsx                      # Reutilizado: Fontes Space Grotesk, IBM Plex Sans & Mono
│   ├── globals.css                     # Reutilizado: Tokens de cor FENT Fest + cores semânticas BI
│   ├── page.tsx                        # Portal de entrada (Acesso rápido: Votar com Código | Entrar)
│   ├── login/page.tsx                  # Autenticação única (GAE, Liderança de Turma, FENT Observer)
│   ├── votar/
│   │   ├── page.tsx                    # Entrada do Código de Turma + validação do aluno
│   │   └── [cicloId]/page.tsx          # Fluxo mobile-first de avaliação docente + inquietações
│   ├── delegado/
│   │   ├── page.tsx                    # Painel da Turma (Código ativo, taxa de adesão, histórico)
│   │   └── auditoria/page.tsx          # Formulário de auditoria de sala de aula e ocorrências
│   ├── gae/                            # Evolução do antigo /admin do FENT Fest
│   │   ├── page.tsx                    # Dashboard de BI (KPIs, Rankings, Alertas Críticos)
│   │   ├── estrutura/page.tsx          # Gestão de Faculdades, Cursos, Turmas (máx. 4) e Docentes
│   │   ├── utilizadores/page.tsx       # Cadastro de Delegados/Subdelegados/Secretários e Equipa GAE
│   │   ├── ciclos/page.tsx             # Abertura/Fecho de ciclos e rotação de códigos de turma
│   │   ├── auditorias/page.tsx         # Triagem de ocorrências de sala de aula + flag FENT Fest
│   │   └── relatorios/page.tsx         # Pré-visualização e exportação PDF/CSV para Direção UGS
│   ├── insights/                       # Exclusivo para perfil FENT_OBSERVER e GAE_ADMIN
│   │   └── page.tsx                    # Banco de Problemas & Inquietações (Input para Hackathon)
│   └── api/
│       └── export/
│           ├── csv/route.ts            # Exportação CSV protegida por RBAC e registada em audit_logs
│           └── pdf/route.ts            # Relatório imprimível/PDF para a Reitoria/Direção
├── lib/
│   ├── db.ts                           # Reutilizado: Pool de conexão Neon (`postgres`)
│   ├── auth.ts                         # Sessões HTTP-only, scrypt hashing, RBAC guards
│   ├── crypto-vote.ts                  # Geração de Nullifier HMAC-SHA256 para voto cego
│   ├── rate-limit.ts                   # Reutilizado e expandido: Limites de campus Wi-Fi e login
│   ├── validators.ts                   # Schemas Zod centralizados para todas as entidades
│   ├── bi-metrics.ts                   # Fórmulas de BI e filtro de k-anonimato (k >= 5)
│   └── audit.ts                        # Logger imutável de ações administrativas
└── db/
    └── schema.sql                      # DDL completo da base de dados (Secção 3)
```

---

## 3. Modelo de Dados Relacional (PostgreSQL / Neon)

O esquema abaixo garante integridade referencial rigorosa, impõe o limite estrutural de **4 turmas por classe/curso** e **3 cargos de liderança por turma**, e separa fisicamente o controlo de voto do conteúdo do voto.

```sql
-- =====================================================================
-- 1. ESTRUTURA ACADÉMICA DA UGS
-- =====================================================================

CREATE TABLE faculdades (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL UNIQUE,
    sigla VARCHAR(20) NOT NULL UNIQUE,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cursos (
    id SERIAL PRIMARY KEY,
    faculdade_id INTEGER NOT NULL REFERENCES faculdades(id) ON DELETE RESTRICT,
    nome VARCHAR(150) NOT NULL,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (faculdade_id, nome)
);

-- Regra de Negócio: Máximo de 4 turmas (A, B, C, D) por Curso + Ano + Semestre
CREATE TABLE turmas (
    id SERIAL PRIMARY KEY,
    curso_id INTEGER NOT NULL REFERENCES cursos(id) ON DELETE RESTRICT,
    ano_curricular SMALLINT NOT NULL CHECK (ano_curricular BETWEEN 1 AND 5),
    designacao CHAR(1) NOT NULL CHECK (designacao IN ('A', 'B', 'C', 'D')),
    periodo VARCHAR(20) NOT NULL CHECK (periodo IN ('MANHA', 'TARDE', 'NOITE')),
    semestre_letivo VARCHAR(20) NOT NULL, -- Ex.: '2026-S2'
    codigo_acesso VARCHAR(16) NOT NULL UNIQUE, -- Ex.: 'EI3A-7K9P' (rotacionável pelo GAE)
    codigo_ativo BOOLEAN NOT NULL DEFAULT TRUE,
    total_estimado_alunos SMALLINT NOT NULL DEFAULT 40 CHECK (total_estimado_alunos BETWEEN 5 AND 150),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (curso_id, ano_curricular, designacao, semestre_letivo)
);

CREATE TABLE docentes (
    id SERIAL PRIMARY KEY,
    nome_completo VARCHAR(150) NOT NULL,
    codigo_docente VARCHAR(40) UNIQUE,
    grau_academico VARCHAR(40), -- Licenciado, Mestre, Doutor
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Associa exatamente quais docentes lecionam em cada turma
CREATE TABLE turma_docentes (
    id SERIAL PRIMARY KEY,
    turma_id INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    docente_id INTEGER NOT NULL REFERENCES docentes(id) ON DELETE RESTRICT,
    disciplina VARCHAR(150) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (turma_id, docente_id, disciplina)
);

-- =====================================================================
-- 2. UTILIZADORES, HIERARQUIA E CONTROLOS DE ACESSO (RBAC)
-- =====================================================================

CREATE TYPE user_role AS ENUM (
    'GAE_ADMIN',       -- Gestão total do GAE + cadastro de utilizadores + BI
    'GAE_ANALISTA',    -- Leitura BI + triagem de auditorias + exportação relatórios
    'DELEGADO',        -- Liderança principal da turma
    'SUBDELEGADO',     -- Liderança secundária da turma
    'SECRETARIO',      -- Apoio de registo da turma
    'FENT_OBSERVER'    -- Leitura exclusiva de inquietações agregadas para o FENT Fest
);

CREATE TABLE utilizadores (
    id SERIAL PRIMARY KEY,
    nome_completo VARCHAR(150) NOT NULL,
    identificador VARCHAR(120) NOT NULL UNIQUE, -- E-mail institucional ou n.º de estudante/func.
    password_hash TEXT NOT NULL,                -- Formato: scrypt:<salt_hex>:<hash_hex>
    role user_role NOT NULL,
    turma_id INTEGER REFERENCES turmas(id) ON DELETE SET NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    session_version INTEGER NOT NULL DEFAULT 1, -- Incrementar para revogar sessões imediatamente
    tentativas_falhadas SMALLINT NOT NULL DEFAULT 0,
    bloqueado_ate TIMESTAMPTZ,
    criado_por INTEGER REFERENCES utilizadores(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Garante que cargos de turma têm obrigatoriamente uma turma vinculada
    CONSTRAINT chk_lideranca_tem_turma CHECK (
        (role IN ('DELEGADO', 'SUBDELEGADO', 'SECRETARIO') AND turma_id IS NOT NULL)
        OR (role NOT IN ('DELEGADO', 'SUBDELEGADO', 'SECRETARIO') AND turma_id IS NULL)
    )
);

-- Regra de Negócio: Máximo 1 Delegado, 1 Subdelegado e 1 Secretário ativos por Turma (máx. 3)
CREATE UNIQUE INDEX uq_cargo_lideranca_ativo_por_turma
ON utilizadores (turma_id, role)
WHERE ativo = TRUE AND role IN ('DELEGADO', 'SUBDELEGADO', 'SECRETARIO');

-- =====================================================================
-- 3. CICLOS E VOTAÇÃO DOCENTE ANÓNIMA (SEPARAÇÃO CRIPTOGRÁFICA)
-- =====================================================================

CREATE TABLE ciclos_avaliacao (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(120) NOT NULL,               -- Ex.: 'Avaliação Intermédia 2.º Semestre 2026'
    semestre_letivo VARCHAR(20) NOT NULL,
    data_inicio TIMESTAMPTZ NOT NULL,
    data_fim TIMESTAMPTZ NOT NULL,
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('RASCUNHO', 'ATIVO', 'ENCERRADO')) DEFAULT 'RASCUNHO',
    criado_por INTEGER NOT NULL REFERENCES utilizadores(id),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABELA A: Controlo de unicidade (NUNCA contém notas nem FK para votos_docentes)
CREATE TABLE votos_controlo (
    id BIGSERIAL PRIMARY KEY,
    ciclo_id INTEGER NOT NULL REFERENCES ciclos_avaliacao(id) ON DELETE CASCADE,
    turma_docente_id INTEGER NOT NULL REFERENCES turma_docentes(id) ON DELETE CASCADE,
    nullifier_hash CHAR(64) NOT NULL UNIQUE -- HMAC-SHA256(id_aluno_norm | turma_docente_id | ciclo_id, PEPPER)
);

-- TABELA B: Conteúdo do voto 100% anónimo (sem ID de aluno, sem IP, sem hora exata)
CREATE TABLE votos_docentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ciclo_id INTEGER NOT NULL REFERENCES ciclos_avaliacao(id) ON DELETE CASCADE,
    turma_docente_id INTEGER NOT NULL REFERENCES turma_docentes(id) ON DELETE CASCADE,
    nota_didatica SMALLINT NOT NULL CHECK (nota_didatica BETWEEN 1 AND 5),
    nota_avaliacao SMALLINT NOT NULL CHECK (nota_avaliacao BETWEEN 1 AND 5),
    nota_pontualidade SMALLINT NOT NULL CHECK (nota_pontualidade BETWEEN 1 AND 5),
    nota_comunicacao SMALLINT NOT NULL CHECK (nota_comunicacao BETWEEN 1 AND 5),
    comentario_curto VARCHAR(400),
    data_registo DATE NOT NULL DEFAULT CURRENT_DATE -- Truncado ao dia para impedir correlação temporal
);

CREATE INDEX idx_votos_docentes_ciclo_td ON votos_docentes (ciclo_id, turma_docente_id);

-- =====================================================================
-- 4. AUDITORIA DE SALA DE AULA (LIDERANÇA DE TURMA -> GAE)
-- =====================================================================

CREATE TABLE auditorias_sala (
    id SERIAL PRIMARY KEY,
    turma_id INTEGER NOT NULL REFERENCES turmas(id) ON DELETE RESTRICT,
    turma_docente_id INTEGER REFERENCES turma_docentes(id) ON DELETE SET NULL,
    autor_id INTEGER NOT NULL REFERENCES utilizadores(id) ON DELETE RESTRICT,
    categoria VARCHAR(30) NOT NULL CHECK (
        categoria IN ('DIDATICA', 'AVALIACAO', 'ASSIDUIDADE', 'INFRAESTRUTURA', 'CONDUTA', 'OUTRO')
    ),
    gravidade VARCHAR(15) NOT NULL CHECK (gravidade IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')),
    titulo VARCHAR(140) NOT NULL,
    descricao_factual TEXT NOT NULL,
    evidencia_url TEXT,
    estado VARCHAR(25) NOT NULL CHECK (
        estado IN ('NOVO', 'EM_ANALISE', 'ENCAMINHADO_DIRECAO', 'RESOLVIDO', 'ARQUIVADO')
    ) DEFAULT 'NOVO',
    parecer_gae TEXT,
    elegivel_fentfest BOOLEAN NOT NULL DEFAULT FALSE, -- Só o GAE pode aprovar para o banco de desafios
    resumo_anonimizado_fentfest VARCHAR(300),         -- Texto limpo sem nomes de docentes/alunos
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 5. INQUIETAÇÕES ESTUDANTIS (ALIMENTAÇÃO DIRETA DO FENT FEST)
-- =====================================================================

CREATE TABLE inquietacoes_estudantis (
    id SERIAL PRIMARY KEY,
    ciclo_id INTEGER REFERENCES ciclos_avaliacao(id) ON DELETE SET NULL,
    turma_id INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    categoria VARCHAR(30) NOT NULL CHECK (
        categoria IN ('ACADEMICO', 'LABORATORIOS', 'SECRETARIA', 'HORARIOS', 'INFRAESTRUTURA', 'TECNOLOGIA')
    ),
    descricao VARCHAR(400) NOT NULL,
    visivel_fentfest BOOLEAN NOT NULL DEFAULT FALSE, -- Aprovado na curadoria do GAE (sem dados pessoais)
    data_registo DATE NOT NULL DEFAULT CURRENT_DATE
);

-- =====================================================================
-- 6. TRILHA DE AUDITORIA DE SEGURANÇA (IMUTÁVEL)
-- =====================================================================

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES utilizadores(id) ON DELETE SET NULL,
    actor_role VARCHAR(30) NOT NULL,
    acao VARCHAR(80) NOT NULL,      -- Ex.: 'CRIAR_DELEGADO', 'EXPORTAR_PDF_DIRECAO', 'RODAR_CODIGO_TURMA'
    entidade VARCHAR(50) NOT NULL,
    entidade_id VARCHAR(50),
    ip_hash CHAR(64),               -- SHA-256(IP + IP_SALT)
    metadados JSONB NOT NULL DEFAULT '{}'::jsonb,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4. Arquitetura de Segurança Robusta (Zero-Trust Institucional)

Como o sistema lida com dados sensíveis que influenciam a avaliação de docentes e decisões da Reitoria da UGS, a segurança é tratada como requisito estrutural obrigatório em 5 camadas:

### 4.1 Autenticação, Palavras-Passe e Gestão de Sessão
1. **Hashing de Palavras-Passe:** Todas as senhas são cifradas com `crypto.scrypt` ($N = 16384$, $r = 8$, $p = 1$, *keylen* = 64 bytes) e *salt* aleatório único de 16 bytes por utilizador. A comparação usa estritamente `crypto.timingSafeEqual` para anular ataques de *timing*.
2. **Cookies de Sessão Blindados:** Após o login, o servidor emite um token assinado (HMAC-SHA256) armazenado em cookie `HttpOnly`, `Secure`, `SameSite=Lax` e `Path=/`. O JavaScript do browser nunca consegue ler o token (mitigação contra XSS).
3. **Revogação Instantânea (`session_version`):** Se um Delegado perder o mandato ou um membro sair do GAE, basta desativar a conta ou incrementar `session_version` na base de dados; qualquer sessão antiga é rejeitada no pedido seguinte.
4. **Bloqueio Anti-Força Bruta:** Após **5 tentativas falhadas de login**, a conta é bloqueada automaticamente durante **15 minutos** (`bloqueado_ate`), com registo imediato em `audit_logs`.
5. **Troca Obrigatória no 1.º Acesso:** As credenciais provisórias criadas pelo GAE para Delegados obrigam à definição de uma nova palavra-passe (mínimo 8 caracteres com letras e números) antes de abrir o painel.

### 4.2 Matriz de Controlo de Acesso (RBAC)
Todas as *Server Actions* e *Route Handlers* invocam obrigatoriamente `requireAuth(allowedRoles)` e validam o escopo da turma no servidor (nunca confiando em IDs enviados pelo cliente):

| Funcionalidade / Recurso | `GAE_ADMIN` | `GAE_ANALISTA` | `DELEGADO` / `SUB` / `SEC` | `ESTUDANTE` (Código) | `FENT_OBSERVER` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Cadastrar Faculdades, Cursos, Turmas e Docentes | Sim | Não | Não | Não | Não |
| Cadastrar e Revogar Liderança de Turma | Sim | Não | Não | Não | Não |
| Gerar / Rodar Código de Acesso da Turma | Sim | Sim | Leitura (só sua turma) | Não | Não |
| Submeter Voto Anónimo em Docentes | Não | Não | Sim (como estudante) | Sim (só sua turma) | Não |
| Registar Auditoria de Sala de Aula | Não | Não | Sim (só sua turma) | Não | Não |
| Ver Dashboard de BI Docente Completo | Sim | Sim | Resumo adesão (sua turma) | Não | **Bloqueado** |
| Exportar Relatórios PDF/CSV para a Direção | Sim | Sim | Não | Não | **Bloqueado** |
| Aprovar Problemas para o Banco FENT Fest | Sim | Sim | Não | Não | Não |
| Consultar Banco de Problemas/Desafios UGS | Sim | Sim | Não | Não | **Sim (Anonimizado)** |

### 4.3 Garantia Criptográfica de Anonimato do Voto (Anti-Retaliação)
Para que os estudantes confiem na plataforma e respondam com total honestidade sem receio de represálias académicas:
1. **Fluxo de Voto Cego (Blind Nullifier):**
   * O estudante introduz o **Código da Turma** (ex.: `EI3A-7K9P`) e o seu **Identificador de Validação** (ex.: N.º de Estudante da UGS).
   * No servidor, em memória volátil (RAM), calcula-se o *nullifier*:
     $$\text{nullifier\_hash} = \text{HMAC-SHA256}\left(\text{normalize}(\text{id\_estudante}) \parallel \text{turma\_docente\_id} \parallel \text{ciclo\_id},\; \text{VOTE\_PEPPER}\right)$$
   * Numa única transação SQL atómica: o sistema verifica se `nullifier_hash` já existe em `votos_controlo`. Se existir, rejeita como voto duplicado. Se não existir, insere o hash em `votos_controlo` e insere as notas em `votos_docentes` com um `UUID` aleatório e data truncada ao dia (`CURRENT_DATE`), **descartando imediatamente o identificador do aluno da memória**.
2. **Impossibilidade de Correlação:** Como `votos_docentes` usa `UUID` aleatório (não sequencial), não tem `FK` para `votos_controlo` e não guarda hora/minuto/segundo nem endereço IP, nem sequer um administrador da base de dados consegue ligar um aluno específico a uma nota ou comentário.
3. **Proteção por k-Anonimato ($k \ge 5$):** O motor de BI só exibe médias detalhadas e comentários de um docente numa turma quando existirem pelo menos **5 votos válidos** nessa disciplina/ciclo. Abaixo de 5 votos, o painel mostra apenas `"Amostra insuficiente para preservação do anonimato (< 5 votos)"`.

### 4.4 Defesa Contra Abuso em Rede de Campus (Wi-Fi Partilhado UGS)
* **Rate Limiting Adaptativo (Herdado do FENT Fest):** Limite de **40 pedidos por IP a cada 10 minutos** nas rotas de votação (evita bloquear alunos que partilham o mesmo Wi-Fi da UGS) combinado com limite rígido de **5 códigos de turma errados por IP a cada 15 minutos**.
* **Honeypot Invisível:** Campo oculto nos formulários públicos para descartar silenciosamente submissões automatizadas (*bots*).
* **Prevenção de Injeção e XSS:**
  * Consultas SQL 100% parametrizadas via *tagged templates* da biblioteca `postgres`.
  * Validação rigorosa de tipos, tamanhos máximos e remoção de tags HTML via `Zod` em todas as entradas.
  * Cabeçalhos HTTP de segurança configurados em `next.config.ts`: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` e `Strict-Transport-Security`.

### 4.5 Proteção de Dados e Isolamento do FENT Fest
* **Princípio da Minimização (Lei n.º 22/11 de Proteção de Dados Pessoais de Angola):** O sistema recolhe apenas os dados estritamente necessários para a auditoria institucional, com aviso explícito de privacidade no topo da tela de votação.
* **Barreira Rígida para o FENT Fest:** O perfil `FENT_OBSERVER` nunca tem acesso às tabelas `docentes`, `votos_docentes` ou `utilizadores`. As suas consultas lêem apenas registos explicitamente marcados pelo GAE (`elegivel_fentfest = TRUE` ou `visivel_fentfest = TRUE`) e exibem o campo `resumo_anonimizado_fentfest`, garantindo que casos disciplinares internos da UGS nunca saiam do circuito da Direção.

---

## 5. UX/UI e Design System (Simplicidade Extrema)

### 5.1 Identidade Visual (Herdada do FENT Fest com Extensão Institucional)
* **Paleta Base:** Fundo Claro Creme (`#F4F2EC`), Cartões (`#FBFAF6`), Contornos (`#DCD8CC`), Cabeçalhos e Fundos Escuros em Azul-Noite (`#10162B` / `#1A2240`), Ação Principal em Laranja Profundo (`#C2410C` em fundo claro / `#FF6B35` em fundo escuro).
* **Cores Semânticas do BI (Apenas para Status e Alertas):**
  * **Docente Destaque / Resolvido:** Verde Institucional (`#15803D`, fundo `#DCFCE7`).
  * **Atenção / Em Análise:** Âmbar (`#B45309`, fundo `#FEF3C7`).
  * **Alerta Crítico:** Vermelho Sóbrio (`#B91C1C`, fundo `#FEE2E2`).
* **Tipografia:** `Space Grotesk` (500/700) para KPIs e títulos; `IBM Plex Sans` (400/600) para leitura e formulários; `IBM Plex Mono` (500) para códigos de turma, tags e datas.

### 5.2 Regras de Ouro de Usabilidade (UX)
1. **Regra dos 3 Toques na Votação (Alvo: < 90 segundos no telemóvel):**
   * *Ecrã 1:* Inserir Código da Turma + N.º de Estudante (com selo verde visível: *"Voto 100% Anónimo — o teu número serve apenas para validar que és desta turma"*).
   * *Ecrã 2:* Cartões empilhados com os docentes da turma. Cada critério usa 5 botões grandes táteis (`1` a `5`, mínimo `44px × 44px`) em vez de *dropdowns* pequenos.
   * *Ecrã 3:* Campo opcional *"Qual é o maior problema da universidade que gostarias de ver resolvido?"* (alimenta as inquietações) + botão único **"Submeter Avaliação Anónima"**.
2. **Auditoria de Delegado sem Fricção (< 2 minutos):**
   * Formulário guiado em 4 campos obrigatórios: Selecionar Cadeira/Categoria → Selecionar Gravidade (cartões coloridos) → Descrever o facto objetivo → Enviar.
3. **Dashboard de BI Limpo (Zero Sobrecarga Cognitiva):**
   * Topo fixo com **4 cartões KPI** (Taxa de Adesão Global, Média Pedagógica UGS, Docentes em Destaque, Alertas Críticos Abertos).
   * Filtros instantâneos por `Ciclo`, `Faculdade`, `Curso` e `Turma`.
   * Botão de destaque no canto superior direito: **"Exportar Relatório para a Direção (PDF)"**.

---

## 6. Motor de BI do GAE e Fórmulas de Decisão

Para que as decisões reportadas à Direção da UGS sejam 100% objetivas e auditáveis, o sistema calcula automaticamente os indicadores abaixo:

### 6.1 Índice de Desempenho Docente ($IDD$)
Para cada docente $d$ numa turma $t$ com $n \ge 5$ votos válidos no ciclo atual, cada voto $i$ contribui com a média ponderada dos 4 critérios (escala de $1$ a $5$):

$$IDD_{d,t} = \frac{1}{n} \sum_{i=1}^{n} \left( 0.35 \cdot D_i + 0.30 \cdot A_i + 0.20 \cdot P_i + 0.15 \cdot C_i \right)$$

Onde:
* $D_i$ = Clareza e Didática na transmissão de conteúdos ($35\%$).
* $A_i$ = Justiça e coerência nas avaliações e provas ($30\%$).
* $P_i$ = Assiduidade e pontualidade nas aulas ($20\%$).
* $C_i$ = Comunicação e disponibilidade com a turma ($15\%$).

### 6.2 Classificação Automática no Dashboard do GAE
| Faixa do $IDD$ | Classificação no BI | Ação Institucional Sugerida |
| :--- | :--- | :--- |
| $IDD \ge 4.20$ | **Docente Destaque** | Reconhecimento institucional e elegibilidade para prémio anual de excelência. |
| $3.00 \le IDD < 4.20$ | **Desempenho Estável** | Acompanhamento regular sem necessidade de intervenção imediata. |
| $IDD < 3.00$ | **Alerta Pedagógico** | Reunião de acompanhamento com o GAE e reporte prioritário à Direção/Decanato. |

### 6.3 Taxa de Participação da Turma ($TPT$)
Mede a representatividade estatística dos votos de cada turma (usada para cobrar mobilização aos Delegados):

$$TPT_t = \left( \frac{\text{Total de Votos Únicos na Turma } t}{\text{Total Estimado de Alunos na Turma } t} \right) \times 100\%$$

### 6.4 Ponte de Inovação para o FENT Fest
Na fila de triagem do GAE (`/gae/auditorias`), o analista dispõe de um interruptor **"Enviar problema anonimizado para o Banco de Desafios FENT Fest"**. Ao ativar, preenche um resumo impessoal (ex.: *"Dificuldade na consulta de horários atualizados das salas de laboratório da FENT"*). Este registo surge imediatamente no painel `/insights` agrupado por categoria e volume de recorrência, pronto para ser escolhido como desafio oficial do **Hackathon FENT Fest**.

---

## 7. Plano de Execução — Sprint de 4 Dias

Cada dia termina com uma entrega funcional, testada e pronta para demonstração interna:

### Dia 1 — Clone, Base de Dados, Autenticação e Estrutura Académica (6 a 8 horas)
1. **Clonar repositório base do FENT Fest** e configurar variáveis de ambiente (`.env.local`) com nova base Neon PostgreSQL.
2. **Aplicar `db/schema.sql`** e criar script `db/seed.ts` (cria o 1.º `GAE_ADMIN`, 1 `FENT_OBSERVER` e as faculdades/cursos oficiais da UGS).
3. **Implementar `lib/auth.ts` e `lib/audit.ts`:** Login com `scrypt`, cookie `HttpOnly`, revogação por `session_version`, bloqueio após 5 falhas e middlewares RBAC.
4. **Construir `/gae/estrutura` e `/gae/utilizadores`:** CRUD de Faculdades, Cursos, Turmas (com validação de limite de 4 turmas A–D), Docentes e cadastro da Liderança de Turma (máx. 3 por turma).
5. **Critério de Conclusão do Dia 1:** O `GAE_ADMIN` faz login, cria uma turma `EI-3A`, associa 3 professores, cadastra 1 Delegado e o sistema bloqueia a tentativa de criar uma 5.ª turma ou um 2.º Delegado ativo na mesma turma.

### Dia 2 — Motor de Votação Anónima e Painel de Auditoria do Delegado (6 a 8 horas)
1. **Implementar `lib/crypto-vote.ts` e `lib/rate-limit.ts`:** Geração de `nullifier_hash`, transação atómica de voto cego, honeypot e rate limit adaptado ao Wi-Fi da UGS.
2. **Construir `/gae/ciclos`:** Abertura/fecho de ciclos de avaliação e botão de rotação de códigos de turma.
3. **Construir `/votar` (Mobile-First):** Fluxo completo de 3 toques para avaliação de docentes da turma + registo opcional de inquietação estudantil.
4. **Construir `/delegado` e `/delegado/auditoria`:** Painel com visualização do código da turma, medidor de participação ($TPT$) e formulário de auditoria de sala de aula.
5. **Critério de Conclusão do Dia 2:** Um estudante vota nos docentes da sua turma pelo telemóvel; uma segunda tentativa com o mesmo número é bloqueada; a tabela `votos_docentes` não contém qualquer dado identificativo do aluno; o Delegado regista uma ocorrência e esta surge imediatamente na fila do GAE.

### Dia 3 — Dashboard de BI do GAE, Relatórios PDF/CSV e Painel FENT Fest (6 a 8 horas)
1. **Implementar `lib/bi-metrics.ts`:** Cálculo SQL otimizado do $IDD$, $TPT$, rankings e aplicação rigorosa da barreira de $k$-anonimato ($k \ge 5$).
2. **Construir `/gae` (Dashboard BI):** 4 KPIs de topo, filtros dinâmicos (Faculdade/Curso/Turma/Ciclo), tabela de Docentes Destaque e fila de Alertas Críticos.
3. **Construir `/gae/auditorias`:** Gestão de estados das ocorrências (`NOVO` $\rightarrow$ `ENCAMINHADO_DIRECAO` $\rightarrow$ `RESOLVIDO`) + curadoria e anonimização para o FENT Fest.
4. **Adaptar exportação do FENT Fest (`/api/export/pdf` e `/api/export/csv`):** Relatório executivo pronto a imprimir e entregar à Direção da UGS, registando cada exportação em `audit_logs`.
5. **Construir `/insights`:** Painel exclusivo do perfil `FENT_OBSERVER` com ranking de dores da universidade por categoria para o Hackathon.
6. **Critério de Conclusão do Dia 3:** O GAE visualiza rankings reais com $k \ge 5$, exporta um relatório PDF limpo para a Direção e aprova 2 problemas que aparecem no painel `/insights` sem expor qualquer nome de docente ou aluno.

### Dia 4 — Testes de Segurança, Polimento UX Mobile e Deploy em Produção (4 a 6 horas)
1. **Bateria de Testes de Segurança (Secção 8):** Validar todos os bloqueios RBAC, tentativas de voto duplicado, injeção de campos e limites de taxa.
2. **Teste de Usabilidade em Telemóvel Real:** Percorrer o fluxo de votação em ecrã de `360px` (Android) e `390px` (iOS) garantindo tempo total inferior a 90 segundos.
3. **Configurar Cabeçalhos HTTP de Segurança** em `next.config.ts` e verificar ausência de segredos expostos no *bundle* cliente.
4. **Deploy na Vercel** com variáveis de produção (`DATABASE_URL`, `SESSION_SECRET`, `VOTE_PEPPER`, `IP_SALT`) e validação final em ambiente ao vivo.
5. **Entrega Operacional:** Criar guia rápido de 1 página para a equipa do GAE (como abrir ciclos, cadastrar delegados e rodar códigos de turma).

---

## 8. Plano de Validação de Segurança e Checklist de Go-Live

Antes de entregar o link oficial ao departamento do GAE, todos os 8 testes abaixo têm de passar com 100% de conformidade:

| # | Cenário de Teste de Segurança / Requisito | Resultado Esperado (Obrigatório) |
| :--- | :--- | :--- |
| **T1** | **Escalada de Privilégio:** Um `DELEGADO` tenta invocar a Server Action de criar turma ou aceder a `/gae`. | Rejeitado no servidor (`403 Forbidden`) e tentativa registada em `audit_logs`. |
| **T2** | **Acesso Cruzado de Turma:** Delegado da Turma `A` altera o `turma_id` no payload para enviar auditoria da Turma `B`. | Rejeitado (`403 Forbidden`); o servidor usa sempre `session.turma_id`, ignorando o payload. |
| **T3** | **Voto Duplicado:** Estudante vota no Docente X e tenta votar novamente alterando maiúsculas ou espaços no seu número/nome. | Bloqueado pela normalização + índice `UNIQUE(nullifier_hash)` em `votos_controlo`. |
| **T4** | **Auditoria de Anonimato:** Inspecionar diretamente a tabela `votos_docentes` no Neon após 10 votos. | Zero colunas com nome, número de estudante, IP ou hora exata; impossível cruzar com `votos_controlo`. |
| **T5** | **Barreira $k$-Anonimato:** Docente recebe apenas 3 votos no ciclo. | Dashboard do GAE oculta média individual e comentários, exibindo aviso de amostra $< 5$. |
| **T6** | **Isolamento FENT Fest:** Perfil `FENT_OBSERVER` tenta aceder a `/gae`, `/api/export/pdf` ou ler avaliações docentes. | Rejeitado (`403 Forbidden`); acesso restrito exclusivamente a `/insights`. |
| **T7** | **Limites Estruturais UGS:** Tentar cadastrar 5.ª turma (`E`) no mesmo ano/curso ou 4.º cargo de liderança na mesma turma. | Rejeitado tanto pelo `Zod` quanto pelas `CONSTRAINTS` nativas do PostgreSQL. |
| **T8** | **Revogação Imediata:** `GAE_ADMIN` desativa a conta de um Delegado com sessão aberta noutro browser. | A próxima ação do Delegado é imediatamente bloqueada e redirecionada para `/login`. |

### Variáveis de Ambiente Obrigatórias na Vercel (Produção)
* `DATABASE_URL` — String de ligação SSL ao PostgreSQL Neon.
* `SESSION_SECRET` — Chave aleatória criptográfica de 64 caracteres hex (assinatura de cookies).
* `VOTE_PEPPER` — Segredo exclusivo de 64 caracteres hex para o `HMAC-SHA256` dos votos (nunca guardar na base de dados).
* `IP_SALT` — Segredo de 32 caracteres hex para anonimização de IPs em `rate-limit` e `audit_logs`.
* `NODE_ENV=production` — Ativa cookies `Secure` e oculta *stack traces*.