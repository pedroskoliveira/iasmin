import { db, auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const videosAlta = document.getElementById("videosAlta");
const estadoVazioVideosAlta = document.getElementById("estadoVazioVideosAlta");

const totalUsuarios = document.getElementById("totalUsuarios");
const totalVideos = document.getElementById("totalVideos");
const totalComentarios = document.getElementById("totalComentarios");
const totalViews = document.getElementById("totalViews");

const ctxViews = document.getElementById("graficoViews");
const ctxCategorias = document.getElementById("graficoCategorias");
const heatmapGrid = document.getElementById("heatmapGrid");
const btnSair = document.querySelector(".login");

let chartViews = null;
let chartCategorias = null;

function obterImagemVideo(video = {}) {
  return video.thumbnail || video.capa || video.imagem || "../imagens/logo.png";
}

function atualizarVideosAlta(lista = []) {
  if (!videosAlta || !estadoVazioVideosAlta) return;

  videosAlta.innerHTML = "";

  if (!lista.length) {
    estadoVazioVideosAlta.style.display = "flex";
    videosAlta.style.display = "none";
    return;
  }

  estadoVazioVideosAlta.style.display = "none";
  videosAlta.style.display = "grid";

  lista.forEach((video) => {
    const card = document.createElement("div");
    card.classList.add("card-admin-video");

    card.innerHTML = `
      <div class="card-admin-thumb">
        <img src="${obterImagemVideo(video)}" alt="${video.titulo || "Vídeo"}" style="width:100%;height:100%;object-fit:cover;">
      </div>
      <div class="card-admin-conteudo">
        <h3>${video.titulo || "Sem título"}</h3>
        <p>${video.descricao || "Sem descrição."}</p>
        <div class="card-admin-meta">
          <span>${video.categoria || "Sem categoria"}</span>
          <span>•</span>
          <span>${video.views || 0} views</span>
        </div>
      </div>
    `;

    videosAlta.appendChild(card);
  });
}

function definirTexto(el, valor) {
  if (el) el.textContent = String(valor ?? 0);
}

function criarHeatmap(quantidadeSemanas = 53, diasPorSemana = 7, intensidade = []) {
  if (!heatmapGrid) return;

  heatmapGrid.innerHTML = "";

  const totalCelulas = quantidadeSemanas * diasPorSemana;

  for (let i = 0; i < totalCelulas; i += 1) {
    const nivel = intensidade[i] ?? 0;
    const celula = document.createElement("div");
    celula.classList.add("heatmap-celula", `nivel-${Math.min(4, Math.max(0, nivel))}`);
    celula.title = `Atividade nível ${nivel}`;
    heatmapGrid.appendChild(celula);
  }
}

function renderizarGraficoViews(historico = []) {
  if (!ctxViews || typeof Chart === "undefined") return;

  const dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const totais = [0, 0, 0, 0, 0, 0, 0];

  historico.forEach((item) => {
    const data = item.timestamp?.toDate ? item.timestamp.toDate() : null;
    if (!data) return;
    const dia = data.getDay();
    const indice = dia === 0 ? 6 : dia - 1;
    totais[indice] += 1;
  });

  if (chartViews) chartViews.destroy();

  chartViews = new Chart(ctxViews, {
    type: "line",
    data: {
      labels: dias,
      datasets: [
        {
          label: "Visualizações",
          data: totais,
          borderWidth: 3,
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

function renderizarGraficoCategorias(videos = []) {
  if (!ctxCategorias || typeof Chart === "undefined") return;

  const mapa = new Map();

  videos.forEach((video) => {
    const categoria = video.categoria || "Sem categoria";
    mapa.set(categoria, (mapa.get(categoria) || 0) + Number(video.views || 0));
  });

  const ordenado = [...mapa.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (chartCategorias) chartCategorias.destroy();

  chartCategorias = new Chart(ctxCategorias, {
    type: "bar",
    data: {
      labels: ordenado.map((item) => item[0]),
      datasets: [
        {
          label: "Visualizações",
          data: ordenado.map((item) => item[1]),
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

async function carregarAnalyticsAdmin() {
  try {
    const [usuariosSnap, videosSnap, comentariosSnap, historicoSnap] = await Promise.all([
      getDocs(collection(db, "usuarios")),
      getDocs(collection(db, "videos")),
      getDocs(collection(db, "comentarios")),
      getDocs(collection(db, "historico_visualizacoes"))
    ]);

    const videos = videosSnap.docs.map((item) => ({
      docId: item.id,
      ...item.data()
    }));

    const historico = historicoSnap.docs.map((item) => item.data());

    definirTexto(totalUsuarios, usuariosSnap.size);
    definirTexto(totalVideos, videosSnap.size);
    definirTexto(totalComentarios, comentariosSnap.size);
    definirTexto(totalViews, historicoSnap.size);

    const videosAltaLista = [...videos]
      .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
      .slice(0, 8);

    atualizarVideosAlta(videosAltaLista);
    renderizarGraficoViews(historico);
    renderizarGraficoCategorias(videos);

    const intensidade = Array.from({ length: 53 * 7 }, () => Math.floor(Math.random() * 5));
    criarHeatmap(53, 7, intensidade);
  } catch (error) {
    console.error("[AdminAnalytics] Erro ao carregar analytics:", error);
    atualizarVideosAlta([]);
    criarHeatmap();
  }
}

if (btnSair) {
  btnSair.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "../login.html";
    } catch (error) {
      console.error("[AdminAnalytics] Erro ao sair:", error);
    }
  });
}

carregarAnalyticsAdmin();
