-- ============================================================
-- AGENDA ETHOS — Migration 0001_init.sql
-- SaaS de Agendamento via WhatsApp (agenda.ethoscursos.com.br)
-- ============================================================
-- Responsável: Expert Banco de Dados (Ethos Cursos)
-- Data: 2026-10-17
-- Versão: 1.0
-- Status: Proposta para validação do arquiteto (não aplicar antes da aprovação)
--
-- Referências canônicas:
--   RDA v16 — Seções 8, 9 (Nível 1 e 2), 11, 16.1, 16.3
--   Briefing Expert Banco de Dados v3.0 — Seções 9.1, 9.2, 9.3, 9.5, 9.6
--
-- Decisões do arquiteto (2026-10-17):
--   D1: Cliente global — telefone único no sistema inteiro, sem profissional_id.
--   D2: Antecedência mínima e política de cancelamento = PENDÊNCIA (fora do DDL).
--   D3: Retenção — histórico indefinido no MVP, sem limpeza automática.
--
-- Suposições documentadas (validar na revisão):
--   S1: profissional.status IN ('ativo','inativo'), DEFAULT 'ativo'.
--   S2: profissional.email UNIQUE (login do painel — Seção 16.3).
--   S3: dia_semana 0 = domingo (alinhado a JS Date.getDay()).
--   S4: múltiplos intervalos por dia da semana permitidos (sem UNIQUE em
--       horario_atendimento) — pendente de decisão do arquiteto.
--   S5: timestamps (criado_em/created_at/updated_at) preenchidos pela
--       aplicação em ISO-8601 UTC — sem DEFAULT no banco, para preservar
--       a portabilidade ao PostgreSQL (Seção 9.1).
--   S6: FKs declaradas no DDL; ativação via PRAGMA foreign_keys=ON na
--       sessão do Worker (operacional — Expert Cloudflare, não altera o schema).
--   S7: convenção de timestamp — criado_em onde o modelo (Seção 11) nomeia
--       (profissional, cliente, agendamento); created_at/updated_at nas
--       demais (servico, horario_atendimento). Modelo prevalece (9.3).
--
-- Nota de idempotência: migrations são controladas pelo wrangler
-- (aplicadas uma vez por banco). Sem CREATE IF NOT EXISTS de propósito —
-- evita mascarar erros reais ao custo de não ser re-executável à mão.
-- Fora do escopo MVP: Bloqueio (fase 2) e Conversa (KV, nunca D1 — 9.6).
-- ============================================================

CREATE TABLE profissional (
    id                INTEGER PRIMARY KEY,
    nome              TEXT    NOT NULL,
    telefone_whatsapp TEXT    NOT NULL UNIQUE,
    email             TEXT    NOT NULL UNIQUE,
    senha_hash        TEXT    NOT NULL,
    status            TEXT    NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
    criado_em         TEXT    NOT NULL
);

CREATE TABLE servico (
    id              INTEGER PRIMARY KEY,
    profissional_id INTEGER NOT NULL REFERENCES profissional(id),
    nome            TEXT    NOT NULL,
    descricao       TEXT,
    duracao_minutos INTEGER NOT NULL CHECK (duracao_minutos > 0),
    preco           REAL,                                  -- fase 2 (Seção 11); nullable no MVP
    ativo           INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL
);

CREATE INDEX idx_servico_profissional_ativo
    ON servico (profissional_id, ativo);

CREATE TABLE horario_atendimento (
    id              INTEGER PRIMARY KEY,
    profissional_id INTEGER NOT NULL REFERENCES profissional(id),
    dia_semana      INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_inicio     TEXT    NOT NULL,                      -- 'HH:MM' 24h, zero à esquerda
    hora_fim        TEXT    NOT NULL,                      -- 'HH:MM' 24h, zero à esquerda
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    CHECK (hora_inicio < hora_fim)
);

CREATE INDEX idx_horario_atendimento_profissional_dia
    ON horario_atendimento (profissional_id, dia_semana);

CREATE TABLE cliente (
    id         INTEGER PRIMARY KEY,
    nome       TEXT    NOT NULL,
    telefone   TEXT    NOT NULL UNIQUE,                    -- E.164, global (D1)
    criado_em  TEXT    NOT NULL
);

CREATE TABLE agendamento (
    id                  INTEGER PRIMARY KEY,
    profissional_id     INTEGER NOT NULL REFERENCES profissional(id),
    cliente_id          INTEGER NOT NULL REFERENCES cliente(id),
    servico_id          INTEGER NOT NULL REFERENCES servico(id),
    data_hora_inicio    TEXT    NOT NULL,                  -- ISO-8601 UTC
    data_hora_fim       TEXT    NOT NULL,                  -- ISO-8601 UTC
    status              TEXT    NOT NULL DEFAULT 'confirmado'
                        CHECK (status IN ('confirmado','cancelado','concluido','no_show')),
    criado_em           TEXT    NOT NULL,
    cancelado_em        TEXT,
    motivo_cancelamento TEXT,
    CHECK (data_hora_inicio < data_hora_fim)
);

-- Padrão (a): disponibilidade — slots ocupados (confirmados) de um profissional num dia
CREATE INDEX idx_agendamento_profissional_status_inicio
    ON agendamento (profissional_id, status, data_hora_inicio);

-- Padrão (b): agendamentos do profissional num período, qualquer status (painel)
CREATE INDEX idx_agendamento_profissional_inicio
    ON agendamento (profissional_id, data_hora_inicio);

-- Padrão (c): cliente por telefone — coberto pelo UNIQUE(telefone) em cliente.