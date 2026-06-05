/**
 * RAG retrieval — cosine similarity search via pgvector.
 *
 * If no embeddings exist yet (rag:ingest not yet run), falls back to a
 * plain ILIKE keyword search across chunkText so the endpoint is still
 * useful in demo / offline mode.
 */

import { prisma } from '../db.js'
import { embedTexts } from '../rag/embed.js'
import { logger } from '../logger.js'

export interface RagChunk {
  docId: string
  docTitle: string
  snippet: string
  similarity?: number
}

/**
 * Retrieve the top-k most relevant knowledge chunks for a query string.
 *
 * Strategy:
 * 1. Try to embed the query via OpenAI text-embedding-3-small.
 * 2. If embedding succeeds, run a pgvector cosine-distance query.
 * 3. If no embedded chunks exist in the DB, fall back to ILIKE keyword search.
 * 4. If embedding fails (offline / placeholder key), fall back to ILIKE.
 */
export async function retrieve(query: string, k = 5): Promise<RagChunk[]> {
  // ── Attempt vector search ────────────────────────────────────────────────
  try {
    const embeddings = await embedTexts([query])
    const embedding = embeddings[0]

    if (embedding && embedding.length > 0) {
      const vectorLiteral = `[${embedding.join(',')}]`

      // Check whether any embeddings have been populated
      const hasEmbeddings = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) AS count
        FROM "KnowledgeChunk"
        WHERE embedding IS NOT NULL
      `

      if (Number(hasEmbeddings[0]?.count ?? 0) > 0) {
        const rows = await prisma.$queryRaw<
          Array<{ id: string; chunkText: string; docId: string; docTitle: string; similarity: number }>
        >`
          SELECT
            kc.id,
            kc."chunkText",
            kd.id            AS "docId",
            kd.title         AS "docTitle",
            1 - (kc.embedding <=> ${vectorLiteral}::vector) AS similarity
          FROM "KnowledgeChunk" kc
          JOIN "KnowledgeDocument" kd ON kd.id = kc."documentId"
          WHERE kc.embedding IS NOT NULL
          ORDER BY kc.embedding <=> ${vectorLiteral}::vector
          LIMIT ${k}
        `

        return rows.map((r) => ({
          docId: r.docId,
          docTitle: r.docTitle,
          snippet: r.chunkText.slice(0, 400),
          similarity: r.similarity,
        }))
      }

      logger.info('rag.retrieve — no embedded chunks found, falling back to ILIKE search')
    }
  } catch (err: unknown) {
    logger.warn({ err }, 'rag.retrieve — embedding failed, falling back to ILIKE search')
  }

  // ── Fallback: keyword search ─────────────────────────────────────────────
  return keywordSearch(query, k)
}

async function keywordSearch(query: string, k: number): Promise<RagChunk[]> {
  // Build a simple ILIKE pattern: match any word longer than 3 characters
  const words = query
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 3)

  if (words.length === 0) return []

  // Use the first significant word for the ILIKE search (simplicity for demo)
  const pattern = `%${words[0]}%`

  const rows = await prisma.$queryRaw<
    Array<{ id: string; chunkText: string; docId: string; docTitle: string }>
  >`
    SELECT
      kc.id,
      kc."chunkText",
      kd.id    AS "docId",
      kd.title AS "docTitle"
    FROM "KnowledgeChunk" kc
    JOIN "KnowledgeDocument" kd ON kd.id = kc."documentId"
    WHERE kc."chunkText" ILIKE ${pattern}
    LIMIT ${k}
  `

  return rows.map((r) => ({
    docId: r.docId,
    docTitle: r.docTitle,
    snippet: r.chunkText.slice(0, 400),
  }))
}
