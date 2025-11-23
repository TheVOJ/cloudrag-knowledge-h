/**
 * Cloudflare Worker entry point
 * Handles API requests for LLM and KV operations
 */

export interface Env {
  AI: Ai
  KV: KVNamespace
  ASSETS: Fetcher
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
