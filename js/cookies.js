const COOKIE_KEY = "brasflix_cookies_accepted_v1";

function getCookieBox() {
  return document.getElementById("cookies");
}

function setAccepted() {
  try {
    localStorage.setItem(COOKIE_KEY, "true");
  } catch (error) {
    console.warn("[Cookies] Não foi possível salvar no localStorage:", error);
  }
}

function wasAccepted() {
  try {
    return localStorage.getItem(COOKIE_KEY) === "true";
  } catch {
    return false;
  }
}

function hideCookieBox() {
  const box = getCookieBox();
  if (!box) return;
  box.style.display = "none";
}

function showCookieBox() {
  const box = getCookieBox();
  if (!box) return;
  box.style.display = "flex";
}

function aceitarCookies() {
  setAccepted();
  hideCookieBox();
}

function initCookies() {
  const box = getCookieBox();
  if (!box) return;

  window.aceitarCookies = aceitarCookies;

  const button = box.querySelector("button");
  if (button) {
    button.addEventListener("click", aceitarCookies);
  }

  if (wasAccepted()) {
    hideCookieBox();
  } else {
    showCookieBox();
  }
}

document.addEventListener("DOMContentLoaded", initCookies);

export { aceitarCookies, initCookies };
