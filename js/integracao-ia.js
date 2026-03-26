import { Legendas } from "./legendas.js";
import { VLibras } from "./vlibras.js";
import { AnalyticsIA } from "./analytics-ia.js";
import { RecommendationEngine } from "./recomendacoes-ia.js";
import { ModeracaoIA } from "./moderacao-ia.js";
import { TradutorIA } from "./tradutor-ia.js";
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let usuarioAtualId = null;
let videoIdAtual = "";

function obterVideoIdDaUrl() {
  return new URLSearchParams(window.location.search).get("id") || "";
}

function obterContainerVideo() {
  return document.getElementById("playerContainer") || document.getElementById("videoContainer");
}

function observarComentarios() {
  const lista = document.getElementById("listaComentariosVideo") || document.getElementById("comentarios-list");
  if (!lista) return;
  const aplicar = () => {
    lista.querySelectorAll(".card-comentario").forEach((elemento, index) => {
      if (!elemento.dataset.tradutorPronto) {
        elemento.dataset.tradutorPronto = "true";
        adicionarTradutorEmComentarios(elemento, `comentario-${index}`);
      }
    });
  };
  aplicar();
  new MutationObserver(aplicar).observe(lista, { childList: true, subtree: true });
}

async function inicializarModulosIA() {
  if (!videoIdAtual) return;
  const recomendacoesId = document.getElementById("recomendacoesVideo") ? "recomendacoesVideo" : "recomendacoes-container";
  const analyticsId = document.getElementById("analyticsViews") ? null : "analytics-container";
  if (document.getElementById(recomendacoesId)) {
    RecommendationEngine.renderizarRecomendacoes(recomendacoesId);
  }
  if (analyticsId && document.getElementById(analyticsId)) {
    AnalyticsIA.renderizarAnalise(analyticsId, videoIdAtual);
  }
  observarComentarios();
}

function adicionarTradutorEmComentarios(elementoComentario, comentarioId = "comentario") {
  if (!elementoComentario || elementoComentario.querySelector(".btn-traduzir-comentario")) return;
  const textoComentario = elementoComentario.querySelector(".comentario-texto")?.textContent?.trim() || "";
  if (!textoComentario) return;
  const acoes = elementoComentario.querySelector(".comentario-acoes") || elementoComentario;
  const botaoTraducao = document.createElement("button");
  botaoTraducao.type = "button";
  botaoTraducao.className = "btn-traduzir-comentario";
  botaoTraducao.textContent = "🌐 Traduzir";
  botaoTraducao.addEventListener("click", () => {
    if (elementoComentario.querySelector(`#traducao-${comentarioId}`)) return;
    const widget = TradutorIA.criarWidgetTraducao(textoComentario, comentarioId);
    elementoComentario.appendChild(widget);
    botaoTraducao.disabled = true;
  });
  acoes.appendChild(botaoTraducao);
}

async function moderarComentarioIndividual(textoComentario, callbackResultado) {
  const analise = await ModeracaoIA.analisarComentario(textoComentario);
  if (typeof callbackResultado === "function") callbackResultado(analise);
  return analise;
}

document.addEventListener("DOMContentLoaded", async () => {
  videoIdAtual = obterVideoIdDaUrl();
  const containerVideo = obterContainerVideo();
  if (videoIdAtual && containerVideo) {
    Legendas.inicializar(videoIdAtual, containerVideo.id, "btnLegendas");
    VLibras.inicializar(videoIdAtual, containerVideo.id);
  }
  onAuthStateChanged(auth, (user) => {
    usuarioAtualId = user?.uid || null;
    if (videoIdAtual && usuarioAtualId) inicializarModulosIA();
  });
});

const IntegracaoIA = { Legendas, VLibras, AnalyticsIA, RecommendationEngine, ModeracaoIA, TradutorIA, adicionarTradutorEmComentarios, moderarComentarioIndividual };
window.IntegracaoIA = IntegracaoIA;
export { IntegracaoIA, adicionarTradutorEmComentarios, moderarComentarioIndividual };
