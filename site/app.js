async function fetchMedia() {
  // Cloudflare Worker endpoint for media listing (implement if needed)
  // const res = await fetch('https://YOUR_WORKER_URL/media')
  // If no backend is available, return a sample item so homepage shows media.
  const sampleUrl =
    "https://res.cloudinary.com/dsse7gz6b/video/upload/v1765013350/wyytxkdr8oqjgyasemou.mp3";
  const secondUrl =
    "https://res.cloudinary.com/dsse7gz6b/video/upload/v1765013345/is6l4ugksztca8fozqkw.mp3";
  const thirdUrl =
    "https://res.cloudinary.com/dsse7gz6b/video/upload/v1765516403/znmp9n0w6ens0hs7ebvb.mp3";
  const fourthUrl =
    "https://res.cloudinary.com/dsse7gz6b/video/upload/v1765516411/mb9aiywzvpvgslvr15qx.mp3";
  const fifthUrl =
    "https://res.cloudinary.com/dsse7gz6b/video/upload/v1765516412/b28ovmcylfytxcvhqb3j.mp3";
  const sixthUrl =
    "https://res.cloudinary.com/dsse7gz6b/video/upload/v1765516417/wu567ivlnjxer04szh4w.mp3";
  const seventhUrl =
    "https://res.cloudinary.com/dsse7gz6b/video/upload/v1765516532/ro9l5kz56yibwuhagmwo.mp3";
  const sample = [
    {
      title: "Sample Track",
      artist: "Flavournous",
      url: sampleUrl,
      image: "",
      qualities: [{ label: "Original", url: sampleUrl }],
    },
    {
      title: "nakupenda",
      artist: "Flavournous",
      url: secondUrl,
      image: "",
      qualities: [{ label: "Original", url: secondUrl }],
    },
    {
      title: "Extra Track 1",
      artist: "Flavournous",
      url: thirdUrl,
      image: "",
      qualities: [{ label: "Original", url: thirdUrl }],
    },
    {
      title: "Extra Track 2",
      artist: "Flavournous",
      url: fourthUrl,
      image: "",
      qualities: [{ label: "Original", url: fourthUrl }],
    },
    {
      title: "Extra Track 3",
      artist: "Flavournous",
      url: fifthUrl,
      image: "",
      qualities: [{ label: "Original", url: fifthUrl }],
    },
    {
      title: "Extra Track 4",
      artist: "Flavournous",
      url: sixthUrl,
      image: "",
      qualities: [{ label: "Original", url: sixthUrl }],
    },
    {
      title: "Extra Track 5",
      artist: "Flavournous",
      url: seventhUrl,
      image: "",
      qualities: [{ label: "Original", url: seventhUrl }],
    },
  ];
  // Helper: derive a readable title from a URL
  function deriveTitleFromUrl(u) {
    try {
      const p = (u + "").split("/").pop().split("?")[0].split("#")[0];
      const name = p.replace(/\.[^.]+$/, "");
      // replace separators with spaces and capitalize words
      return name
        .replace(/[-_]+/g, " ")
        .replace(/%20/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    } catch (e) {
      return "Track";
    }
  }

  function getExt(u) {
    try {
      const m = (u + "").split("?")[0].split("#")[0];
      const ext = m.split('.').pop();
      return ext || 'mp3';
    } catch (e) {
      return 'mp3';
    }
  }

  // Ensure sample items have readable titles and qualities
  sample.forEach((s, i) => {
    if (!s.title || s.title.match(/^Extra Track/i)) s.title = deriveTitleFromUrl(s.url) || `Track ${i + 1}`;
    if (!s.qualities || !s.qualities.length) s.qualities = [{ label: 'Original', url: s.url }];
  });
  // Try fetching from a real media endpoint if configured
  try {
    const workerBase =
      window.MEDIA_ENDPOINT ||
      window.SIGN_ENDPOINT ||
      "https://flavournous-sign-upload-production.shadrackechesa40.workers.dev";
    const url = workerBase.replace(/\/$/, "") + "/media";
    const res = await fetch(url);
    if (res && res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length) return json;
    }
  } catch (e) {
    /* ignore */
  }
  return sample;
}
async function loadMedia() {
  const data = await fetchMedia();
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  const albums = {};
  data.forEach((item) => {
    const key = item.artist || "Various";
    if (!albums[key]) albums[key] = [];
    albums[key].push(item);
  });
  Object.keys(albums).forEach((artist) => {
    const aDiv = document.createElement("div");
    aDiv.className = "item card";
    const img = document.createElement("div");
    img.className = "thumb";
    img.textContent = artist;
    const title = document.createElement("div");
    title.style.fontWeight = 700;
    title.textContent = artist;
    const cnt = document.createElement("div");
    cnt.className = "muted";
    cnt.textContent = albums[artist].length + " tracks";
    const btn = document.createElement("button");
    btn.className = "btn small";
    btn.textContent = "Open album";
      btn.onclick = () => {
        location.hash = "#/album/" + encodeURIComponent(artist);
        if (typeof navigate === "function") navigate();
      };
    aDiv.appendChild(img);
    aDiv.appendChild(title);
    aDiv.appendChild(cnt);
    aDiv.appendChild(btn);
    grid.appendChild(aDiv);
  });
  data.forEach((item) => {
    const div = document.createElement("div");
    div.className = "item card";
    const img = document.createElement("img");
    img.className = "thumb";
    img.src = item.image || thumbnailFor(item);
    img.alt = item.title;
    const title = document.createElement("div");
    title.style.fontWeight = 700;
    title.textContent = item.title;
    const artist = document.createElement("div");
    artist.className = "muted";
    artist.textContent = item.artist || "";
    const controls = document.createElement("div");
    controls.className = "controls";
    const openBtn = document.createElement("button");
    openBtn.className = "btn small";
    openBtn.textContent = "Open Player";
    openBtn.onclick = () => openPlayer(item);
    const dl = document.createElement("a");
    dl.className = "btn small";
    dl.href =
      (item.qualities && item.qualities[0] && item.qualities[0].url) ||
      item.url ||
      "#";
    dl.download = "";
    dl.textContent = "Quick Download";
    controls.appendChild(openBtn);
    controls.appendChild(dl);
    div.appendChild(img);
    div.appendChild(title);
    div.appendChild(artist);
    div.appendChild(controls);
    grid.appendChild(div);
  });
}
// Call loadMedia on page ready so homepage shows uploaded items (or sample)
document.addEventListener("DOMContentLoaded", () => {
  if (typeof loadMedia === "function") loadMedia();

  // Theme toggle: persistent, non-invasive
  function applyTheme(theme) {
    if (theme === "light") document.body.classList.add("light");
    else document.body.classList.remove("light");
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {
      /* ignore storage errors */
    }
  }

  // Apply saved theme (default dark)
  const saved = (function () {
    try {
      return localStorage.getItem("theme");
    } catch (e) {
      return null;
    }
  })();
  applyTheme(saved === "light" ? "light" : "dark");

  // Wire up topbar toggle button if present
  const tbtn = document.getElementById("themeToggle");
  if (tbtn) {
    tbtn.addEventListener("click", () => {
      const isLight = document.body.classList.contains("light");
      applyTheme(isLight ? "dark" : "light");
    });
  }
});
async function loadAlbum(artist) {
  const data = await fetchMedia();
  const albumGrid = document.getElementById("albumGrid");
  albumGrid.innerHTML = "";
  data
    .filter((d) => (d.artist || "") === artist)
    .forEach((item) => {
      const div = document.createElement("div");
      div.className = "item card";
      const img = document.createElement("img");
      img.className = "thumb";
      img.src = item.image || thumbnailFor(item);
      img.alt = item.title;
      const title = document.createElement("div");
      title.style.fontWeight = 700;
      title.textContent = item.title;
      const controls = document.createElement("div");
      controls.className = "controls";
      const openBtn = document.createElement("button");
      openBtn.className = "btn small";
      openBtn.textContent = "Open Player";
      openBtn.onclick = () => openPlayer(item);
      const dl = document.createElement("a");
      dl.className = "btn small";
      dl.href =
        (item.qualities && item.qualities[0] && item.qualities[0].url) ||
        item.url ||
        "#";
      dl.download = "";
      dl.textContent = "Quick Download";
      controls.appendChild(openBtn);
      controls.appendChild(dl);
      div.appendChild(img);
      div.appendChild(title);
      div.appendChild(controls);
      albumGrid.appendChild(div);
    });
}
function thumbnailFor(item) {
  if (!item || !item.public_id)
    return (item && item.image) || "placeholder.png";
  const cloud = item.cloud_name || window.CLOUDINARY_CLOUD_NAME || "";
  if (!cloud) return (item && item.image) || "placeholder.png";
  return `https://res.cloudinary.com/${cloud}/image/upload/w_400,h_300,c_fill/${item.public_id}.${item.format}`;
}
function openPlayer(item) {
  const wrap = document.getElementById("player");
  wrap.innerHTML = "";
  wrap.classList.remove("hidden");
  const img = document.createElement("img");
  img.src = item.image;
  img.style.width = "96px";
  img.style.height = "96px";
  img.style.objectFit = "cover";
  img.style.borderRadius = "8px";
  const info = document.createElement("div");
  info.className = "track-info";
  const title = document.createElement("div");
  title.className = "track-title";
  title.textContent = item.title;
  const artist = document.createElement("div");
  artist.className = "track-artist";
  artist.textContent = item.artist || "";
  const selector = document.createElement("select");
  selector.className = "selector";
  (item.qualities || []).forEach((q) => {
    const opt = document.createElement("option");
    opt.value = q.url;
    opt.textContent = q.label || q.url;
    selector.appendChild(opt);
  });

  // Fallback: if no qualities exist, provide the main item URL as an option
  if (!selector.options.length && item.url) {
    const opt = document.createElement('option');
    opt.value = item.url;
    opt.textContent = item.title || 'Track';
    selector.appendChild(opt);
  }
  const playBtn = document.createElement("button");
  playBtn.className = "btn small";
  playBtn.textContent = "Play";
  let mediaEl = null;
  playBtn.onclick = () => {
    if (!mediaEl) {
      const src = selector.value;
      if (src.match(/\.(mp4|webm|ogg)$/i)) {
        mediaEl = document.createElement("video");
        mediaEl.controls = true;
        mediaEl.width = 320;
      } else {
        mediaEl = document.createElement("audio");
        mediaEl.controls = true;
      }
      const source = document.createElement("source");
      source.src = src;
      mediaEl.appendChild(source);
      info.appendChild(mediaEl);
      mediaEl.play().catch(() => {});
      playBtn.textContent = "Pause";
    } else {
      if (mediaEl.paused)
        mediaEl
          .play()
          .then(() => (playBtn.textContent = "Pause"))
          .catch(() => {});
      else {
        mediaEl.pause();
        playBtn.textContent = "Play";
      }
    }
  };
  const downloadBtn = document.createElement("a");
  downloadBtn.className = "btn small";
  downloadBtn.href = selector.value || item.url || "#";
  downloadBtn.download = "";
  downloadBtn.textContent = "Download";
  selector.onchange = () => {
    downloadBtn.href = selector.value;
  };
  const closeBtn = document.createElement("button");
  closeBtn.className = "btn small";
  closeBtn.textContent = "Close";
  closeBtn.onclick = () => {
    document.getElementById("player").classList.add("hidden");
    document.getElementById("player").innerHTML = "";
  };

  info.appendChild(title);
  info.appendChild(artist);
  info.appendChild(selector);
  info.appendChild(playBtn);
  info.appendChild(downloadBtn);

  wrap.appendChild(img);
  wrap.appendChild(info);
  wrap.appendChild(closeBtn);
}
