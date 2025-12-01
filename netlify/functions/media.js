// netlify/functions/media.js
const fetch = require('node-fetch')

exports.handler = async function(event, context){
  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  }
  if(event.httpMethod === 'OPTIONS'){
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }
  const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
  const API_KEY = process.env.CLOUDINARY_API_KEY
  const API_SECRET = process.env.CLOUDINARY_API_SECRET
  if(!CLOUD_NAME || !API_KEY || !API_SECRET){
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({error:'Cloudinary not configured on server'})}
  }
  try{
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/search`
    const body = { expression: "folder:flavournous", max_results: 500 }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(API_KEY + ':' + API_SECRET).toString('base64')
      },
      body: JSON.stringify(body)
    })
    const json = await res.json()
    const resources = (json.resources || []).map(r=>{
      const ctx = {}
      if(r.context && r.context.custom && typeof r.context.custom === 'object'){
        Object.assign(ctx, r.context.custom)
      }else if(r.context && r.context.raw){
        r.context.raw.split('|').forEach(pair=>{
          const [k,v] = pair.split('=')
          if(k) ctx[k]=v
        })
      }
      return {
        id: r.asset_id,
        public_id: r.public_id,
        cloud_name: CLOUD_NAME,
        title: ctx.title || r.public_id,
        artist: ctx.artist || '',
        resource_type: r.resource_type,
        format: r.format,
        url: r.secure_url,
        image: r.secure_url,
        created_at: r.created_at,
        context: ctx
      }
    })
    const grouped = {}
    resources.forEach(resrc=>{
      const key = (resrc.title || '') + '|' + (resrc.artist || '')
      if(!grouped[key]) grouped[key] = { title: resrc.title, artist: resrc.artist, image: '', qualities: [], public_id: resrc.public_id, format: resrc.format, cloud_name: resrc.cloud_name }
      if(resrc.resource_type === 'image' && (resrc.context && resrc.context.type === 'cover' || resrc.public_id.toLowerCase().includes('cover'))){
        grouped[key].image = resrc.url
        return
      }
      if(resrc.resource_type === 'image' && !grouped[key].image){
        grouped[key].image = resrc.url
        return
      }
      const qualityLabel = resrc.context && resrc.context.quality ? resrc.context.quality : (resrc.format || resrc.resource_type)
      grouped[key].qualities.push({ label: qualityLabel, url: resrc.url, format: resrc.format })
    })
    const out = Object.values(grouped)
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(out) }
  }catch(err){
    console.error(err)
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({error: String(err)}) }
  }
}
