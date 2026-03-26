import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const historicoContainer = document.getElementById("historicoContainer");
const estadoVazioHistorico = document.getElementById("estadoVazioHistorico");

let usuarioAtualId = null;
let cancelarHistorico = null;

function formatarData(timestamp) {
  const data = timestamp?.toDate ? timestamp.toDate() : new Date();
  return data.toLocaleDateString("pt-BR");
}

function renderizarEstadoVazio() {
  if (estadoVazioHistorico) estadoVazioHistorico.style.display = "block";
  if (historicoContainer) {
    historicoContainer.innerHTML = `
      <p style="text-align:center; color:#999;">
        Seu histórico está vazio. Comece a assistir vídeos!
      </p>
    `;
  }
}

function renderizarItemHistorico(item) {
  if (!historicoContainer) return;

  const div = document.createElement("div");
  div.className = "card-historico";

  div.innerHTML = `
    <div class="historico-conteudo">
      <h4>${item.videoTitulo || "Vídeo sem título"}</h4>
      <p class="historico-data">Assistido em ${formatarData(item.timestamp)}</p>
      <p class="historico-tempo">Tempo: ${Math.floor(item.tempoAssistido || 0)}s</p>
    </div>

    <div class="historico-acoes">
      <a href="video.html?id=${encodeURIComponent(item.videoId || "")}" class="btn-historico-assistir">▶️ Assistir</a>
      <button class="btn-historico-deletar" data-id="${item.id}">🗑️</button>
    </div>
  `;

  const btnDelete = div.querySelector(".btn-historico-deletar");
  if (btnDelete) {
    btnDelete.addEventListener("click", async () => {
      await deletarHistoricoItem(item.id);
    });
  }

  historicoContainer.appendChild(div);
}

async function registrarVisualizacao(video = {}) {
  if (!usuarioAtualId || !video?.id) return null;

  try {
    await addDoc(collection(db, "historico_visualizacoes"), {
      userId: usuarioAtualId,
      videoId: video.id,
      videoTitulo: video.titulo || "Vídeo",
      categoria: video.categoria || "Sem categoria",
      thumbnail: video.thumbnail || video.capa || video.imagem || "",
      tempoAssistido: 0,
      timestamp: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error("[Histórico] Erro ao registrar visualização:", error);
    return null;
  }
}

async function atualizarTempoVisualizacao(videoId, tempoSegundos = 0) {
  if (!usuarioAtualId || !videoId) return null;

  try {
    const consulta = query(
      collection(db, "historico_visualizacoes"),
      where("userId", "==", usuarioAtualId),
      where("videoId", "==", videoId),
      orderBy("timestamp", "desc"),
      limit(1)
    );

    const snapshot = await getDocs(consulta);

    if (snapshot.empty) return null;

    const alvo = snapshot.docs[0];

    await updateDoc(doc(db, "historico_visualizacoes", alvo.id), {
      tempoAssistido: Math.floor(Number(tempoSegundos || 0))
    });

    return true;
  } catch (error) {
    console.error("[Histórico] Erro ao atualizar tempo:", error);
    return null;
  }
}

function carregarHistoricoUsuario(userId) {
  if (!historicoContainer) return;

  if (cancelarHistorico) {
    cancelarHistorico();
    cancelarHistorico = null;
  }

  const consulta = query(
    collection(db, "historico_visualizacoes"),
    where("userId", "==", userId),
    orderBy("timestamp", "desc"),
    limit(50)
  );

  cancelarHistorico = onSnapshot(
    consulta,
    (snapshot) => {
      historicoContainer.innerHTML = "";

      if (snapshot.empty) {
        renderizarEstadoVazio();
        return;
      }

      if (estadoVazioHistorico) estadoVazioHistorico.style.display = "none";

      snapshot.forEach((docSnap) => {
        renderizarItemHistorico({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
    },
    (error) => {
      console.error("[Histórico] Erro ao carregar histórico:", error);
      renderizarEstadoVazio();
    }
  );
}

async function deletarHistoricoItem(itemId) {
  try {
    await deleteDoc(doc(db, "historico_visualizacoes", itemId));
  } catch (error) {
    console.error("[Histórico] Erro ao deletar item:", error);
  }
}

async function limparTodoHistorico(userId) {
  try {
    const consulta = query(
      collection(db, "historico_visualizacoes"),
      where("userId", "==", userId)
    );

    const snapshot = await getDocs(consulta);

    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(db, "historico_visualizacoes", docSnap.id));
    }
  } catch (error) {
    console.error("[Histórico] Erro ao limpar histórico:", error);
  }
}

onAuthStateChanged(auth, (user) => {
  usuarioAtualId = user?.uid || null;

  if (!user) {
    if (historicoContainer) {
      historicoContainer.innerHTML = `
        <p style="text-align:center;">
          Você precisa fazer login para ver seu histórico.
        </p>
      `;
    }
    return;
  }

  carregarHistoricoUsuario(user.uid);
});

window.BrasflixHistorico = {
  registrarVisualizacao,
  atualizarTempoVisualizacao,
  carregarHistoricoUsuario,
  deletarHistoricoItem,
  limparTodoHistorico
};

export {
  registrarVisualizacao,
  atualizarTempoVisualizacao,
  carregarHistoricoUsuario,
  deletarHistoricoItem,
  limparTodoHistorico
};
