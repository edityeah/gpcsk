/**
 * PDF ingestion script — reads GPCB source PDFs, extracts text via pdf-parse,
 * chunks them, and writes KnowledgeDocument + KnowledgeChunk rows to the DB.
 *
 * Idempotent: if a document with the same title already exists, its chunks
 * are deleted and re-inserted with fresh text.
 *
 * After inserting chunks, the existing rag:ingest script populates embeddings.
 *
 * Usage (from repo root):
 *   npx -y pnpm@9.12.3 --filter @gpcsk/api run rag:ingest-pdfs
 *   npx -y pnpm@9.12.3 --filter @gpcsk/api run rag:ingest
 */

import * as fs from 'fs'
import * as path from 'path'
import { createRequire } from 'module'
import { KnowledgeSourceType } from '@prisma/client'
import { prisma } from '../db.js'
import { logger } from '../logger.js'

// pdf-parse is CommonJS-only — use createRequire to import it in ESM context
const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> = require('pdf-parse')

// ── Configuration ─────────────────────────────────────────────────────────────

const CHUNK_WORDS = 700       // target words per chunk
const OVERLAP_WORDS = 50      // overlap between consecutive chunks

// Resolve docs/references/gpcb-sources relative to the project root
// Script lives at apps/api/src/rag/; walk up 4 dirs to reach repo root.
const REPO_ROOT = path.resolve(new URL(import.meta.url).pathname, '../../../../..')
const PDF_DIR = path.join(REPO_ROOT, 'docs', 'references', 'gpcb-sources')

interface PdfConfig {
  filename: string
  title: string
  sourceType: KnowledgeSourceType
  tags: string[]
}

const PDF_CONFIGS: PdfConfig[] = [
  {
    filename: 'gpcb-annual-report-2022-23-part-1.pdf',
    title: 'GPCB Annual Report 2022-23 Part 1',
    sourceType: KnowledgeSourceType.ANNUAL_REPORT,
    tags: ['annual-report', 'gpcb', '2022-23'],
  },
  {
    filename: 'gpcb-annual-report-2022-23-part-2.pdf',
    title: 'GPCB Annual Report 2022-23 Part 2',
    sourceType: KnowledgeSourceType.ANNUAL_REPORT,
    tags: ['annual-report', 'gpcb', '2022-23'],
  },
  {
    filename: 'gpcb-annual-report-2024-25.pdf',
    title: 'GPCB Annual Report 2024-25',
    sourceType: KnowledgeSourceType.ANNUAL_REPORT,
    tags: ['annual-report', 'gpcb', '2024-25'],
  },
  {
    filename: 'cetp-results-feb-2026.pdf',
    title: 'CETP Results February 2026',
    sourceType: KnowledgeSourceType.CETP_REPORT,
    tags: ['cetp', 'gpcb', '2026'],
  },
  {
    filename: 'festival-monitoring-ganesh-utsav.pdf',
    title: 'Festival Monitoring Ganesh Utsav',
    sourceType: KnowledgeSourceType.FESTIVAL_MONITORING,
    tags: ['festival', 'ganesh-utsav', 'monitoring', 'gpcb'],
  },
]

// ── Text chunking ─────────────────────────────────────────────────────────────

function normaliseText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // collapse runs of more than 2 newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    // collapse tabs / multiple spaces within a line
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []

  let start = 0
  while (start < words.length) {
    const end = Math.min(start + CHUNK_WORDS, words.length)
    const chunk = words.slice(start, end).join(' ')
    if (chunk.trim().length > 0) {
      chunks.push(chunk)
    }
    if (end >= words.length) break
    start = end - OVERLAP_WORDS
    if (start < 0) start = 0
  }

  return chunks
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  logger.info({ pdfDir: PDF_DIR }, 'rag:ingest-pdfs — starting')

  let totalDocs = 0
  let totalChunks = 0

  for (const config of PDF_CONFIGS) {
    const filePath = path.join(PDF_DIR, config.filename)

    if (!fs.existsSync(filePath)) {
      logger.warn({ filename: config.filename }, 'rag:ingest-pdfs — file not found, skipping')
      continue
    }

    logger.info({ filename: config.filename }, 'rag:ingest-pdfs — reading PDF')

    let pdfText: string = ''
    try {
      const buffer = fs.readFileSync(filePath)
      const parsed = await pdfParse(buffer)
      pdfText = normaliseText(parsed.text)
    } catch (err: unknown) {
      logger.warn({ filename: config.filename, err }, 'rag:ingest-pdfs — pdf-parse failed, will try OCR sibling .txt')
    }

    // Image-only / scanned PDFs (e.g. AR 2024-25) yield no text from pdf-parse.
    // Fall back to a sibling .txt file produced by an offline OCR pass
    // (pdftoppm + tesseract). Drop the OCR output next to the PDF with the
    // same basename and `.txt` extension.
    if (!pdfText || pdfText.length < 100) {
      const sidecarTxt = filePath.replace(/\.pdf$/i, '.txt')
      if (fs.existsSync(sidecarTxt)) {
        logger.info({ filename: config.filename, sidecar: path.basename(sidecarTxt) }, 'rag:ingest-pdfs — using OCR sidecar .txt')
        pdfText = normaliseText(fs.readFileSync(sidecarTxt, 'utf8'))
      }
    }

    if (!pdfText || pdfText.length < 100) {
      logger.warn({ filename: config.filename }, 'rag:ingest-pdfs — no extractable text (no PDF text + no OCR sidecar), skipping')
      continue
    }

    logger.info(
      { filename: config.filename, chars: pdfText.length },
      'rag:ingest-pdfs — PDF parsed',
    )

    const chunks = chunkText(pdfText)
    logger.info(
      { filename: config.filename, chunks: chunks.length },
      'rag:ingest-pdfs — chunked',
    )

    // Upsert KnowledgeDocument — idempotent on title
    const relativeFileUrl = `docs/references/gpcb-sources/${config.filename}`

    // Use a transaction to delete old chunks + upsert document atomically
    await prisma.$transaction(async (tx) => {
      // Check if document already exists
      const existing = await tx.knowledgeDocument.findFirst({
        where: { title: config.title },
        select: { id: true },
      })

      let docId: string

      if (existing) {
        // Delete old chunks
        await tx.knowledgeChunk.deleteMany({
          where: { documentId: existing.id },
        })
        // Update document metadata
        await tx.knowledgeDocument.update({
          where: { id: existing.id },
          data: {
            sourceType: config.sourceType,
            fileUrl: relativeFileUrl,
            tags: config.tags,
          },
        })
        docId = existing.id
        logger.info({ title: config.title, docId }, 'rag:ingest-pdfs — replaced existing document chunks')
      } else {
        // Create new document
        const doc = await tx.knowledgeDocument.create({
          data: {
            title: config.title,
            sourceType: config.sourceType,
            fileUrl: relativeFileUrl,
            tags: config.tags,
          },
        })
        docId = doc.id
        logger.info({ title: config.title, docId }, 'rag:ingest-pdfs — created new document')
      }

      // Insert chunks in batches to avoid parameter limits
      const BATCH = 50
      for (let i = 0; i < chunks.length; i += BATCH) {
        const batch = chunks.slice(i, i + BATCH)
        await tx.knowledgeChunk.createMany({
          data: batch.map((text) => ({
            documentId: docId,
            chunkText: text,
            // embedding is left NULL — populated by rag:ingest
          })),
        })
      }
    })

    logger.info(
      { filename: config.filename, chunks: chunks.length },
      'rag:ingest-pdfs — document ingested',
    )

    totalDocs++
    totalChunks += chunks.length
  }

  logger.info({ totalDocs, totalChunks }, 'rag:ingest-pdfs — complete')
  await prisma.$disconnect()
}

main().catch((err: unknown) => {
  logger.error({ err }, 'rag:ingest-pdfs — fatal error')
  void prisma.$disconnect()
  process.exit(1)
})
