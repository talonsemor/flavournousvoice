// Admin dashboard with Cloudinary upload + auto-register to /media worker
document.addEventListener("DOMContentLoaded", function () {
  // Element refs (with safe fallbacks)
  const authWrap = document.getElementById("authWrap");
  const uploadWrap = document.getElementById("uploadWrap");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userEmailEl = document.getElementById("userEmail");

  const uploadForm = document.getElementById("uploadForm");
  const titleInput =
    document.getElementById("titleInput") ||
    document.querySelector('input[name="title"]');
  const artistInput =
    document.getElementById("artistInput") ||
    document.querySelector('input[name="artist"]');
  const albumInput =
    document.getElementById("albumInput") ||
    document.querySelector('input[name="album"]');
  const coverInput = document.getElementById("coverInput");
  const qualitiesInput = document.getElementById("qualitiesInput");
  const dropZone = document.getElementById("dropZone");
  const thumbs = document.getElementById("thumbs");
  const uploadBtn = document.getElementById("uploadBtn");
  const progressList = document.getElementById("progressList");
  const uploadStatus = document.getElementById("uploadStatus");

  const mediaList = document.getElementById("mediaList");
  const playerModal = document.getElementById("playerModal");
  const modalClose = document.getElementById("modalClose");
  const audioPlayer = document.getElementById("audioPlayer");
  const videoPlayer = document.getElementById("videoPlayer");
  const playerTitle = document.getElementById("playerTitle");
  const playerMetadata = document.getElementById("playerMetadata");
  const downloadFromPlayer = document.getElementById("downloadFromPlayer");

  // --- ADDED: audio/video error logging + helper ---
  if (audioPlayer) {
    audioPlayer.addEventListener("error", (e) =>
      console.error("audioPlayer error", e, audioPlayer.error),
    );
    audioPlayer.addEventListener("ended", () => {
      // placeholder: keep modal open or auto-close
    });
  }
  if (videoPlayer) {
    videoPlayer.addEventListener("error", (e) =>
      console.error("videoPlayer error", e, videoPlayer.error),
    );
  }

  function safeText(el, text) {
    if (!el) return;
    el.textContent = text || "";
  }
  // --- end additions ---

  // state
  let currentUser = null;
  let selectedFiles = [];
  let currentMediaUrl = null;

  // Cloudflare / admin default UI behavior (safe guards)
  if (authWrap) authWrap.style.display = "none";
  if (uploadWrap) uploadWrap.style.display = "block";
  if (userEmailEl) userEmailEl.textContent = "Admin";
  if (loginBtn) loginBtn.onclick = () => {};
  if (logoutBtn) logoutBtn.onclick = () => {};
  // Treat as authenticated in admin environment
  currentUser = { email: "admin" };

  // Utility: sanitize public_id
  function sanitizePublicId(str) {
    return String(str || "")
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
  }

  // UI helpers
  function showStatus(type, message) {
    if (!uploadStatus) return;
    uploadStatus.className = type;
    uploadStatus.textContent = message;
    uploadStatus.style.display = "block";
    setTimeout(() => {
      if (uploadStatus) uploadStatus.style.display = "none";
    }, 5000);
  }

  function showProgress(id, label, percent, status) {
    if (!progressList) return;
    let item = document.getElementById(`progress-${id}`);
    if (!item) {
      item = document.createElement("div");
      item.id = `progress-${id}`;
      item.className = "progress-item";
      progressList.appendChild(item);
    }
    const statusText =
      status === "success" ? "✅" : status === "error" ? "❌" : "";
    item.innerHTML = `<div class="progress-label">${label} ${statusText}</div>
            <div class="progress-bar"><div style="width:${percent}%;" class="progress-fill"></div></div>
            <div class="progress-percent">${percent}%</div>`;
  }

  // Drop zone & file selection
  if (dropZone && qualitiesInput) {
    dropZone.addEventListener("click", () => qualitiesInput.click());

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      if (e.dataTransfer && e.dataTransfer.files)
        handleFiles(e.dataTransfer.files);
    });

    qualitiesInput.addEventListener("change", (e) => {
      if (e.target && e.target.files) handleFiles(e.target.files);
    });
  }

  function handleFiles(fileList) {
    Array.from(fileList).forEach((f) => {
      const exists = selectedFiles.some(
        (s) => s.name === f.name && s.size === f.size,
      );
      if (!exists) selectedFiles.push(f);
    });
    updateThumbnails();
  }

  function updateThumbnails() {
    if (!thumbs) return;
    thumbs.innerHTML = "";
    selectedFiles.forEach((file, idx) => {
      const d = document.createElement("div");
      d.className = "thumb-item";
      d.textContent = file.name + " (" + Math.round(file.size / 1024) + "KB)";
      const rem = document.createElement("button");
      rem.type = "button";
      rem.textContent = "Remove";
      rem.onclick = () => {
        selectedFiles.splice(idx, 1);
        updateThumbnails();
      };
      d.appendChild(rem);
      thumbs.appendChild(d);
    });
    if (coverInput && coverInput.files && coverInput.files[0]) {
      const cover = coverInput.files[0];
      const cd = document.createElement("div");
      cd.className = "thumb-item cover";
      cd.textContent = "Cover: " + cover.name;
      thumbs.appendChild(cd);
    }
  }

  // --- Register uploaded media with worker /media endpoint ---
  async function registerMediaWithWorker(item) {
    try {
      const workerBase = (
        window.MEDIA_ENDPOINT ||
        window.SIGN_ENDPOINT ||
        window.WORKER_URL ||
        ""
      ).replace(/\/$/, "");
      const url = workerBase
        ? `${workerBase}/media`
        : "/api/media";
      const headers = { "Content-Type": "application/json" };
      if (window.ADMIN_SECRET) headers["x-admin-secret"] = window.ADMIN_SECRET;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(item),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => null);
        console.warn("registerMediaWithWorker failed", res.status, txt);
        return false;
      }
      console.log(
        "registerMediaWithWorker success",
        await res.json().catch(() => null),
      );
      return true;
    } catch (err) {
      console.error("registerMediaWithWorker error", err);
      return false;
    }
  }

  // --- Signing & upload helpers (attempt basic implementations; adapt if your backend differs) ---
  async function getSignedData(public_id_or_name, filetype = "auto", quality) {
    // Try to call configured SIGN_ENDPOINT or worker; return parsed JSON or null.
    const base = window.SIGN_ENDPOINT || window.WORKER_URL || "";
    const endpoint = base
      ? `${base.replace(/\/$/, "")}/sign`
      : "/api/sign";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: public_id_or_name, filetype, quality }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn("getSignedData: sign endpoint unavailable", err);
      return null;
    }
  }

  async function uploadToCloudinary(
    file,
    signed,
    tagOrQuality = "original",
    context = {},
  ) {
    // Expect signed to include upload_url and fields (Cloudinary direct form upload) OR upload_url alone.
    if (!signed) throw new Error("Missing signed upload data");
    // If signed.upload_url and signed.fields exist -> Form POST
    if (signed.upload_url && signed.fields) {
      const fd = new FormData();
      Object.entries(signed.fields).forEach(([k, v]) => fd.append(k, v));
      fd.append("file", file);
      // optionally add context params
      if (context && typeof context === "object") {
        Object.entries(context).forEach(([k, v]) => {
          if (v !== undefined && v !== null) fd.append(k, v);
        });
      }
      const res = await fetch(signed.upload_url, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed: " + res.status);
      // Cloudinary returns XML/JSON depending on signed config; attempt to parse JSON or fallback to URL composition
      try {
        const json = await res.json().catch(() => null);
        if (json && json.secure_url) return json.secure_url;
      } catch (e) {
        /* ignore */
      }
      // fallback: if signed.public_url provided, return it
      if (signed.secure_url) return signed.secure_url;
      return null;
    }

    // If signed.direct_upload_url provided -> assume it accepts PUT and returns a URL
    if (signed.direct_upload_url) {
      const putRes = await fetch(signed.direct_upload_url, {
        method: "PUT",
        body: file,
      });
      if (!putRes.ok) throw new Error("Direct upload failed: " + putRes.status);
      // assume signed.result_url or direct_upload_url is final
      return signed.result_url || signed.direct_upload_url;
    }

    throw new Error("Unsupported signed upload response format");
  }

  // ============ FORM SUBMISSION & UPLOAD ============
  if (uploadForm) {
    uploadForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      if (!currentUser) {
        showStatus("error", "Not authenticated");
        return;
      }

      const title =
        titleInput && titleInput.value ? titleInput.value.trim() : "";
      const artist =
        artistInput && artistInput.value ? artistInput.value.trim() : "";
      const album =
        albumInput && albumInput.value ? albumInput.value.trim() : "";
      const coverFile =
        coverInput && coverInput.files && coverInput.files[0]
          ? coverInput.files[0]
          : null;
      const qualities = Array.from(
        document.querySelectorAll(".quality-check:checked"),
      ).map((c) => c.value);

      if (
        !title ||
        !artist ||
        !coverFile ||
        selectedFiles.length === 0 ||
        qualities.length === 0
      ) {
        showStatus("error", "Please fill in all required fields");
        return;
      }

      if (uploadBtn) uploadBtn.disabled = true;
      if (progressList) progressList.innerHTML = "";
      if (uploadStatus) uploadStatus.style.display = "none";

      try {
        // 1) get signed data for cover
        const coverSigned = await getSignedData(
          sanitizePublicId(`${artist}-${title}-cover`),
          "image",
        );
        if (!coverSigned)
          throw new Error("Failed to get signed data for cover");
        showProgress("cover", "Uploading cover", 10);
        const coverUrl = await uploadToCloudinary(
          coverFile,
          coverSigned,
          "cover",
          { context: `title=${title}|artist=${artist}` },
        );
        showProgress("cover", "Uploading cover", 100, "success");

        // 2) upload selected files for each quality
        const uploadedQualities = [];
        let uploadedCount = 0;

        for (const file of selectedFiles) {
          for (const q of qualities) {
            const publicId = sanitizePublicId(`${artist}-${title}-${q}`);
            const signed = await getSignedData(publicId, "audio", q);
            if (!signed) {
              console.warn("No signed data for", publicId);
              continue;
            }
            showProgress(
              `${file.name}-${q}`,
              `Uploading ${file.name} (${q})`,
              5,
            );
            try {
              const fileUrl = await uploadToCloudinary(file, signed, q, {
                title,
                artist,
                album: album || "Unknown",
                quality: q,
                public_id: publicId,
              });
              if (fileUrl) {
                uploadedQualities.push({
                  label: q,
                  url: fileUrl,
                  public_id: publicId,
                });
                uploadedCount++;
                showProgress(
                  `${file.name}-${q}`,
                  `Uploaded ${file.name} (${q})`,
                  100,
                  "success",
                );
              } else {
                showProgress(
                  `${file.name}-${q}`,
                  `Upload failed ${file.name} (${q})`,
                  0,
                  "error",
                );
              }
            } catch (uerr) {
              console.error("upload error", uerr);
              showProgress(
                `${file.name}-${q}`,
                `Upload failed ${file.name} (${q})`,
                0,
                "error",
              );
            }
          }
        }

        if (uploadedQualities.length === 0)
          throw new Error("No files uploaded successfully");

        // 3) register with /media worker
        try {
          const firstQualityUrl = uploadedQualities[0].url;
          const item = {
            url: firstQualityUrl,
            title,
            artist,
            album: album || "Unknown",
            image: coverUrl,
            qualities: uploadedQualities,
            public_id: uploadedQualities[0].public_id,
          };
          await registerMediaWithWorker(item);
        } catch (regErr) {
          console.warn("media registration failed", regErr);
        }

        showStatus("success", `Upload complete: ${uploadedCount} files`);
        uploadForm.reset();
        selectedFiles = [];
        updateThumbnails();
        // reload listing
        setTimeout(() => loadMediaLibrary().catch(() => {}), 1500);
      } catch (err) {
        console.error("Upload flow error", err);
        showStatus("error", err && err.message ? err.message : String(err));
      } finally {
        if (uploadBtn) uploadBtn.disabled = false;
      }
    });
  }

  // ============ MEDIA LIBRARY / PLAYER (basic stubs) ============
  async function loadMediaLibrary() {
    if (!mediaList) return;
    try {
      const base = window.MEDIA_ENDPOINT || window.SIGN_ENDPOINT || "";
      const url = base
        ? `${base.replace(/\/$/, "")}/media`
        : "/api/media";
      const res = await fetch(url);
      if (!res.ok) {
        mediaList.innerHTML = `<div class="muted">Failed to load media (${res.status})</div>`;
        return;
      }
      const data = await res.json().catch(() => null);
      if (!data || !Array.isArray(data)) {
        mediaList.innerHTML = `<div class="muted">No media available</div>`;
        return;
      }
      mediaList.innerHTML = "";
      data.forEach((item) => {
        const el = document.createElement("div");
        el.className = "media-item";
        el.innerHTML = `<div class="title">${item.title || "Untitled"}</div>
                    <div class="meta">${item.artist || ""}</div>
                    <button type="button" class="play-btn">Play</button>`;
        const playBtn = el.querySelector(".play-btn");
        playBtn.onclick = () => playMedia(item);
        mediaList.appendChild(el);
      });
    } catch (e) {
      console.warn("loadMediaLibrary error", e);
      mediaList.innerHTML = `<div class="muted">Error loading media</div>`;
    }
  }

  // --- REPLACED playMedia: safer pause/load/play and UI updates ---
  function playMedia(item) {
    if (!playerModal) return;
    currentMediaUrl = item && item.url ? item.url : null;

    // Pause both players first (safe-guard)
    try {
      if (audioPlayer && !audioPlayer.paused) audioPlayer.pause();
    } catch (e) {}
    try {
      if (videoPlayer && !videoPlayer.paused) videoPlayer.pause();
    } catch (e) {}

    const isVideo = item && item.resource_type === "video";
    if (isVideo && videoPlayer) {
      videoPlayer.src = item.url || "";
      if (audioPlayer) audioPlayer.src = "";
      // show video player, hide audio player
      try {
        if (videoPlayer.style) videoPlayer.style.display = "block";
        if (audioPlayer && audioPlayer.style) audioPlayer.style.display = "none";
      } catch (e) {}
      videoPlayer.load();
      videoPlayer.play().catch((err) => console.warn("video play failed", err));
    } else if (audioPlayer) {
      audioPlayer.src = item.url || "";
      if (videoPlayer) videoPlayer.src = "";
      // show audio player, hide video player
      try {
        if (audioPlayer.style) audioPlayer.style.display = "block";
        if (videoPlayer && videoPlayer.style) videoPlayer.style.display = "none";
      } catch (e) {}
      audioPlayer.load();
      audioPlayer.play().catch((err) => console.warn("audio play failed", err));
    }

    safeText(playerTitle, item && item.title ? item.title : "");
    safeText(playerMetadata, item && item.artist ? item.artist : "");
    playerModal.classList && playerModal.classList.add("active");
  }

  // --- REPLACED downloadMedia: try fetch->blob then fallback to direct link ---
  function downloadMedia(item) {
    if (!item || !item.url) return;
    (async () => {
      try {
        const res = await fetch(item.url, { mode: "cors" });
        if (!res.ok) throw new Error("Download failed: " + res.status);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = item.title || "download";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.warn("Blob download failed, falling back to direct link", err);
        const a = document.createElement("a");
        a.href = item.url;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    })();
  }

  async function deleteMedia(publicId) {
    // Implement server call to delete; stub for now
    console.log("deleteMedia called for", publicId);
    await loadMediaLibrary();
  }

  // Modal close handlers
  if (modalClose)
    modalClose.onclick = () => {
      if (audioPlayer && !audioPlayer.paused) try { audioPlayer.pause(); } catch (e) {}
      if (videoPlayer && !videoPlayer.paused) try { videoPlayer.pause(); } catch (e) {}
      playerModal && playerModal.classList && playerModal.classList.remove("active");
      try {
        if (audioPlayer && audioPlayer.style) audioPlayer.style.display = "none";
        if (videoPlayer && videoPlayer.style) videoPlayer.style.display = "none";
      } catch (e) {}
    };
  if (playerModal)
    playerModal.onclick = (e) => {
      if (e.target === playerModal) {
        if (audioPlayer && !audioPlayer.paused) try { audioPlayer.pause(); } catch (e) {}
        if (videoPlayer && !videoPlayer.paused) try { videoPlayer.pause(); } catch (e) {}
        playerModal.classList.remove("active");
        try {
          if (audioPlayer && audioPlayer.style) audioPlayer.style.display = "none";
          if (videoPlayer && videoPlayer.style) videoPlayer.style.display = "none";
        } catch (e) {}
      }
    };
  if (downloadFromPlayer)
    downloadFromPlayer.onclick = () =>
      downloadMedia({
        url: currentMediaUrl,
        title: playerTitle && playerTitle.textContent,
      });

  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      playerModal &&
      playerModal.classList.contains("active")
    ) {
      playerModal.classList.remove("active");
    }
  });

  // initial load
  loadMediaLibrary().catch(() => {});
});
