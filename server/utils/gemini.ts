// A small Gemini client: JSON-only answers, a timeout, and a second model to
// fall back to when the first is busy or out of free-tier quota.

export const MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite'] as const

export type GeminiFailure = 'no_key' | 'rate_limited' | 'busy' | 'timeout' | 'bad_response' | 'error'

export class GeminiError extends Error {
  constructor(public reason: GeminiFailure, message: string) {
    super(message)
  }
}

interface Request {
  apiKey: string
  system: string
  prompt: string
  schema: object
  timeoutMs?: number
}

export interface GeminiResult<T> {
  data: T
  model: string
}

export async function generateJson<T>({ apiKey, system, prompt, schema, timeoutMs = 30_000 }: Request): Promise<GeminiResult<T>> {
  if (!apiKey) throw new GeminiError('no_key', 'No Gemini API key is configured.')
  let lastError: GeminiError | null = null

  for (const model of MODELS) {
    try {
      const data = await callModel<T>(model, { apiKey, system, prompt, schema, timeoutMs })
      return { data, model }
    } catch (error) {
      lastError = error instanceof GeminiError ? error : new GeminiError('error', String(error))
      // Only a busy or rate-limited model is worth retrying on the other model.
      if (!['rate_limited', 'busy', 'timeout'].includes(lastError.reason)) throw lastError
    }
  }
  throw lastError!
}

async function callModel<T>(model: string, { apiKey, system, prompt, schema, timeoutMs }: Required<Request>): Promise<T> {
  let response: Response
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          temperature: 0.4
        }
      })
    })
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    throw new GeminiError(timedOut ? 'timeout' : 'error', `${model}: ${String(error)}`)
  }

  if (response.status === 429) throw new GeminiError('rate_limited', `${model}: free-tier rate limit reached`)
  if (response.status === 503 || response.status === 500) throw new GeminiError('busy', `${model}: ${response.status}`)
  if (!response.ok) throw new GeminiError('error', `${model}: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`)

  const body = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')
  if (!text) throw new GeminiError('bad_response', `${model}: empty answer`)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new GeminiError('bad_response', `${model}: answer was not valid JSON`)
  }
}
