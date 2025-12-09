// site/admin-signed-full.js — cleaned, deduplicated, and fixed errors

document.addEventListener("DOMContentLoaded", function () {
  const authWrap = document.getElementById("authWrap");
  const uploadWrap = document.getElementById("uploadWrap");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const uploadForm = document.getElementById("uploadForm");
  const qualitiesInput = document.getElementById("qualitiesInput");
  const coverInput = document.getElementById("coverInput");
  const thumbs = document.getElementById("thumbs");
  const dropZone = document.getElementById("dropZone");
  const progressList = document.getElementById("progressList");
  const uploadStatus = document.getElementById("uploadStatus");

  // Safe defaults / config
  if (authWrap) authWrap.style.display = "none";
  if (uploadWrap) uploadWrap.style.display = "block";
  window.SIGN_ENDPOINT =
    window.SIGN_ENDPOINT ||
    "https://flavournous-sign-upload-production.shadrackechesa40.workers.dev";
  window.ADMIN_SECRET = window.ADMIN_SECRET || "dev-admin-secret-flavournous";
  if (loginBtn) loginBtn.onclick = () => {};
  if (logoutBtn) logoutBtn.onclick = () => {};

  function renderThumbs() {
    if (!thumbs) return;
    thumbs.innerHTML = "";
    if (qualitiesInput && qualitiesInput.files) {
      Array.from(qualitiesInput.files).forEach((file) => {
        const div = document.createElement("div");
        div.textContent = file.name;
        div.className = "thumb card";
        thumbs.appendChild(div);
      });
    }
    if (coverInput && coverInput.files && coverInput.files.length) {
      const coverDiv = document.createElement("div");
      coverDiv.textContent = "Cover: " + coverInput.files[0].name;
      coverDiv.className = "thumb card";
      thumbs.appendChild(coverDiv);
    }
  }

  if (qualitiesInput) qualitiesInput.addEventListener("change", renderThumbs);
  if (coverInput) coverInput.addEventListener("change", renderThumbs);

  // Drag & drop -> qualitiesInput
  if (dropZone && qualitiesInput) {
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "#aaa";
    });
    dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "rgba(255,255,255,0.03)";
    });
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "rgba(255,255,255,0.03)";
      const dt = e.dataTransfer;
      if (dt && dt.files) {
        // Build new FileList merging existing and dropped files
        try {
          const dataTransfer = new DataTransfer();
          Array.from(qualitiesInput.files || []).forEach((f) =>
            dataTransfer.items.add(f),
          );
          for (const file of dt.files) {
            if (
              file.type.startsWith("audio/") ||
              file.type.startsWith("video/") ||
              file.type.startsWith("application/")
            ) {
              dataTransfer.items.add(file);
            }
          }
          qualitiesInput.files = dataTransfer.files;
          renderThumbs();
        } catch (err) {
          // DataTransfer may not be supported in some environments; fallback to native assignment where possible
          console.warn("DataTransfer failed in drop handler", err);
        }
      }
    });
  }

  async function getSignedData(filename, filetype, public_id, folder) {
    const SIGN_ENDPOINT = window.SIGN_ENDPOINT;
    const ADMIN_SECRET = window.ADMIN_SECRET || null;
    const body = { filename, filetype };
    if (public_id) body.public_id = public_id;
    if (folder) body.folder = folder;
    const headers = { "Content-Type": "application/json" };
    if (ADMIN_SECRET) headers["x-admin-secret"] = ADMIN_SECRET;
    const res = await fetch(SIGN_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      const msg =
        payload && payload.error
          ? payload.error
          : "Cannot get signed data: " + res.status;
      throw new Error(msg);
    }
    return await res.json();
  }

  async function uploadFile(file, signed, eager = "", context = "") {
    return new Promise((resolve, reject) => {
      if (!signed) return reject(new Error("Missing signed upload data"));
      // Determine Cloudinary resource type: images -> image, videos -> video, audio/raw -> video (Cloudinary treats audio with video API)
      const mime = file && file.type ? file.type.toLowerCase() : "";
      let resource = "raw";
      if (mime.startsWith("image/")) resource = "image";
      else if (mime.startsWith("video/")) resource = "video";
      else if (mime.startsWith("audio/")) resource = "video"; // use video endpoint for audio uploads on Cloudinary

      const cloudName =
        signed.cloud_name ||
        signed.cloudinary_cloud_name ||
        signed.cloudinaryCloudName;
      if (!cloudName)
        return reject(new Error("Signed data missing cloud name"));
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resource}/upload`;
      const fd = new FormData();
      fd.append("file", file);
      if (signed.api_key) fd.append("api_key", signed.api_key);
      if (signed.timestamp) fd.append("timestamp", signed.timestamp);
      if (signed.signature) fd.append("signature", signed.signature);
      if (signed.folder) fd.append("folder", signed.folder);
      if (signed.public_id) fd.append("public_id", signed.public_id);
      if (context) fd.append("context", context);
      if (eager) fd.append("eager", eager);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      let p = null;
      if (progressList) {
        p = document.createElement("div");
        p.textContent = file.name + " ...0%";
        progressList.appendChild(p);
      }
      xhr.upload.addEventListener("progress", (ev) => {
        if (ev.lengthComputable && p) {
          const percent = Math.round((ev.loaded / ev.total) * 100);
          p.textContent = file.name + " ..." + percent + "%";
        }
      });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (p) p.textContent = file.name + " uploaded";
          try {
            const parsed = JSON.parse(xhr.responseText);
            // prefer secure_url
            return resolve(parsed);
          } catch (err) {
            // if response not JSON, return raw response
            return resolve({ raw: xhr.responseText });
          }
        } else {
          return reject(
            new Error(xhr.responseText || "Upload failed: " + xhr.status),
          );
        }
      };
      xhr.onerror = () => reject(new Error("Upload error"));
      xhr.send(fd);
    });
  }

  function safe(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
  }

  if (uploadForm) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (
        !qualitiesInput ||
        !qualitiesInput.files ||
        qualitiesInput.files.length === 0
      ) {
        alert("Please select at least one audio/video file");
        return;
      }
      // Accept title/artist from form inputs (by name) or named elements
      const titleEl =
        uploadForm.querySelector('[name="title"]') ||
        document.getElementById("title");
      const artistEl =
        uploadForm.querySelector('[name="artist"]') ||
        document.getElementById("artist");
      if (!titleEl || !artistEl) {
        alert("Form missing title/artist fields");
        return;
      }
      uploadStatus && (uploadStatus.textContent = "Uploading files...");
      try {
        const title = titleEl.value || "";
        const artist = artistEl.value || "";
        const baseId = safe(
          (artist ? artist + "-" : "") + (title || "untitled"),
        );
        const folder = "flavournous";

        // Upload cover first (if present)
        let coverData = null;
        if (coverInput && coverInput.files && coverInput.files.length) {
          const c = coverInput.files[0];
          const public_id = baseId + "-cover";
          const signedCover = await getSignedData(
            c.name,
            c.type,
            public_id,
            folder,
          );
          const ctx = `title=${encodeURIComponent(title)}|artist=${encodeURIComponent(artist)}|type=cover`;
          coverData = await uploadFile(c, signedCover, "", ctx);
        }

        // Upload quality files
        const uploaded = [];
        for (const f of Array.from(qualitiesInput.files)) {
          const basename = f.name.replace(/\.[^.]+$/, "");
          const qualityLabel = basename;
          const public_id = baseId + "-" + safe(qualityLabel);
          const signed = await getSignedData(f.name, f.type, public_id, folder);
          const eagerTransform =
            f.type && f.type.startsWith("video/")
              ? "w_320,h_180,c_fill,so_0"
              : "";
          const ctx = `title=${encodeURIComponent(title)}|artist=${encodeURIComponent(artist)}|quality=${encodeURIComponent(qualityLabel)}`;
          const data = await uploadFile(f, signed, eagerTransform, ctx);
          uploaded.push(data);
        }

        uploadStatus &&
          (uploadStatus.textContent =
            "Upload complete! " + uploaded.length + " files uploaded.");
        if (qualitiesInput) qualitiesInput.value = "";
        if (coverInput) coverInput.value = "";
        if (thumbs) thumbs.innerHTML = "";
        if (progressList) progressList.innerHTML = "";
      } catch (err) {
        console.error(err);
        alert(
          "Upload failed: " + (err && err.message ? err.message : String(err)),
        );
        uploadStatus && (uploadStatus.textContent = "Upload failed");
      }
    });
  }
});
