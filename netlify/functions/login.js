// netlify/functions/login.js
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
  const body = JSON.parse(event.body || '{}')
  const password = body.password || ''
  const ADMIN = process.env.NETLIFY_ADMIN_PASSWORD
  if(!ADMIN){
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Server misconfigured: NETLIFY_ADMIN_PASSWORD not set' }) }
  }
  if(password === ADMIN){
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ok:true}) }
  }else{
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ok:false}) }
  }
}
