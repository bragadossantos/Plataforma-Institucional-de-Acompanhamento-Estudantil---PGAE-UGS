-- =====================================================================
-- PGAE — Esquema PostgreSQL (fonte: docs/ESPECIFICACAO-ARQUITETURAL.md, secção 3)
-- Divergência registada: utilizadores.must_change_password (secção 4.1, ponto 5).
-- =====================================================================

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
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE, -- Troca obrigatória no 1.º acesso (secção 4.1)
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
