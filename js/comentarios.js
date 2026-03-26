import { AIEngine } from "./ai-engine.js";

const TOPICOS = [
  { label: "Vídeos", prompt: "Quais vídeos ou conteúdos você me recomenda agora na BRASFLIX?" },
  { label: "Perfil", prompt: "Como eu vejo e edito meu perfil na BRASFLIX?" },
  { label: "Pessoas", prompt: "Como eu encontro pessoas e converso com outros usuários na BRASFLIX?" },
  { label: "Analytics", prompt: "Explique o que aparece na página de analytics da BRASFLIX." },
  { label: "Admin", prompt: "Como funciona o acesso de administrador na BRASFLIX?" }
];

const ChatbotBRASFLIX = {
  elementos: {},
  ultimaResposta: "",
  saudacaoInserida: false,

  iniciar() {
    this.criarFallbackSeNecessario();
    this.mapear();
    this.injetarTopicos();
    this.registrarEventos();
    this.inserirSaudacao();
  },

  criarFallbackSeNecessario() {
    if (document.getElementById("chatbot-widget")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "chatbot-widget";
    wrapper.id = "chatbot-widget";
    wrapper.innerHTML = `
      <button id="chatbot-toggle" class="chatbot-toggle" aria-label="Abrir chat com PedrIA" type="button">💭</button>
      <div class="chatbot-window" id="chatbot-window">
        <header class="chatbot-header">
          <div class="chatbot-header-info">
            <div class="chatbot-avatar">😎</div>
            <div><div class="chatbot-title">PedrIA</div><div class="chatbot-subtitle">Assistente do Brasflix</div></div>
          </div>
          <button class="chatbot-close" id="chatbot-close" type="button">✕</button>
        </header>
        <div class="chatbot-messages" id="chatbot-messages"></div>
        <form class="chatbot-form" id="chatbot-form">
          <input type="text" id="chatbot-input" class="chatbot-input" placeholder="Digite sua pergunta..." autocomplete="on" required>
          <button type="submit" class="chatbot-send-btn">➤</button>
        </form>
      </div>`;
    document.body.appendChild(wrapper);
  },

  mapear() {
    this.elementos = {
      widget: document.getElementById("chatbot-widget"),
      toggle: document.getElementById("chatbot-toggle"),
      window: document.getElementById("chatbot-window"),
      close: document.getElementById("chatbot-close"),
      mensagens: document.getElementById("chatbot-messages"),
      form: document.getElementById("chatbot-form"),
      input: document.getElementById("chatbot-input")
    };
  },

  injetarTopicos() {
    if (!this.elementos.window || this.elementos.window.querySelector(".chatbot-topicos")) return;
    const barra = document.createElement("div");
    barra.className = "chatbot-topicos";
    barra.innerHTML = TOPICOS.map((item) => `<button type="button" class="chatbot-topico" data-prompt="${item.prompt.replaceAll('"', '&quot;')}">${item.label}</button>`).join("");
    this.elementos.window.insertBefore(barra, this.elementos.mensagens);
    barra.querySelectorAll(".chatbot-topico").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const prompt = btn.dataset.prompt || "";
        this.elementos.input.value = prompt;
        await this.enviarMensagem();
      });
    });
  },

  registrarEventos() {
    this.elementos.toggle?.addEventListener("click", () => this.abrir());
    this.elementos.close?.addEventListener("click", () => this.fechar());
    this.elementos.form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await this.enviarMensagem();
    });
  },

  abrir() {
    this.elementos.widget?.classList.add("aberto");
    setTimeout(() => this.elementos.input?.focus(), 60);
  },

  fechar() {
    this.elementos.widget?.classList.remove("aberto");
  },

  inserirSaudacao() {
    if (this.saudacaoInserida || !this.elementos.mensagens) return;
    this.saudacaoInserida = true;
    this.adicionarMensagem("bot", "Olá! Eu sou a PedrIA. Posso ajudar com vídeos, perfil, pessoas, analytics, administrador e navegação pela BRASFLIX.", { scroll: false });
  },

  adicionarMensagem(tipo, texto, options = {}) {
    if (!this.elementos.mensagens) return;
    const item = document.createElement("div");
    item.className = `chatbot-message chatbot-message-${tipo}`;
    item.textContent = texto;
    this.elementos.mensagens.appendChild(item);
    if (options.scroll !== false) {
      this.elementos.mensagens.scrollTop = this.elementos.mensagens.scrollHeight;
    }
    if (tipo === "bot") this.ultimaResposta = texto;
  },

  removerPensando() {
    this.elementos.mensagens?.querySelectorAll(".chatbot-message-system").forEach((el) => el.remove());
  },

  async enviarMensagem() {
    const texto = this.elementos.input?.value?.trim();
    if (!texto) return;
    this.adicionarMensagem("user", texto);
    this.elementos.input.value = "";
    this.adicionarMensagem("system", "Pensando...");

    const resposta = await AIEngine.gerar({
      prompt: texto,
      provider: "gemini",
      incluirContextoUsuario: true,
      system: "Você é a PedrIA da BRASFLIX. Ajude em português do Brasil, de forma prática e amigável."
    });

    this.removerPensando();
    if (!resposta?.sucesso) {
      this.adicionarMensagem("bot", resposta?.erro || "Não consegui responder agora.");
      return;
    }
    this.adicionarMensagem("bot", resposta.texto || "Sem resposta no momento.");
  }
};

document.addEventListener("DOMContentLoaded", () => ChatbotBRASFLIX.iniciar());
window.ChatbotBRASFLIX = ChatbotBRASFLIX;
export { ChatbotBRASFLIX };
