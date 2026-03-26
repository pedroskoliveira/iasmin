import { db, auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const listaComentarios = document.getElementById("listaComentarios");
const estadoVazioComentarios = document.querySelector(".estado-vazio-admin");
const btnSair = document.querySelector(".login");

function criarComentarioAdmin(comentario) {
  const item = document.createElement("div");
  item.classList.add("comentario-admin-card");

  item.innerHTML = `
    <div class="comentario-admin-topo">
      <strong>${comentario.nomeAutor || "Usuário"}</strong>
      <span>${comentario.videoId || "Vídeo"}</span>
    </div>

    <p class="comentario-admin-texto">${comentario.texto || ""}</p>

    <div class="comentario-admin-acoes">
      <button type="button" class="btn-chip-admin" data-action="aprovar" data-id="${comentario.id}">
        ${comentario.status === "aprovado" ? "Aprovado" : "Aprovar"}
      </button>
      <button type="button" class="btn-chip-admin" data-action="ocultar" data-id="${comentario.id}">
        ${comentario.status === "oculto" ? "Oculto" : "Ocultar"}
      </button>
      <button type="button" class="btn-chip-admin" data-action="remover" data-id="${comentario.id}">
        Remover
      </button>
    </div>
  `;

  const botoes = item.querySelectorAll("button[data-action]");
  botoes.forEach((botao) => {
    botao.addEventListener("click", async () => {
      const action = botao.dataset.action;
      const id = botao.dataset.id;

      try {
        if (action === "aprovar") {
          await updateDoc(doc(db, "comentarios", id), { status: "aprovado" });
        }

        if (action === "ocultar") {
          await updateDoc(doc(db, "comentarios", id), { status: "oculto" });
        }

        if (action === "remover") {
          await deleteDoc(doc(db, "comentarios", id));
        }

        await carregarComentariosAdmin();
      } catch (error) {
        console.error("[AdminComentarios] Erro na ação:", error);
        alert("Não foi possível concluir a ação.");
      }
    });
  });

  return item;
}

function atualizarComentariosAdmin(lista = []) {
  if (!listaComentarios || !estadoVazioComentarios) return;

  listaComentarios.innerHTML = "";

  if (!lista.length) {
    estadoVazioComentarios.style.display = "flex";
    listaComentarios.style.display = "none";
    return;
  }

  estadoVazioComentarios.style.display = "none";
  listaComentarios.style.display = "flex";

  lista.forEach((comentario) => {
    listaComentarios.appendChild(criarComentarioAdmin(comentario));
  });
}

async function carregarComentariosAdmin() {
  try {
    const snapshot = await getDocs(collection(db, "comentarios"));

    const lista = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    lista.sort((a, b) => {
      const aData = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
      const bData = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
      return bData - aData;
    });

    atualizarComentariosAdmin(lista);
  } catch (error) {
    console.error("[AdminComentarios] Erro ao carregar comentários:", error);
    atualizarComentariosAdmin([]);
  }
}

if (btnSair) {
  btnSair.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "../login.html";
    } catch (error) {
      console.error("[AdminComentarios] Erro ao sair:", error);
    }
  });
}

carregarComentariosAdmin();
