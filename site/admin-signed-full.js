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

  // Initialize Netlify Identity
  if(window.netlifyIdentity){
    netlifyIdentity.init()
    netlifyIdentity.on('login', user=>{
      currentUser = user
      authWrap.style.display='none'
      uploadWrap.style.display='block'
    })
    netlifyIdentity.on('logout', ()=>{
      currentUser = null
      authWrap.style.display='block'
      uploadWrap.style.display='none'
    })
  }

  loginBtn.onclick = ()=> netlifyIdentity.open()

  logoutBtn.onclick = ()=>{
    netlifyIdentity.logout()
  }

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

  async function getSignedData(filename, filetype){
    const res = await fetch('/.netlify/functions/sign-upload', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({filename,filetype})
    })
    if(!res.ok) throw new Error('Cannot get signed data')
    return await res.json()
  }

  async function uploadFile(file, signed, eager=''){
    return new Promise((resolve,reject)=>{
      const url = `https://api.cloudinary.com/v1_1/${signed.cloud_name}/${file.type.startsWith('image/')?'image':'video'}/upload`
      const fd = new FormData()
      fd.append('file', file)
      fd.append('api_key', signed.api_key)
      fd.append('timestamp', signed.timestamp)
      fd.append('signature', signed.signature)
      fd.append('folder', signed.folder)
      if(signed.public_id) fd.append('public_id', signed.public_id)
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
      // Upload cover first
      let coverData = null
      if(coverInput.files.length){
        const c = coverInput.files[0]
        const signedCover = await getSignedData(c.name,c.type)
        coverData = await uploadFile(c,signedCover)
      }

      // Upload all qualities
      const uploaded = []
      for(const f of qualitiesInput.files){
        const signed = await getSignedData(f.name,f.type)
        const eagerTransform = f.type.startsWith('video/') ? "w_320,h_180,c_fill,so_0" : ""
        const data = await uploadFile(f,signed,eagerTransform)
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