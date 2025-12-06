<<<<<<< HEAD
// cloudflare/sign-upload-worker.js
// Cloudflare Worker to sign Cloudinary uploads.
// Protect this worker with Cloudflare Access, or set ADMIN_SECRET as a secret for dev/testing.

export default {
  async fetch(request, env) {
    const CORS_HEADERS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-admin-secret'
    }

    if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS_HEADERS })

    // Route handling: /sign (POST) for Cloudinary signing, /media (GET/POST) for media listing
    const url = new URL(request.url)
    const pathname = url.pathname.replace(/\/+$/, '')

    // Simple auth helper: check CF Access or admin secret header
    const cfAccessHeader = request.headers.get('cf-access-jwt-assertion')
    const adminSecret = request.headers.get('x-admin-secret')
    const expectedAdminSecret = env.ADMIN_SECRET || null
    const isAuthorized = cfAccessHeader || (adminSecret && expectedAdminSecret && adminSecret === expectedAdminSecret)

    // MEDIA endpoints (GET to list, POST to add)
    if (pathname.endsWith('/media')) {
      if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS_HEADERS })

      if (request.method === 'GET') {
        // Read media list from KV
        try {
          const raw = await env.MEDIA_STORE.get('media')
          const list = raw ? JSON.parse(raw) : []
          return new Response(JSON.stringify(list), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
        } catch (e) {
          return new Response(JSON.stringify([]), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
        }
      }

      if (request.method === 'POST') {
        // Require simple auth to add items
        if (!isAuthorized) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
        let body = null
        try { body = await request.json() } catch (e) { body = null }
        if (!body || !body.url) return new Response(JSON.stringify({ error: 'Invalid body, expected { url, title?, artist?, image? }' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
        const item = {
          id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8),
          title: body.title || 'Untitled',
          artist: body.artist || 'Unknown',
          url: body.url,
          image: body.image || '',
          qualities: body.qualities || [{ label: 'Original', url: body.url }],
          created_at: new Date().toISOString()
        }
        try {
          const raw = await env.MEDIA_STORE.get('media')
          const list = raw ? JSON.parse(raw) : []
          list.unshift(item)
          // Keep only the latest 100 items
          const trimmed = list.slice(0, 100)
          await env.MEDIA_STORE.put('media', JSON.stringify(trimmed))
          return new Response(JSON.stringify(item), { status: 201, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Failed to store media' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
        }
      }

      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
    }

    // SIGN route
    if (pathname.endsWith('/sign')) {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
      if (!isAuthorized) return new Response(JSON.stringify({ error: 'Unauthorized - missing CF Access or valid admin secret' }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

      let body = null
      try { body = await request.json() } catch (e) { return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }) }

      const filename = body.filename || ''
      const filetype = body.filetype || ''
      const public_id = body.public_id || ''
      const folder = body.folder || 'flavournous'
      const filesize = Number(body.filesize || 0) || 0

      const CLOUD_NAME = env.CLOUDINARY_CLOUD_NAME
      const API_KEY = env.CLOUDINARY_API_KEY
      const API_SECRET = env.CLOUDINARY_API_SECRET
      const MAX_BYTES = Number(env.MAX_UPLOAD_BYTES || (200 * 1024 * 1024))
      const DEFAULT_LLM_MODEL = env.DEFAULT_LLM_MODEL || 'claude-haiku-4.5'

      if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
        return new Response(JSON.stringify({ error: 'Cloudinary not configured on worker' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
      }

      const ALLOWED_PREFIXES = ['audio/', 'video/', 'image/']
      if (filetype && !ALLOWED_PREFIXES.some(p => filetype.startsWith(p))) {
        return new Response(JSON.stringify({ error: 'File type not allowed' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
      }
      if (filesize && filesize > MAX_BYTES) {
        return new Response(JSON.stringify({ error: 'File too large', max: MAX_BYTES }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
      }

      const timestamp = Math.floor(Date.now() / 1000)
      const params = {}
      if (folder) params.folder = folder
      if (public_id) params.public_id = public_id
      params.timestamp = timestamp

      const toSign = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + API_SECRET
      const encoder = new TextEncoder()
      const data = encoder.encode(toSign)
      const hashBuffer = await crypto.subtle.digest('SHA-1', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      const resp = { signature, timestamp, api_key: API_KEY, cloud_name: CLOUD_NAME, folder, public_id }
      resp.model = DEFAULT_LLM_MODEL
      return new Response(JSON.stringify(resp), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }

    return new Response('Not found', { status: 404, headers: CORS_HEADERS })
  }
}
=======
// cloudflare/sign-upload-worker.js
// Cloudflare Worker to sign Cloudinary uploads.
// Protect this worker with Cloudflare Access, or set ADMIN_SECRET as a secret for dev/testing.

export default {
  async fetch(request, env) {
    const CORS_HEADERS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-admin-secret'
    }

    if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS_HEADERS })

    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })

    // Simple authentication checks:
    // - If Cloudflare Access is enabled, Cloudflare will add a header `cf-access-jwt-assertion`
    // - Otherwise allow a developer-provided ADMIN_SECRET header (set as a secret in the Worker)
    const cfAccessHeader = request.headers.get('cf-access-jwt-assertion')
    const adminSecret = request.headers.get('x-admin-secret')
    const expectedAdminSecret = env.ADMIN_SECRET || null

    if (!cfAccessHeader) {
      // if CF Access not present, require admin secret match
      if (!adminSecret || !expectedAdminSecret || adminSecret !== expectedAdminSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized - missing CF Access or valid admin secret' }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
      }
    }

    let body = null
    try {
      body = await request.json()
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }

    const filename = body.filename || ''
    const filetype = body.filetype || ''
    const public_id = body.public_id || ''
    const folder = body.folder || 'flavournous'
    const filesize = Number(body.filesize || 0) || 0

    const CLOUD_NAME = env.CLOUDINARY_CLOUD_NAME
    const API_KEY = env.CLOUDINARY_API_KEY
    const API_SECRET = env.CLOUDINARY_API_SECRET
    const MAX_BYTES = Number(env.MAX_UPLOAD_BYTES || (200 * 1024 * 1024))
    const DEFAULT_LLM_MODEL = env.DEFAULT_LLM_MODEL || 'claude-haiku-4.5'

    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
      return new Response(JSON.stringify({ error: 'Cloudinary not configured on worker' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }

    // Validate basic filetype and size
    const ALLOWED_PREFIXES = ['audio/', 'video/', 'image/']
    if (filetype && !ALLOWED_PREFIXES.some(p => filetype.startsWith(p))) {
      return new Response(JSON.stringify({ error: 'File type not allowed' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }
    if (filesize && filesize > MAX_BYTES) {
      return new Response(JSON.stringify({ error: 'File too large', max: MAX_BYTES }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }

    // Build params to sign: include folder and public_id when provided, plus timestamp
    const timestamp = Math.floor(Date.now() / 1000)
    const params = {}
    if (folder) params.folder = folder
    if (public_id) params.public_id = public_id
    params.timestamp = timestamp

    // Canonicalize: keys sorted, joined with & and append api secret
    const toSign = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + API_SECRET

    // use Web Crypto to compute SHA-1
    const encoder = new TextEncoder()
    const data = encoder.encode(toSign)
    const hashBuffer = await crypto.subtle.digest('SHA-1', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    const resp = {
      signature,
      timestamp,
      api_key: API_KEY,
      cloud_name: CLOUD_NAME,
      folder,
      public_id
    }
    resp.model = DEFAULT_LLM_MODEL

    return new Response(JSON.stringify(resp), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
  }
}
>>>>>>> 8ddd30324b0764b0ea96f5a39a3dd53f48394074
