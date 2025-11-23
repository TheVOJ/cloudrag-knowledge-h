/**
 * Cloudflare Worker entry point
 * Handles API requests for LLM, KV, embeddings, and Vectorize operations
 */
import type { Ai, Vectorize, VectorizeVector } from '@cloudflare/workers-types'
import { DEFAULT_CF_EMBEDDING_MODEL, EMBEDDING_DIMENSION, MAX_EMBEDDING_TEXT_LENGTH } from '../src/lib/embedding-constants'

export interface Env {
  AI: Ai
  KV: KVNamespace
  ASSETS: Fetcher
  VECTORIZE: Vectorize
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      // API Routes
      if (url.pathname.startsWith('/api/')) {
        return handleAPI(request, env, corsHeaders)
      }

      // Serve static assets (Vite build output)
      return env.ASSETS.fetch(request)
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  },
}

async function handleAPI(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  // LLM API
  if (path === '/api/llm' && request.method === 'POST') {
    const { prompt, model = '@cf/meta/llama-3.1-8b-instruct', jsonMode = false } = await request.json() as {
      prompt: string
      model?: string
      jsonMode?: boolean
    }

    const messages = [{ role: 'user', content: prompt }]

    const response = await env.AI.run(model, {
      messages,
      ...(jsonMode && { response_format: { type: 'json_object' } })
    }) as { response?: string }

    return new Response(JSON.stringify({ response: response.response || '' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Embeddings API (Workers AI)
  if (path === '/api/embed' && request.method === 'POST') {
    const { texts, model = DEFAULT_CF_EMBEDDING_MODEL } = await request.json() as {
      texts: string[]
      model?: string
    }

    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ error: 'texts must be a non-empty array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate embeddings for each text individually (EMBEDDING_DIMENSION dimensions)
    const embeddings: number[][] = []
    for (const text of texts) {
      const result = await env.AI.run(model, {
        text: text.substring(0, MAX_EMBEDDING_TEXT_LENGTH) // Limit to model's max input length
      }) as { data?: number[][] }

      if (result.data && result.data[0]) {
        embeddings.push(result.data[0])
      }
    }

    return new Response(JSON.stringify({ embeddings }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Vectorize: upsert
  if (path === '/api/vector/upsert' && request.method === 'POST') {
    const { vectors } = await request.json() as { vectors: Array<{ id: string; values: number[]; metadata?: Record<string, any> }> }

    if (!Array.isArray(vectors) || vectors.length === 0) {
      return new Response(JSON.stringify({ error: 'vectors must be a non-empty array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const invalidVector = vectors.find(v => v.values.length !== EMBEDDING_DIMENSION)
    if (invalidVector) {
      return new Response(JSON.stringify({
        error: `Vector dimension mismatch for id ${invalidVector.id}: expected ${EMBEDDING_DIMENSION}, received ${invalidVector.values.length}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload: VectorizeVector[] = vectors.map(v => ({ id: v.id, values: v.values, metadata: v.metadata }))
    await env.VECTORIZE.upsert(payload)

    return new Response(JSON.stringify({ success: true, count: vectors.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Vectorize: query
  if (path === '/api/vector/query' && request.method === 'POST') {
    const { vector, topK = 5, filter } = await request.json() as { vector: number[]; topK?: number; filter?: Record<string, any> }

    if (!Array.isArray(vector) || vector.length === 0) {
      return new Response(JSON.stringify({ error: 'vector is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const matches = await env.VECTORIZE.query(vector, {
      topK,
      filter
    })

    const list = (matches as any).matches || matches || []

    return new Response(JSON.stringify({ matches: list }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Vectorize: delete
  if (path === '/api/vector/delete' && request.method === 'POST') {
    const { ids } = await request.json() as { ids: string[] }

    if (!Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: 'ids must be a non-empty array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await env.VECTORIZE.deleteByIds(ids)
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // LLM Stream API
  if (path === '/api/llm/stream' && request.method === 'POST') {
    const { prompt, model = '@cf/meta/llama-3.1-8b-instruct' } = await request.json() as {
      prompt: string
      model?: string
    }

    const messages = [{ role: 'user', content: prompt }]

    const stream = await env.AI.run(model, {
      messages,
      stream: true
    }) as ReadableStream

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }

  // KV GET
  if (path.startsWith('/api/kv/') && request.method === 'GET') {
    const key = path.replace('/api/kv/', '')
    const rawValue = await env.KV.get(key)

    let value = null
    if (rawValue !== null) {
      try {
        value = JSON.parse(rawValue)
      } catch {
        value = rawValue // Return as-is if not valid JSON
      }
    }

    return new Response(JSON.stringify({ value }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // KV PUT
  if (path.startsWith('/api/kv/') && request.method === 'PUT') {
    const key = path.replace('/api/kv/', '')
    const { value } = await request.json() as { value: unknown }

    await env.KV.put(key, JSON.stringify(value))

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // KV DELETE
  if (path.startsWith('/api/kv/') && request.method === 'DELETE') {
    const key = path.replace('/api/kv/', '')
    await env.KV.delete(key)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // KV LIST
  if (path === '/api/kv' && request.method === 'GET') {
    const prefix = url.searchParams.get('prefix') || undefined
    const list = await env.KV.list({ prefix })

    return new Response(JSON.stringify({ keys: list.keys.map(k => k.name) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response('Not Found', {
    status: 404,
    headers: corsHeaders,
  })
}
