// netlify/functions/sign-upload.js
const crypto = require('crypto')

// Allowed MIME prefixes and default max bytes (200MB)
const ALLOWED_PREFIXES = ['audio/', 'video/', 'image/']
const DEFAULT_MAX = 200 * 1024 * 1024

exports.handler = async function(event, context){
  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  }
  if(event.httpMethod === 'OPTIONS'){
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }
  if(event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS_HEADERS, body: 'Method not allowed' }

  // Require Netlify Identity authentication
  const user = context.clientContext && context.clientContext.user
  if(!user){
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unauthorized - must be logged in' }) }
  }

  const body = JSON.parse(event.body || '{}')
  const public_id = body.public_id || ''
  const filename = body.filename || ''
  const filetype = body.filetype || ''
  const filesize = parseInt(body.filesize || '0', 10) || 0
  const folder = body.folder || 'flavournous'
  const timestamp = Math.floor(Date.now()/1000)

  const API_SECRET = process.env.CLOUDINARY_API_SECRET
  const API_KEY = process.env.CLOUDINARY_API_KEY
  const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
  const MAX_BYTES = parseInt(process.env.MAX_UPLOAD_BYTES || String(DEFAULT_MAX), 10)

  if(!API_SECRET || !API_KEY || !CLOUD_NAME){
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Cloudinary not configured on server' }) }
  }

  // Server-side validation of filetype and filesize (client-side also validates)
  if(filetype){
    const ok = ALLOWED_PREFIXES.some(p => filetype.startsWith(p))
    if(!ok){
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'File type not allowed' }) }
    }
  }
  if(filesize && filesize > MAX_BYTES){
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'File too large', max: MAX_BYTES }) }
  }

  // Build signature string including folder/public_id/timestamp (only keys included here are signed)
  const params = []
  if(folder) params.push('folder=' + folder)
  if(public_id) params.push('public_id=' + public_id)
  params.push('timestamp=' + timestamp)
  const toSign = params.join('&') + API_SECRET
  const signature = crypto.createHash('sha1').update(toSign).digest('hex')

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      signature,
      timestamp,
      api_key: API_KEY,
      cloud_name: CLOUD_NAME,
      folder,
      public_id
    })
  }
}
