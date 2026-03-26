import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const tendenciasGerais = document.getElementById("tendenciasGerais");
const topSemanalAnalytics = document.getElementById("topSemanalAnalytics");
const maisAssistidosRanking = document.getElementById("maisAssistidosRanking");
const categoriasAnalytics = document.getElementById("categoriasAnalytics");

const estadoVazioTendencias = document.getElementById("estadoVazioTendencias");
const estadoVazioTopSemanal = document.getElementById("estadoVazioTopSemanal");
const estadoVazioMaisAssistidos = document.getElementById("estadoVazioMaisAssistidos");
const estadoVazioCategoriasAnalytics = document.getElementById("estadoVazioCategoriasAnalytics");

const metricaTempoAssistido = document.getElementById("metricaTempoAssistido");
const metricaVideosVistos = document.getElementById("metricaVideosVistos");
const metricaFavoritos = document.getElementById("metricaFavoritos");
const metricaConclusao = document.getElementById("metricaConclusao");
const metricaEmocional = document.getElementById("metricaEmocional");

const historicoEmocionalContainer = document.getElementById("historicoEmocional");
const estadoVazioHistoricoEmocional = document.getElementById("estadoVazioHistoricoEmocional");
const emotionTimelineChartCanvas = document.getElementById("emotionTimelineChart");
const emotionHeatmapContainer = document.getElementById("emotionHeatmap");
const timeHeatmap = document.getElementById("timeHeatmap");

const horarioMaisAtivo = document.getElementById("horarioMaisAtivo");
const categoriaMaisVista = document.getElementById("categoriaMaisVista");
const formatoPreferidoUsuario = document.getElementById("formatoPreferidoUsuario");
const nivelEngajamentoUsuario = document.getElementById("nivelEngajamentoUsuario");

const filtroVideoIdInput = document.getElementById("filtroVideoId");
const filtroUserIdSelect = document.getElementById("filtroUserId");
const btnFiltrarEmocao = document.getElementById("btnFiltrarEmocao");
const btnExportCSV = document.getElementById("btnExportCSV");

let usuarioAtual = null;
let emotionTimelineChart = null;
let historicoEmocionalAtual = [];

function escaparHtml(texto = "") {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textoOuPadrao(valor, padrao = "—") {
  if (valor === null || valor === undefined || valor === "") return padrao;
  return String(valor);
}

function obterImagemVideo(video = {}) {
  return video.thumbnail || video.capa || video.imagem || "imagens/logo.png";
}

function obterCategoria(video = {}) {
  return video.categoria || video.genero || video.tag || "Sem categoria";
}

function limparContainer(container) {
  if (container) container.innerHTML = "";
}

function alternarEstado(container, estadoVazio, temDados, display = "flex") {
  if (!container || !estadoVazio) return;
  container.style.display = temDados ? display : "none";
  estadoVazio.style.display = temDados ? "none" : "flex";
}

function criarCardTendencia(video = {}, ranking = null) {
  const card = document.createElement("a");
  card.href = `video.html?id=${encodeURIComponent(video.id || "")}`;
  card.className = ranking ? "card-ranking" : "card";

  card.innerHTML = ranking
    ? `
      <span class="ranking-numero">${ranking}</span>
      <div class="card-ranking-thumb">
        <img src="${escaparHtml(obterImagemVideo(video))}" alt="${escaparHtml(video.titulo || "Vídeo")}">
        <div class="card-ranking-overlay">
          <h3>${escaparHtml(video.titulo || "Sem título")}</h3>
          <p>${escaparHtml(obterCategoria(video))}</p>
        </div>
      </div>
    `
    : `
      <img src="${escaparHtml(obterImagemVideo(video))}" alt="${escaparHtml(video.titulo || "Vídeo")}">
      <div class="card-overlay">
        <h3>${escaparHtml(video.titulo || "Sem título")}</h3>
        <p>${escaparHtml(obterCategoria(video))}</p>
      </div>
    `;

  return card;
}

function renderizarLista(container, estadoVazio, lista = [], modo = "normal") {
  if (!container || !estadoVazio) return;

  limparContainer(container);

  if (!Array.isArray(lista) || !lista.length) {
    alternarEstado(container, estadoVazio, false, modo === "ranking" ? "grid" : "flex");
    return;
  }

  alternarEstado(container, estadoVazio, true, modo === "ranking" ? "grid" : "flex");

  lista.forEach((item, index) => {
    container.appendChild(
      criarCardTendencia(item, modo === "ranking" ? index + 1 : null)
    );
  });
}

function renderizarCategorias(lista = []) {
  if (!categoriasAnalytics || !estadoVazioCategoriasAnalytics) return;

  categoriasAnalytics.innerHTML = "";

  if (!lista.length) {
    categoriasAnalytics.style.display = "none";
    estadoVazioCategoriasAnalytics.style.display = "flex";
    return;
  }

  categoriasAnalytics.style.display = "grid";
  estadoVazioCategoriasAnalytics.style.display = "none";

  lista.forEach((item) => {
    const card = document.createElement("div");
    card.className = "categoria-analytics-card";
    card.innerHTML = `
      <h3>${escaparHtml(item.nome || "Sem nome")}</h3>
      <p>${item.total || 0} vídeo(s)</p>
    `;
    categoriasAnalytics.appendChild(card);
  });
}

function atualizarMetricasUsuario(metricas = {}) {
  if (metricaTempoAssistido) metricaTempoAssistido.textContent = textoOuPadrao(metricas.tempoAssistido, "0 min");
  if (metricaVideosVistos) metricaVideosVistos.textContent = textoOuPadrao(metricas.videosVistos, "0");
  if (metricaFavoritos) metricaFavoritos.textContent = textoOuPadrao(metricas.favoritos, "0");
  if (metricaConclusao) metricaConclusao.textContent = textoOuPadrao(metricas.taxaConclusao, "—");
  if (metricaEmocional) metricaEmocional.textContent = textoOuPadrao(metricas.emocaoMedia, "Neutro");
}

function atualizarMapaUsuario(mapa = {}) {
  if (horarioMaisAtivo) horarioMaisAtivo.textContent = textoOuPadrao(mapa.horarioMaisAtivo, "Ainda sem dados");
  if (categoriaMaisVista) categoriaMaisVista.textContent = textoOuPadrao(mapa.categoriaDominante, "Ainda sem dados");
  if (formatoPreferidoUsuario) formatoPreferidoUsuario.textContent = textoOuPadrao(mapa.formatoPreferido, "Ainda sem dados");
  if (nivelEngajamentoUsuario) nivelEngajamentoUsuario.textContent = textoOuPadrao(mapa.nivelEngajamento, "Baixo");
}

function calcularHorarioMaisAtivo(historico = []) {
  if (!historico.length) return "Ainda sem dados";

  const horas = new Map();

  historico.forEach((item) => {
    const data = item.timestamp?.toDate ? item.timestamp.toDate() : null;
    if (!data) return;
    const hora = data.getHours();
    horas.set(hora, (horas.get(hora) || 0) + 1);
  });

  let melhorHora = null;
  let maior = 0;

  horas.forEach((valor, chave) => {
    if (valor > maior) {
      maior = valor;
      melhorHora = chave;
    }
  });

  return melhorHora === null ? "Ainda sem dados" : `${String(melhorHora).padStart(2, "0")}:00`;
}

function calcularCategoriaDominante(historico = [], favoritos = []) {
  const categorias = [...historico, ...favoritos]
    .map((item) => item.categoria || item.genero || item.tag || "Sem categoria")
    .filter(Boolean);

  if (!categorias.length) return "Ainda sem dados";

  const mapa = new Map();

  categorias.forEach((categoria) => {
    mapa.set(categoria, (mapa.get(categoria) || 0) + 1);
  });

  let melhor = "";
  let maior = 0;

  mapa.forEach((valor, chave) => {
    if (valor > maior) {
      maior = valor;
      melhor = chave;
    }
  });

  return melhor || "Ainda sem dados";
}

function calcularFormatoPreferido(historico = [], favoritos = []) {
  const lista = [...historico, ...favoritos];
  if (!lista.length) return "Ainda sem dados";

  const formatos = lista.map((video) => {
    const titulo = String(video.titulo || "").toLowerCase();
    if (titulo.includes("série")) return "Séries";
    if (titulo.includes("document")) return "Documentários";
    return "Vídeos";
  });

  const mapa = new Map();

  formatos.forEach((item) => {
    mapa.set(item, (mapa.get(item) || 0) + 1);
  });

  let melhor = "";
  let maior = 0;

  mapa.forEach((valor, chave) => {
    if (valor > maior) {
      maior = valor;
      melhor = chave;
    }
  });

  return melhor || "Vídeos";
}

function calcularNivelEngajamento(totalHistorico = 0, totalFavoritos = 0) {
  const score = totalHistorico + totalFavoritos * 2;
  if (score >= 20) return "Muito alto";
  if (score >= 10) return "Alto";
  if (score >= 5) return "Médio";
  if (score >= 1) return "Inicial";
  return "Baixo";
}

function inferirEmocaoMedia(historico = []) {
  if (!historico.length) return "Neutro";

  const contagem = new Map();

  historico.forEach((item) => {
    const emocao = item.emocaoDominante || "neutro";
    contagem.set(emocao, (contagem.get(emocao) || 0) + 1);
  });

  let melhor = "neutro";
  let maior = 0;

  contagem.forEach((valor, chave) => {
    if (valor > maior) {
      maior = valor;
      melhor = chave;
    }
  });

  return melhor;
}

function renderizarHistoricoEmocional(historico = []) {
  if (!historicoEmocionalContainer || !estadoVazioHistoricoEmocional) return;

  historicoEmocionalContainer.innerHTML = "";

  if (!historico.length) {
    historicoEmocionalContainer.style.display = "none";
    estadoVazioHistoricoEmocional.style.display = "flex";
    return;
  }

  historicoEmocionalContainer.style.display = "block";
  estadoVazioHistoricoEmocional.style.display = "none";

  historico.slice(-20).reverse().forEach((item) => {
    const data = item.timestamp?.toDate ? item.timestamp.toDate() : new Date();
    const row = document.createElement("div");
    row.className = "historico-emocional-item";
    row.innerHTML = `
      <span>${data.toLocaleString("pt-BR")}</span>
      <strong>${escaparHtml(item.emocaoDominante || "neutro")}</strong>
      <span>${Number(item.currentTime || 0).toFixed(1)}s</span>
      <span>${escaparHtml(item.videoId || "—")}</span>
    `;
    historicoEmocionalContainer.appendChild(row);
  });
}

function plotarEmocaoTimeline(historico = []) {
  if (!emotionTimelineChartCanvas || typeof Chart === "undefined") return;

  const dados = historico.slice(-40).map((item) => ({
    tempo: Number(item.currentTime || 0),
    valor: ({
      triste: 1,
      irritado: 2,
      neutro: 3,
      curioso: 4,
      surpreso: 5,
      feliz: 6
    })[item.emocaoDominante || "neutro"] || 3
  }));

  if (emotionTimelineChart) {
    emotionTimelineChart.destroy();
    emotionTimelineChart = null;
  }

  emotionTimelineChart = new Chart(emotionTimelineChartCanvas, {
    type: "line",
    data: {
      labels: dados.map((item) => `${item.tempo}s`),
      datasets: [
        {
          label: "Emoção ao longo do tempo",
          data: dados.map((item) => item.valor),
          borderWidth: 2,
          tension: 0.35,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function atualizarHeatmapEmocional(historico = []) {
  if (!emotionHeatmapContainer) return;

  emotionHeatmapContainer.innerHTML = "";

  if (!historico.length) return;

  const grupos = new Map();

  historico.forEach((item) => {
    const emocao = item.emocaoDominante || "neutro";
    grupos.set(emocao, (grupos.get(emocao) || 0) + 1);
  });

  grupos.forEach((total, emocao) => {
    const card = document.createElement("div");
    card.className = "emotion-heatmap-item";
    card.innerHTML = `
      <strong>${escaparHtml(emocao)}</strong>
      <span>${total} ocorrência(s)</span>
    `;
    emotionHeatmapContainer.appendChild(card);
  });
}

function atualizarHeatmapTemporal(historico = []) {
  if (!timeHeatmap) return;

  timeHeatmap.innerHTML = "";

  if (!historico.length) return;

  const opcoes = ["neutro", "feliz", "triste", "irritado", "surpreso", "curioso"];
  const intervalo = 10;
  const maxTime = historico.reduce((max, item) => Math.max(max, Number(item.currentTime || 0)), 0);
  const bins = Math.max(1, Math.ceil(maxTime / intervalo));

  for (let i = 0; i < bins; i += 1) {
    const inicio = i * intervalo;
    const fim = inicio + intervalo;

    opcoes.forEach((emocao) => {
      const total = historico.filter((item) => {
        const tempo = Number(item.currentTime || 0);
        return tempo >= inicio && tempo < fim && (item.emocaoDominante || "neutro") === emocao;
      }).length;

      const cell = document.createElement("div");
      cell.className = "time-heatmap-cell";
      cell.style.opacity = total > 0 ? String(Math.min(1, 0.25 + total / 10)) : "0.18";
      cell.title = `${inicio}-${fim}s • ${emocao}: ${total}`;
      cell.innerHTML = `<span>${emocao} ${total}</span>`;
      timeHeatmap.appendChild(cell);
    });
  }
}

function exportarCSV(historico = []) {
  if (!historico.length) {
    alert("Não há dados para exportar.");
    return;
  }

  const linhas = [
    ["timestamp", "videoId", "userId", "currentTime", "emocaoDominante", "intensidade"].join(",")
  ];

  historico.forEach((item) => {
    const data = item.timestamp?.toDate ? item.timestamp.toDate().toISOString() : "";
    linhas.push([
      data,
      item.videoId || "",
      item.userId || "",
      Number(item.currentTime || 0),
      item.emocaoDominante || "",
      Number(item.intensidade || 0)
    ].join(","));
  });

  const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "analytics-emocional-brasflix.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

async function carregarUsuariosFiltro() {
  if (!filtroUserIdSelect) return;

  filtroUserIdSelect.innerHTML = `<option value="">Todos os usuários</option>`;

  try {
    const snapshot = await getDocs(collection(db, "usuarios"));

    snapshot.forEach((docSnap) => {
      const dados = docSnap.data() || {};
      const option = document.createElement("option");
      option.value = docSnap.id;
      option.textContent = dados.nome || dados.email || docSnap.id;
      filtroUserIdSelect.appendChild(option);
    });
  } catch (error) {
    console.error("[Analytics] Erro ao carregar usuários do filtro:", error);
  }
}

async function carregarAnalyticsGerais() {
  try {
    const videosSnap = await getDocs(collection(db, "videos"));
    const videos = videosSnap.docs.map((item) => ({
      docId: item.id,
      ...item.data()
    }));

    const tendencias = videos
      .filter((item) => item.emAlta || item.destaque)
      .slice(0, 10);

    const topSemanal = videos
      .filter((item) => item.topSemanal)
      .slice(0, 10);

    const maisAssistidos = [...videos]
      .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
      .slice(0, 10);

    const categoriasMap = new Map();

    videos.forEach((video) => {
      const categoria = obterCategoria(video);
      categoriasMap.set(categoria, (categoriasMap.get(categoria) || 0) + 1);
    });

    const categorias = [...categoriasMap.entries()]
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    renderizarLista(tendenciasGerais, estadoVazioTendencias, tendencias, "normal");
    renderizarLista(topSemanalAnalytics, estadoVazioTopSemanal, topSemanal, "normal");
    renderizarLista(maisAssistidosRanking, estadoVazioMaisAssistidos, maisAssistidos, "ranking");
    renderizarCategorias(categorias);
  } catch (error) {
    console.error("[Analytics] Erro ao carregar analytics gerais:", error);
  }
}

async function carregarAnalyticsUsuario(uid) {
  try {
    const historicoSnap = await getDocs(
      query(
        collection(db, "historico_visualizacoes"),
        where("userId", "==", uid),
        orderBy("timestamp", "desc"),
        limit(100)
      )
    );

    const emotionSnap = await getDocs(
      query(
        collection(db, "emotionAnalytics"),
        where("userId", "==", uid),
        orderBy("timestamp", "desc"),
        limit(200)
      )
    );

    const usuarioSnap = await getDocs(query(collection(db, "usuarios"), where("usuarioId", "==", uid), limit(1)));

    const historico = historicoSnap.docs.map((item) => item.data());
    const emotion = emotionSnap.docs.map((item) => item.data());
    const usuario = usuarioSnap.empty ? {} : (usuarioSnap.docs[0].data() || {});
    const favoritos = Array.isArray(usuario.favoritos) ? usuario.favoritos : [];

    const tempoAssistidoSegundos = historico.reduce((acc, item) => acc + Number(item.tempoAssistido || 0), 0);
    const totalVideos = historico.length;
    const totalFavoritos = favoritos.length;

    atualizarMetricasUsuario({
      tempoAssistido: `${Math.floor(tempoAssistidoSegundos / 60)} min`,
      videosVistos: totalVideos,
      favoritos: totalFavoritos,
      taxaConclusao: totalVideos ? "Boa" : "—",
      emocaoMedia: inferirEmocaoMedia(emotion)
    });

    atualizarMapaUsuario({
      horarioMaisAtivo: calcularHorarioMaisAtivo(historico),
      categoriaDominante: calcularCategoriaDominante(historico, favoritos),
      formatoPreferido: calcularFormatoPreferido(historico, favoritos),
      nivelEngajamento: calcularNivelEngajamento(totalVideos, totalFavoritos)
    });

    historicoEmocionalAtual = emotion;
    renderizarHistoricoEmocional(emotion);
    plotarEmocaoTimeline(emotion);
    atualizarHeatmapEmocional(emotion);
    atualizarHeatmapTemporal(emotion);
  } catch (error) {
    console.error("[Analytics] Erro ao carregar analytics do usuário:", error);
  }
}

async function aplicarFiltroEmocional() {
  try {
    const filtros = [];
    const videoId = filtroVideoIdInput?.value?.trim();
    const userId = filtroUserIdSelect?.value?.trim();

    if (videoId) filtros.push(where("videoId", "==", videoId));
    if (userId) filtros.push(where("userId", "==", userId));

    const consulta = filtros.length
      ? query(collection(db, "emotionAnalytics"), ...filtros, orderBy("timestamp", "desc"), limit(200))
      : query(collection(db, "emotionAnalytics"), orderBy("timestamp", "desc"), limit(200));

    const snapshot = await getDocs(consulta);
    const historico = snapshot.docs.map((item) => item.data());

    historicoEmocionalAtual = historico;
    renderizarHistoricoEmocional(historico);
    plotarEmocaoTimeline(historico);
    atualizarHeatmapEmocional(historico);
    atualizarHeatmapTemporal(historico);
  } catch (error) {
    console.error("[Analytics] Erro ao aplicar filtro emocional:", error);
    alert("Não foi possível aplicar o filtro agora.");
  }
}

if (btnFiltrarEmocao) {
  btnFiltrarEmocao.addEventListener("click", aplicarFiltroEmocional);
}

if (btnExportCSV) {
  btnExportCSV.addEventListener("click", () => exportarCSV(historicoEmocionalAtual));
}

onAuthStateChanged(auth, async (user) => {
  usuarioAtual = user || null;

  await carregarAnalyticsGerais();
  await carregarUsuariosFiltro();

  if (usuarioAtual) {
    await carregarAnalyticsUsuario(usuarioAtual.uid);
  } else {
    atualizarMetricasUsuario({});
    atualizarMapaUsuario({});
    renderizarHistoricoEmocional([]);
    atualizarHeatmapEmocional([]);
    atualizarHeatmapTemporal([]);
  }
});
