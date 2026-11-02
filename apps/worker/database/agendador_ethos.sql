-- ============================================================
-- AGENDADOR ETHOS — Pacote SQL Consolidado (Migration + Queries)
-- Repositório: github.com/ethoscursos/agendador-ethos
-- ============================================================
-- Responsável: Expert Banco de Dados (Ethos Cursos)
-- Data: 22 de outubro de 2026
-- Versão: 1.0
-- Status: Parte A aprovada (retorno v1.2) + adição Q8 (Parte B v1.0)
--
-- Referências canônicas:
--   RDA v21 (Seções 8, 9, 10, 11, 16.1, 16.3, 21.1)
--   Briefing Expert Banco de Dados v3.2
--   Retorno agenda_ethos_revisao_banco_dados_v1.2 (Aprovado)
--   Retorno agenda_ethos_parte_b_banco_dados_v1.0
--
-- Decisões do arquiteto:
--   D1: Cliente global — telefone único no sistema inteiro, sem
--       profissional_id em cliente.
--   D2: Antecedência mínima e política de cancelamento = pendência,
--       parametrizadas no domínio TypeScript (fora deste SQL).
--   D3: Retenção indefinida no MVP — sem limpeza automática.
--
-- Nota de idempotência: migrations controladas pelo wrangler
-- (aplicadas uma vez por banco). Sem CREATE IF NOT EXISTS de
-- propósito — evita mascarar erros reais.
-- ============================================================

-- ============================================================
-- PARTE 1 — MIGRATION 0001_init.sql
-- Aplicar via: wrangler d1 migrations apply
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
    preco           REAL,
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
    hora_inicio     TEXT    NOT NULL,
    hora_fim        TEXT    NOT NULL,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    CHECK (hora_inicio < hora_fim)
);

CREATE INDEX idx_horario_atendimento_profissional_dia
    ON horario_atendimento (profissional_id, dia_semana);

CREATE TABLE cliente (
    id         INTEGER PRIMARY KEY,
    nome       TEXT    NOT NULL,
    telefone   TEXT    NOT NULL UNIQUE,
    criado_em  TEXT    NOT NULL
);

CREATE TABLE agendamento (
    id                  INTEGER PRIMARY KEY,
    profissional_id     INTEGER NOT NULL REFERENCES profissional(id),
    cliente_id          INTEGER NOT NULL REFERENCES cliente(id),
    servico_id          INTEGER NOT NULL REFERENCES servico(id),
    data_hora_inicio    TEXT    NOT NULL,
    data_hora_fim       TEXT    NOT NULL,
    status              TEXT    NOT NULL DEFAULT 'confirmado'
                        CHECK (status IN ('confirmado','cancelado','concluido','no_show')),
    criado_em           TEXT    NOT NULL,
    cancelado_em        TEXT,
    motivo_cancelamento TEXT,
    CHECK (data_hora_inicio < data_hora_fim)
);

CREATE INDEX idx_agendamento_profissional_status_inicio
    ON agendamento (profissional_id, status, data_hora_inicio);

CREATE INDEX idx_agendamento_profissional_inicio
    ON agendamento (profissional_id, data_hora_inicio);

-- ============================================================
-- PARTE 2 — QUERIES DE DISPONIBILIDADE E AGENDAMENTO (Q1–Q7)
-- Parâmetros nomeados (:param) — D1 e PostgreSQL
-- ============================================================

-- Q1 — Horários de atendimento do dia (disponibilidade, passo 1)
-- Estados SELECAO_DIA / SELECAO_HORARIO
-- Coberta por idx_horario_atendimento_profissional_dia
SELECT id, hora_inicio, hora_fim
FROM horario_atendimento
WHERE profissional_id = :profissional_id
  AND dia_semana = :dia_semana
ORDER BY hora_inicio;

-- Q2 — Agendamentos confirmados que ocupam o dia (disponibilidade, passo 2)
-- Fronteiras do dia em ISO-8601 UTC: :inicio_do_dia e :inicio_proximo_dia
-- Condição de toque: inicio < fim_do_dia AND fim > inicio_do_dia
-- Coberta por idx_agendamento_profissional_status_inicio
SELECT data_hora_inicio, data_hora_fim
FROM agendamento
WHERE profissional_id = :profissional_id
  AND status = 'confirmado'
  AND data_hora_inicio < :inicio_proximo_dia
  AND data_hora_fim > :inicio_do_dia
ORDER BY data_hora_inicio;

-- Q3 — Verificar conflito de slot (estado CONFIRMACAO)
-- Retorna 0 (livre) ou >0 (ocupado)
SELECT COUNT(*) AS conflitos
FROM agendamento
WHERE profissional_id = :profissional_id
  AND status = 'confirmado'
  AND data_hora_inicio < :fim
  AND data_hora_fim > :inicio;

-- Q4 — Criar agendamento com checagem de conflito (atômico)
-- INSERT...SELECT...WHERE NOT EXISTS: 1 linha = sucesso, 0 = conflito
-- data_hora_fim calculado no domínio (inicio + duracao_minutos)
INSERT INTO agendamento
  (profissional_id, cliente_id, servico_id,
   data_hora_inicio, data_hora_fim, status, criado_em)
SELECT
  :profissional_id, :cliente_id, :servico_id,
  :inicio, :fim, 'confirmado', :criado_em
WHERE NOT EXISTS (
  SELECT 1 FROM agendamento
  WHERE profissional_id = :profissional_id
    AND status = 'confirmado'
    AND data_hora_inicio < :fim
    AND data_hora_fim > :inicio
);

-- Q5 — Listar agendamentos do dia (painel do profissional)
-- Coberta por idx_agendamento_profissional_inicio
SELECT
  a.id, a.data_hora_inicio, a.data_hora_fim,
  a.status, a.motivo_cancelamento,
  c.nome AS cliente_nome, c.telefone AS cliente_telefone,
  s.nome AS servico_nome, s.duracao_minutos
FROM agendamento a
JOIN cliente c ON c.id = a.cliente_id
JOIN servico s ON s.id = a.servico_id
WHERE a.profissional_id = :profissional_id
  AND a.data_hora_inicio >= :inicio_do_dia
  AND a.data_hora_inicio < :inicio_proximo_dia
ORDER BY a.data_hora_inicio;

-- Q6 — Cancelar agendamento (pelo profissional, painel)
-- profissional_id no WHERE garante isolamento multi-tenant
UPDATE agendamento
SET status = 'cancelado',
    cancelado_em = :cancelado_em,
    motivo_cancelamento = :motivo
WHERE id = :id
  AND profissional_id = :profissional_id
  AND status = 'confirmado';

-- Q7 — Buscar/inserir cliente por telefone (cliente global — D1)
-- ON CONFLICT válido no SQLite e no PostgreSQL
SELECT id, nome, telefone, criado_em
FROM cliente
WHERE telefone = :telefone;

INSERT INTO cliente (nome, telefone, criado_em)
VALUES (:nome, :telefone, :criado_em)
ON CONFLICT (telefone) DO NOTHING;

-- ============================================================
-- PARTE 3 — Q8: LEMBRETES (ADIÇÃO — RDA v21, Seção 21.1)
-- Alimenta o cron 0 8 * * * (America/Sao_Paulo)
-- Janela = dia seguinte em UTC (:inicio_proximo_dia e
-- :inicio_do_dia_seguinte)
-- Coberta por idx_agendamento_profissional_status_inicio
-- Dedup no LEMBRETE_KV: responsabilidade do Expert Cloudflare
-- ============================================================

-- Q8 — Listar agendamentos confirmados do dia seguinte
-- Pode ser executada por profissional (adicionar
--   AND a.profissional_id = :profissional_id)
-- ou globalmente pelo cron iterando profissionais ativos
SELECT a.id, a.profissional_id, a.data_hora_inicio,
       c.telefone AS cliente_telefone, c.nome AS cliente_nome,
       s.nome AS servico_nome
FROM agendamento a
JOIN cliente c ON c.id = a.cliente_id
JOIN servico s ON s.id = a.servico_id
WHERE a.status = 'confirmado'
  AND a.data_hora_inicio >= :inicio_proximo_dia
  AND a.data_hora_inicio < :inicio_do_dia_seguinte
ORDER BY a.data_hora_inicio;
