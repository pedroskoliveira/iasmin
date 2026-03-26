const dict = {
  "pt-BR": {
    heroTitle: "Filmes, séries e tecnologia em um só lugar",
    heroSubtitle: "Assista conteúdos exclusivos da BRASFLIX quando quiser.",
    heroButton: "Começar agora",
    login: "Entrar",
    logout: "Sair"
  },
  en: {
    heroTitle: "Movies, series and technology in one place",
    heroSubtitle: "Watch BRASFLIX exclusive content whenever you want.",
    heroButton: "Get started",
    login: "Sign in",
    logout: "Sign out"
  },
  es: {
    heroTitle: "Películas, series y tecnología en un solo lugar",
    heroSubtitle: "Mira contenido exclusivo de BRASFLIX cuando quieras.",
    heroButton: "Comenzar ahora",
    login: "Iniciar sesión",
    logout: "Salir"
  }
};

function applyLanguage(lang) {
  const msgs = dict[lang] || dict['pt-BR'];
  localStorage.setItem('brasflix_lang', lang);
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (msgs[key]) el.textContent = msgs[key];
  });
  const loginBtn = document.getElementById('loginButton');
  const logoutBtn = document.getElementById('logoutButton');
  if (loginBtn) loginBtn.textContent = msgs.login;
  if (logoutBtn) logoutBtn.textContent = msgs.logout;
}

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('languageSelect');
  if (!select) return;
  const saved = localStorage.getItem('brasflix_lang') || 'pt-BR';
  select.value = saved;
  applyLanguage(saved);
  select.addEventListener('change', (e) => applyLanguage(e.target.value));
});

export { applyLanguage };
