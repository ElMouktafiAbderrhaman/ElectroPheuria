// Store colour theme: dark (default, the brand look) or light, chosen with the navbar icon.
// The choice is remembered in this browser. The admin dashboard always stays dark.
export const THEME_KEY = "ElectroPheuria_theme";

/** Saved theme, "dark" unless the visitor picked light. */
export function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme === "light" ? "light" : "dark");
  } catch {
    /* storage blocked (private mode, in-app browser): the theme still applies for this visit */
  }
}

/** Put the theme on <body> (light-mode class + browser bar colour). Never light on /dashboard. */
export function applyTheme(theme, pathname = window.location.pathname) {
  const light = theme === "light" && !pathname.startsWith("/dashboard");
  document.body.classList.toggle("light-mode", light);
  document.body.style.backgroundColor = light ? "#ffffff" : "#000000";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? "#ffffff" : "#000000");
}
