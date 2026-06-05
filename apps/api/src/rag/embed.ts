import OpenAI from 'openai'

const BATCH_SIZE = 100
const MODEL = 'text-embedding-3-small'

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env['OPENAI_API_KEY']
    _client = new OpenAI({ apiKey })
  }
  return _client
}

/**
 * Embed an array of texts using OpenAI text-embedding-3-small (1536 dims).
 * Splits into batches of 100 to stay within API limits.
 *
 * @throws {Error} on API failure
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const client = getClient()
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const response = await client.embeddings.create({
      model: MODEL,
      input: batch,
    })
    // Sort by index to preserve input order
    const sorted = response.data
      .slice()
      .sort((a, b) => a.index - b.index)
    for (const item of sorted) {
      results.push(item.embedding)
    }
  }

  return results
}
