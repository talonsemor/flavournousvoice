// site/admin-signed-full.js

document.addEventListener('DOMContentLoaded', function(){

  const authWrap = document.getElementById('authWrap')
  const uploadWrap = document.getElementById('uploadWrap')
  const loginBtn = document.getElementById('loginBtn')
  const logoutBtn = document.getElementById('logoutBtn')
  const uploadForm = document.getElementById('uploadForm')
  const qualitiesInput = document.getElementById('qualitiesInput')
  const coverInput = document.getElementById('coverInput')
  const thumbs = document.getElementById('thumbs')
  const dropZone = document.getElementById('dropZone')
  const progressList = document.getElementById('progressList')
  const uploadStatus = document.getElementById('uploadStatus')

  let currentUser = null

  // Cloudflare-only: No login/logout, always show dashboard
  authWrap.style.display='none';
  uploadWrap.style.display='block';
  window.SIGN_ENDPOINT = "https://flavournous-sign-upload-production.shadrackechesa40.workers.dev";
  window.ADMIN_SECRET = "dev-admin-secret-flavournous";
  loginBtn.onclick = ()=>{};
  logoutBtn.onclick = ()=>{};

  // Drag & drop files to qualities input
  dropZone.addEventListener('dragover', e=>{
    e.preventDefault()
    dropZone.style.borderColor='#aaa'
  })
  dropZone.addEventListener('dragleave', e=>{
    dropZone.style.borderColor='rgba(255,255,255,0.03)'
  })
  dropZone.addEventListener('drop', e=>{
    e.preventDefault()
    dropZone.style.borderColor='rgba(255,255,255,0.03)'
    const dt = e.dataTransfer
    if(dt && dt.files) {
      for(const file of dt.files){
        if(file.type.startsWith('audio/') || file.type.startsWith('video/')){
          const dataTransfer = new DataTransfer()
          Array.from(qualitiesInput.files).forEach(f=>dataTransfer.items.add(f))
          dataTransfer.items.add(file)
          qualitiesInput.files = dataTransfer.files
        }
      }
      renderThumbs()
    }
  })

  function renderThumbs(){
    thumbs.innerHTML=''
    Array.from(qualitiesInput.files).forEach(file=>{
      const div = document.createElement('div')
      div.textContent = file.name
      div.className = 'thumb card'
      thumbs.appendChild(div)
    })
    if(coverInput.files.length){
      const coverDiv = document.createElement('div')
      coverDiv.textContent = 'Cover: '+coverInput.files[0].name
      coverDiv.className='thumb card'
      thumbs.appendChild(coverDiv)
    }
  }

  qualitiesInput.addEventListener('change', renderThumbs)
  coverInput.addEventListener('change', renderThumbs)

  async function getSignedData(filename, filetype, public_id, folder){
    const SIGN_ENDPOINT = window.SIGN_ENDPOINT;
    const ADMIN_SECRET = window.ADMIN_SECRET || null;
    const body = { filename, filetype };
    if(public_id) body.public_id = public_id;
    if(folder) body.folder = folder;
    const headers = { 'Content-Type': 'application/json' };
    if(ADMIN_SECRET) headers['x-admin-secret'] = ADMIN_SECRET;
    const res = await fetch(SIGN_ENDPOINT, {
      method:'POST',
      headers,
      body: JSON.stringify(body)
    })
    if(!res.ok){
      const payload = await res.json().catch(()=>null)
      const msg = (payload && payload.error) ? payload.error : ('Cannot get signed data: '+res.status)
      throw new Error(msg)
    }
    return await res.json()
  }

  async function uploadFile(file, signed, eager='', context=''){
    return new Promise((resolve,reject)=>{
      const url = `https://api.cloudinary.com/v1_1/${signed.cloud_name}/${file.type.startsWith('image/')?'image':'video'}/upload`
      const fd = new FormData()
      fd.append('file', file)
      fd.append('api_key', signed.api_key)
      fd.append('timestamp', signed.timestamp)
      fd.append('signature', signed.signature)
      fd.append('folder', signed.folder)
      if(signed.public_id) fd.append('public_id', signed.public_id)
      if(context) fd.append('context', context)
      if(eager) fd.append('eager', eager)
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url)
      const p = document.createElement('div')
      p.textContent = file.name + ' ...0%'
      progressList.appendChild(p)
      xhr.upload.addEventListener('progress', e=>{if(e.lengthComputable){
          const percent = Math.round(e.loaded / e.total * 100)
          p.textContent = file.name + ' ...'+percent+'%'
        }
      })
      xhr.onload = ()=> {
        if(xhr.status>=200 && xhr.status<300){
          p.textContent = file.name + ' uploaded'
          resolve(JSON.parse(xhr.responseText))
        }else reject(xhr.responseText)
      }
      xhr.onerror = ()=> reject('Upload error')
      xhr.send(fd)
    })
  }

  uploadForm.addEventListener('submit', async e=>{
    e.preventDefault()
    uploadStatus.textContent='Uploading files...'
    const title = uploadForm.title.value
    const artist = uploadForm.artist.value
    if(!qualitiesInput.files.length){
      alert('Please select at least one audio/video file')
      return
    }
    try{
      // Build a safe base public_id from artist/title
      function safe(s){
        return String(s||'').toLowerCase().replace(/[^a-z0-9-_]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)
      }
      const baseId = safe((artist?artist+'-':'') + (title||'untitled'))
      const folder = 'flavournous'

      // Upload cover first (if present)
      let coverData = null
      if(coverInput.files.length){
        const c = coverInput.files[0]
        const public_id = baseId + '-cover'
        const signedCover = await getSignedData(c.name,c.type, public_id, folder)
        // include context with title/artist/type
        const ctx = `title=${encodeURIComponent(title)}|artist=${encodeURIComponent(artist)}|type=cover`
        coverData = await uploadFile(c,signedCover,'',ctx)
      }

      // Upload all quality files
      const uploaded = []
      for(const f of qualitiesInput.files){
        const basename = f.name.replace(/\.[^.]+$/, '')
        const qualityLabel = basename
        const public_id = baseId + '-' + safe(qualityLabel)
        const signed = await getSignedData(f.name,f.type, public_id, folder)
        const eagerTransform = f.type.startsWith('video/') ? "w_320,h_180,c_fill,so_0" : ""
        const ctx = `title=${encodeURIComponent(title)}|artist=${encodeURIComponent(artist)}|quality=${encodeURIComponent(qualityLabel)}`
        const data = await uploadFile(f,signed,eagerTransform,ctx)
        uploaded.push(data)
      }

      // Optionally: you can now send metadata to a DB or trigger webhook

      uploadStatus.textContent='Upload complete! '+uploaded.length+' files uploaded.'
      qualitiesInput.value=''
      coverInput.value=''
      thumbs.innerHTML=''
      progressList.innerHTML=''

    }catch(err){
      console.error(err)
      alert('Upload failed: '+err)
      uploadStatus.textContent='Upload failed'
    }
  })

})
