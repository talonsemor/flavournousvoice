// site/admin-dashboard.js
// Complete admin dashboard functionality with login redirect, uploads, and media library

document.addEventListener('DOMContentLoaded', function() {
    const authWrap = document.getElementById('authWrap')
    const uploadWrap = document.getElementById('uploadWrap')
    const loginBtn = document.getElementById('loginBtn')
    const logoutBtn = document.getElementById('logoutBtn')
    const userEmailEl = document.getElementById('userEmail')
    
    const uploadForm = document.getElementById('uploadForm')
    const titleInput = document.getElementById('titleInput')
    const artistInput = document.getElementById('artistInput')
    const albumInput = document.getElementById('albumInput')
    const coverInput = document.getElementById('coverInput')
    const qualitiesInput = document.getElementById('qualitiesInput')
    const dropZone = document.getElementById('dropZone')
    const thumbs = document.getElementById('thumbs')
    const uploadBtn = document.getElementById('uploadBtn')
    const progressList = document.getElementById('progressList')
    const uploadStatus = document.getElementById('uploadStatus')
    
    const mediaList = document.getElementById('mediaList')
    const playerModal = document.getElementById('playerModal')
    const modalClose = document.getElementById('modalClose')
    const audioPlayer = document.getElementById('audioPlayer')
    const videoPlayer = document.getElementById('videoPlayer')
    const playerTitle = document.getElementById('playerTitle')
    const playerMetadata = document.getElementById('playerMetadata')
    const downloadFromPlayer = document.getElementById('downloadFromPlayer')

    let currentUser = null
    let selectedFiles = []
    let currentMediaUrl = null

    // Cloudflare-only: Show dashboard by default (no login)
    authWrap.style.display = 'none';
    uploadWrap.style.display = 'block';
    userEmailEl.textContent = 'Admin';
    // Login/Logout buttons do nothing
    loginBtn.onclick = () => {};
    logoutBtn.onclick = () => {};

    // ============ DROP ZONE & FILE SELECTION ============
    dropZone.addEventListener('click', () => qualitiesInput.click())

    dropZone.addEventListener('dragover', e => {
        e.preventDefault()
        dropZone.classList.add('dragover')
    })

    dropZone.addEventListener('dragleave', e => {
        e.preventDefault()
        dropZone.classList.remove('dragover')
    })

    dropZone.addEventListener('drop', e => {
        e.preventDefault()
        dropZone.classList.remove('dragover')
        handleFiles(e.dataTransfer.files)
    })

    qualitiesInput.addEventListener('change', e => {
        handleFiles(e.target.files)
    })

    function handleFiles(files) {
        selectedFiles = Array.from(files)
        updateThumbnails()
    }

    function updateThumbnails() {
        thumbs.innerHTML = ''
        selectedFiles.forEach((file, idx) => {
            const div = document.createElement('div')
            div.className = 'thumb-item'

            const preview = document.createElement('div')
            preview.style.width = '100%'
            preview.style.height = '100%'
            preview.style.display = 'flex'
            preview.style.alignItems = 'center'
            preview.style.justifyContent = 'center'

            if (file.type.startsWith('image/')) {
                const img = document.createElement('img')
                img.src = URL.createObjectURL(file)
                preview.appendChild(img)
            } else if (file.type.startsWith('video/')) {
                const icon = document.createElement('div')
                icon.textContent = '🎬'
                icon.style.fontSize = '2em'
                preview.appendChild(icon)
            } else {
                const icon = document.createElement('div')
                icon.textContent = '🎵'
                icon.style.fontSize = '2em'
                preview.appendChild(icon)
            }

            div.appendChild(preview)

            const filename = document.createElement('div')
            filename.className = 'filename'
            filename.textContent = file.name
            div.appendChild(filename)

            const removeBtn = document.createElement('button')
            removeBtn.className = 'remove-btn'
            removeBtn.textContent = '✕'
            removeBtn.type = 'button'
            removeBtn.onclick = e => {
                e.preventDefault()
                selectedFiles.splice(idx, 1)
                updateThumbnails()
            }
            div.appendChild(removeBtn)

            thumbs.appendChild(div)
        })
    }

    // ============ FORM SUBMISSION & UPLOAD ============
    uploadForm.addEventListener('submit', async e => {
        e.preventDefault()

        if (!currentUser) {
            showStatus('error', '❌ Not authenticated. Please login first.')
            return
        }

        const title = titleInput.value.trim()
        const artist = artistInput.value.trim()
        const album = albumInput.value.trim()
        const coverFile = coverInput.files[0]
        const qualities = Array.from(document.querySelectorAll('.quality-check:checked')).map(c => c.value)

        if (!title || !artist || !coverFile || selectedFiles.length === 0 || qualities.length === 0) {
            showStatus('error', '❌ Please fill in all required fields.')
            return
        }

        uploadBtn.disabled = true
        progressList.innerHTML = ''
        uploadStatus.style.display = 'none'

        try {
            // Get signed upload data from Netlify Function
            const signedData = await getSignedData(title, artist, qualities[0])

            if (!signedData) {
                throw new Error('Failed to get signed upload data')
            }

            // Upload cover
            showProgress('cover', 'Uploading cover image...', 0)
            const coverUrl = await uploadToCloudinary(coverFile, signedData, 'cover')

            if (!coverUrl) {
                throw new Error('Cover upload failed')
            }

            // Upload quality files
            let uploadedCount = 0
            for (const file of selectedFiles) {
                for (const quality of qualities) {
                    const publicId = sanitizePublicId(`${artist}-${title}-${quality}`)
                    const signed = await getSignedData(`${artist}-${title}-${quality}`, title, quality)

                    if (signed) {
                        await uploadToCloudinary(
                            file,
                            signed,
                            quality,
                            {
                                title,
                                artist,
                                album: album || 'Unknown',
                                quality,
                                public_id: publicId
                            }
                        )
                        uploadedCount++
                    }
                }
            }

            showStatus('success', `✅ Upload successful! ${uploadedCount} files uploaded.`)
            uploadForm.reset()
            selectedFiles = []
            updateThumbnails()

            // Reload media library
            setTimeout(loadMediaLibrary, 2000)

        } catch (err) {
            console.error('Upload error:', err)
            showStatus('error', `❌ Upload failed: ${err.message}`)
        } finally {
            uploadBtn.disabled = false
        }
    })

    // ============ HELPER FUNCTIONS ============
    async function getSignedData(filename, filetype, quality) {
        // Cloudflare Worker endpoint only
        const SIGN_ENDPOINT = window.SIGN_ENDPOINT;
        const ADMIN_SECRET = window.ADMIN_SECRET || null;
        try {
            let headers = { 'Content-Type': 'application/json' };
            if (ADMIN_SECRET) headers['x-admin-secret'] = ADMIN_SECRET;
            const response = await fetch(SIGN_ENDPOINT, {
                method: 'POST',
                headers,
                body: JSON.stringify({ filename, filetype, quality })
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                const msg = (payload && payload.error) ? payload.error : `Sign request failed (${response.status})`;
                throw new Error(msg);
            }
            return await response.json();
        } catch (err) {
            console.error('Error getting signed data:', err);
            return null;
        }
    }

    function sanitizePublicId(str) {
        return str
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 60)
    }

    async function uploadToCloudinary(file, signed, quality, context) {
        return new Promise((resolve, reject) => {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('signature', signed.signature)
            formData.append('api_key', signed.api_key)
            formData.append('timestamp', signed.timestamp)
            formData.append('folder', signed.folder)
            formData.append('public_id', signed.public_id || sanitizePublicId(`${context?.artist}-${context?.title}-${quality}`))

            if (context) {
                formData.append('context', `title=${context.title}|artist=${context.artist}|album=${context.album}|quality=${context.quality}`)
            }

            const xhr = new XMLHttpRequest()

            xhr.upload.addEventListener('progress', e => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100)
                    showProgress(quality, `${file.name} (${quality})`, percent)
                }
            })

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    showProgress(quality, `${file.name} (${quality})`, 100, 'success')
                    resolve(JSON.parse(xhr.responseText).secure_url)
                } else {
                    showProgress(quality, `${file.name} (${quality}) - Failed`, 0, 'error')
                    reject(new Error('Upload failed: ' + xhr.statusText))
                }
            })

            xhr.addEventListener('error', () => {
                showProgress(quality, `${file.name} (${quality}) - Error`, 0, 'error')
                reject(new Error('Network error during upload'))
            })

            xhr.open('POST', `https://api.cloudinary.com/v1_1/${signed.cloud_name}/auto/upload`)
            xhr.send(formData)
        })
    }

    function showProgress(id, label, percent, status = '') {
        let item = document.getElementById(`progress-${id}`)
        if (!item) {
            item = document.createElement('div')
            item.id = `progress-${id}`
            item.className = 'progress-item'
            progressList.appendChild(item)
        }

        let statusClass = ''
        let statusText = `${percent}%`
        if (status === 'success') {
            statusClass = 'progress-success'
            statusText = '✅ Complete'
        } else if (status === 'error') {
            statusClass = 'progress-error'
            statusText = '❌ Failed'
        }

        item.innerHTML = `
            <div class="progress-filename">${label}</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percent}%"></div>
            </div>
            <div class="progress-text ${statusClass}">${statusText}</div>
        `
    }

    function showStatus(type, message) {
        uploadStatus.className = type
        uploadStatus.textContent = message
        uploadStatus.style.display = 'block'
        setTimeout(() => {
            uploadStatus.style.display = 'none'
        }, 5000)
    }

    // ============ MEDIA LIBRARY ============
    async function loadMediaLibrary() {
        try {
            const response = await fetch('/.netlify/functions/media')
            if (!response.ok) throw new Error('Failed to load media')

            const data = await response.json()
            const albums = data.albums || []

            if (albums.length === 0) {
                mediaList.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: rgba(255,255,255,0.6); padding: 40px 20px;">No media uploaded yet. Start by uploading some tracks!</p>'
                return
            }

            mediaList.innerHTML = ''
            albums.forEach(album => {
                const item = document.createElement('div')
                item.className = 'media-item'

                const thumbnail = document.createElement('div')
                thumbnail.className = 'media-thumbnail'

                if (album.cover_url) {
                    const img = document.createElement('img')
                    img.src = album.cover_url
                    img.onerror = () => {
                        thumbnail.textContent = '🎵'
                    }
                    thumbnail.appendChild(img)
                } else {
                    thumbnail.textContent = '🎵'
                }

                item.appendChild(thumbnail)

                const info = document.createElement('div')
                info.className = 'media-info'

                const title = document.createElement('div')
                title.className = 'media-title'
                title.textContent = album.title || 'Unknown'

                const meta = document.createElement('div')
                meta.className = 'media-meta'
                meta.textContent = `${album.artist || 'Unknown'}`

                info.appendChild(title)
                info.appendChild(meta)

                const actions = document.createElement('div')
                actions.className = 'media-actions'

                const playBtn = document.createElement('button')
                playBtn.className = 'media-btn media-btn-play'
                playBtn.textContent = '▶️ Play'
                playBtn.onclick = () => playMedia(album)

                const downloadBtn = document.createElement('button')
                downloadBtn.className = 'media-btn media-btn-download'
                downloadBtn.textContent = '⬇️'
                downloadBtn.onclick = () => downloadMedia(album)

                const deleteBtn = document.createElement('button')
                deleteBtn.className = 'media-btn media-btn-delete'
                deleteBtn.textContent = '🗑️'
                deleteBtn.onclick = () => {
                    if (confirm(`Delete "${album.title}"?`)) {
                        deleteMedia(album.public_id)
                    }
                }

                actions.appendChild(playBtn)
                actions.appendChild(downloadBtn)
                actions.appendChild(deleteBtn)

                info.appendChild(actions)
                item.appendChild(info)
                mediaList.appendChild(item)
            })
        } catch (err) {
            console.error('Error loading media:', err)
            mediaList.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--danger);">Failed to load media library</p>'
        }
    }

    function playMedia(album) {
        playerTitle.textContent = `${album.title} - ${album.artist}`
        playerMetadata.textContent = `Album: ${album.album || 'Unknown'} | Quality: ${album.quality || 'Standard'}`
        currentMediaUrl = album.url

        if (album.type?.startsWith('video')) {
            audioPlayer.style.display = 'none'
            videoPlayer.style.display = 'block'
            videoPlayer.src = album.url
        } else {
            videoPlayer.style.display = 'none'
            audioPlayer.style.display = 'block'
            audioPlayer.src = album.url
        }

        playerModal.classList.add('active')
    }

    function downloadMedia(album) {
        const link = document.createElement('a')
        link.href = album.url
        link.download = `${album.artist}-${album.title}.${album.type?.split('/')[1] || 'mp3'}`
        link.click()
    }

    async function deleteMedia(publicId) {
        try {
            const response = await fetch('/.netlify/functions/media', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ public_id: publicId })
            })

            if (!response.ok) throw new Error('Delete failed')
            loadMediaLibrary()
            showStatus('success', '✅ Media deleted successfully')
        } catch (err) {
            console.error('Delete error:', err)
            showStatus('error', `❌ Failed to delete: ${err.message}`)
        }
    }

    // Modal close
    modalClose.onclick = () => playerModal.classList.remove('active')
    playerModal.onclick = e => {
        if (e.target === playerModal) {
            playerModal.classList.remove('active')
        }
    }

    downloadFromPlayer.onclick = () => {
        if (currentMediaUrl) {
            const link = document.createElement('a')
            link.href = currentMediaUrl
            link.download = true
            link.click()
        }
    }

    // Escape key to close modal
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            playerModal.classList.remove('active')
        }
    })
});
