-- 0003_seed_profissional.sql
-- Conta de teste Ethos (MVP) — seed do primeiro profissional
-- Aplicar via: wrangler d1 migrations apply
INSERT INTO profissional (nome, telefone_whatsapp, email, senha_hash, status, criado_em)
VALUES ('Ethos Cursos', '5511970570281', 'ethoscursos.ead@gmail.com', 'pbkdf2$100000$-iuka28CJcx04fBoeM7spg$id7CTksCv7x5uLLrGd4fUWvhxqa4afzGFcMYMu4mrd4', 'ativo', '2026-11-02T00:00:00.000Z');