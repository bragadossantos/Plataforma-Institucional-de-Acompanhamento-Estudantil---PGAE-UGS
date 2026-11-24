-- Limites de pedidos por IP (hash) em janelas fixas. Partilhado entre instâncias serverless.
-- Reversão: DROP TABLE rate_limits;
CREATE TABLE IF NOT EXISTS rate_limits (
    chave TEXT NOT NULL,                 -- ex.: 'voto:<ip_hash>' ou 'codigo:<ip_hash>'
    janela_inicio TIMESTAMPTZ NOT NULL,
    contagem INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (chave, janela_inicio)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_janela ON rate_limits (janela_inicio);
