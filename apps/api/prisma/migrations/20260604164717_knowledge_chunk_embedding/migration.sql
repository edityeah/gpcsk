-- Add 1536-dim pgvector column to KnowledgeChunk (text-embedding-3-small)
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "KnowledgeChunk"
  ADD COLUMN "embedding" vector(1536);

CREATE INDEX "KnowledgeChunk_embedding_idx"
  ON "KnowledgeChunk"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
