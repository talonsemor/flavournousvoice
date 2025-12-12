// about.js - Theme toggle for About page
document.addEventListener("DOMContentLoaded", () => {
  // Apply saved theme (default dark)
  const saved = (function () {
    try {
      return localStorage.getItem("theme");
    } catch (e) {
      return null;
    }
  })();

  function applyTheme(theme) {
    if (theme === "light") document.body.classList.add("light");
    else document.body.classList.remove("light");
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {
      /* ignore storage errors */
    }
  }

  applyTheme(saved === "light" ? "light" : "dark");

  // Wire up topbar toggle button
  const tbtn = document.getElementById("themeToggle");
  if (tbtn) {
    tbtn.addEventListener("click", () => {
      const isLight = document.body.classList.contains("light");
      applyTheme(isLight ? "dark" : "light");
    });
  }
});
