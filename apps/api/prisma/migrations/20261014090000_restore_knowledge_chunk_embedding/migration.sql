-- Restore the pgvector embedding column on KnowledgeChunk.
--
-- 20260604164717_knowledge_chunk_embedding added it via raw SQL, but the
-- Prisma model never declared it (Prisma can't represent pgvector), so the
-- auto-generated 20260622075719_add_schema_extensions migration dropped it
-- again. rag:ingest and ai/rag.ts both expect it. Idempotent so it is safe on
-- databases where the column was re-added by hand.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "KnowledgeChunk"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_idx"
  ON "KnowledgeChunk"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
