// A small Gemini client: JSON-only answers, a timeout, and a second model to
// fall back to when the first is busy or out of free-tier quota.

// Tried in order. The free tier gives each model its own small daily allowance
// (20 requests a day for gemini-3.5-flash), so a chain of models multiplies the headroom.
// A busy (503) model gets one more try after a short pause; a model that is out of
// quota (429) is skipped straight away. If every model fails, the caller uses template copy.
export const MODELS = ['gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'] as const

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
  /** How much the model reasons before answering. More is slower but better. */
  thinking?: 'minimal' | 'low' | 'medium'
  /** Override the model list, e.g. a single quick attempt. */
  models?: readonly string[]
}

export interface GeminiResult<T> {
  data: T
  model: string
}

export async function generateJson<T>({ apiKey, system, prompt, schema, timeoutMs = 30_000, thinking = 'low', models = MODELS }: Request): Promise<GeminiResult<T>> {
  if (!apiKey) throw new GeminiError('no_key', 'No Gemini API key is configured.')
  let lastError: GeminiError | null = null

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const data = await callModel<T>(model, { apiKey, system, prompt, schema, timeoutMs, thinking })
        return { data, model }
      } catch (error) {
        lastError = error instanceof GeminiError ? error : new GeminiError('error', String(error))
        // A broken request (bad key, bad schema) will fail on every model, so stop.
        if (!['rate_limited', 'busy', 'timeout'].includes(lastError.reason)) throw lastError
        // Busy: pause and try this model once more. Out of quota or slow: move to the next model.
        if (lastError.reason !== 'busy' || attempt === 2) break
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
    }
  }
  throw lastError!
}

async function callModel<T>(model: string, { apiKey, system, prompt, schema, timeoutMs, thinking }: Omit<Required<Request>, 'models'>): Promise<T> {
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
          temperature: 0.4,
          thinkingConfig: { thinkingLevel: thinking }
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
