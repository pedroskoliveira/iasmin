import { db, auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const totalUsuarios = document.getElementById("totalUsuarios");
const totalVideos = document.getElementById("totalVideos");
const totalComentarios = document.getElementById("totalComentarios");
const totalViews = document.getElementById("totalViews");

const ultimosVideos = document.getElementById("ultimosVideos");
const estadoVazioDashboard = document.querySelector(".estado-vazio-admin");
const btnSair = document.querySelector(".login");

function definirTexto(el, valor) {
  if (el) el.textContent = String(valor ?? "0");
}

function obterImagemVideo(video = {}) {
  return video.thumbnail || video.capa || video.imagem || "../imagens/logo.png";
}

function criarCardVideoDashboard(video = {}) {
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
        <span>${video.duracao || video.duracaoSegundos || "—"}</span>
      </div>
    </div>
  `;

  return card;
}

function atualizarUltimosVideos(lista = []) {
  if (!ultimosVideos || !estadoVazioDashboard) return;

  ultimosVideos.innerHTML = "";

  if (!lista.length) {
    estadoVazioDashboard.style.display = "flex";
    ultimosVideos.style.display = "none";
    return;
  }

  estadoVazioDashboard.style.display = "none";
  ultimosVideos.style.display = "grid";

  lista.forEach((video) => {
    ultimosVideos.appendChild(criarCardVideoDashboard(video));
  });
}

async function carregarMetricas() {
  try {
    const [usuariosSnap, videosSnap, comentariosSnap, historicoSnap] = await Promise.all([
      getDocs(collection(db, "usuarios")),
      getDocs(collection(db, "videos")),
      getDocs(collection(db, "comentarios")),
      getDocs(collection(db, "historico_visualizacoes"))
    ]);

    const totalViewsValor = historicoSnap.size;

    definirTexto(totalUsuarios, usuariosSnap.size);
    definirTexto(totalVideos, videosSnap.size);
    definirTexto(totalComentarios, comentariosSnap.size);
    definirTexto(totalViews, totalViewsValor);

    const videos = videosSnap.docs.map((item) => ({
      docId: item.id,
      ...item.data()
    }));

    videos.sort((a, b) => {
      const aData = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const bData = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return bData - aData;
    });

    atualizarUltimosVideos(videos.slice(0, 8));
  } catch (error) {
    console.error("[AdminDashboard] Erro ao carregar métricas:", error);
    definirTexto(totalUsuarios, 0);
    definirTexto(totalVideos, 0);
    definirTexto(totalComentarios, 0);
    definirTexto(totalViews, 0);
    atualizarUltimosVideos([]);
  }
}

if (btnSair) {
  btnSair.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "../login.html";
    } catch (error) {
      console.error("[AdminDashboard] Erro ao sair:", error);
    }
  });
}

carregarMetricas();
