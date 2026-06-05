/**
 * RAG ingestion script — reads KnowledgeChunk rows with embedding IS NULL,
 * batches them to OpenAI text-embedding-3-small, and writes the 1536-dim
 * vectors back via pgvector.
 *
 * Usage (from repo root):
 *   npx -y pnpm@9.12.3 --filter @gpcsk/api run rag:ingest
 */

import { prisma } from '../db.js'
import { logger } from '../logger.js'
import { embedTexts } from './embed.js'

const BATCH_SIZE = 100

async function main() {
  // Detect placeholder key early
  const apiKey = process.env['OPENAI_API_KEY'] ?? ''
  if (!apiKey || apiKey === 'sk-...' || apiKey.startsWith('sk-...')) {
    logger.info('Set OPENAI_API_KEY in .env then re-run rag:ingest.')
    await prisma.$disconnect()
    process.exit(0)
  }

  logger.info('rag:ingest — starting')

  // Count total unembedded chunks
  const totalResult = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) AS count
    FROM "KnowledgeChunk"
    WHERE embedding IS NULL
  `
  const total = Number(totalResult[0]?.count ?? 0)

  if (total === 0) {
    logger.info('rag:ingest — no chunks without embeddings, nothing to do')
    await prisma.$disconnect()
    return
  }

  logger.info({ total }, 'rag:ingest — chunks to embed')

  let processed = 0

  // Fetch IDs and texts in batches using cursor-style offset
  while (processed < total) {
    const chunks = await prisma.$queryRaw<Array<{ id: string; chunkText: string }>>`
      SELECT id, "chunkText"
      FROM "KnowledgeChunk"
      WHERE embedding IS NULL
      ORDER BY id
      LIMIT ${BATCH_SIZE}
    `

    if (chunks.length === 0) break

    logger.info(
      { batchStart: processed + 1, batchEnd: processed + chunks.length, total },
      'rag:ingest — embedding batch',
    )

    const texts = chunks.map((c) => c.chunkText)
    const embeddings = await embedTexts(texts)

    // Write embeddings back one-by-one via executeRaw (pgvector cast)
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = embeddings[i]
      if (!chunk || !embedding) continue

      const vectorLiteral = `[${embedding.join(',')}]`
      await prisma.$executeRaw`
        UPDATE "KnowledgeChunk"
        SET embedding = ${vectorLiteral}::vector(1536)
        WHERE id = ${chunk.id}
      `
    }

    processed += chunks.length
    logger.info({ processed, total }, 'rag:ingest — progress')
  }

  logger.info({ processed }, 'rag:ingest — complete')
  await prisma.$disconnect()
}

main().catch((err: unknown) => {
  logger.error({ err }, 'rag:ingest — fatal error')
  void prisma.$disconnect()
  process.exit(1)
})
