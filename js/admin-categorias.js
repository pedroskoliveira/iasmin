import { db, auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const formularioCategoria = document.querySelector(".admin-formulario");
const inputCategoria = document.querySelector(".admin-formulario input");
const listaCategorias = document.getElementById("listaCategorias");
const estadoVazioCategorias = document.querySelector(".estado-vazio-admin");
const btnSair = document.querySelector(".login");

function criarCategoriaAdmin(item) {
  const card = document.createElement("div");
  card.classList.add("categoria-chip-admin");

  card.innerHTML = `
    <span>${item.nome}</span>
    <div class="categoria-chip-acoes">
      <button type="button" class="btn-chip-admin" data-action="editar" data-id="${item.id}">Editar</button>
      <button type="button" class="btn-chip-admin" data-action="remover" data-id="${item.id}">Remover</button>
    </div>
  `;

  const botoes = card.querySelectorAll("button[data-action]");
  botoes.forEach((botao) => {
    botao.addEventListener("click", async () => {
      const action = botao.dataset.action;
      const id = botao.dataset.id;

      try {
        if (action === "editar") {
          const novoNome = prompt("Novo nome da categoria:", item.nome);
          if (!novoNome?.trim()) return;

          await updateDoc(doc(db, "categorias", id), {
            nome: novoNome.trim(),
            atualizadoEm: serverTimestamp()
          });
        }

        if (action === "remover") {
          await deleteDoc(doc(db, "categorias", id));
        }

        await carregarCategorias();
      } catch (error) {
        console.error("[AdminCategorias] Erro na ação:", error);
        alert("Não foi possível concluir a ação.");
      }
    });
  });

  return card;
}

function atualizarListaCategorias(lista = []) {
  if (!listaCategorias || !estadoVazioCategorias) return;

  listaCategorias.innerHTML = "";

  if (!lista.length) {
    estadoVazioCategorias.style.display = "flex";
    listaCategorias.style.display = "none";
    return;
  }

  estadoVazioCategorias.style.display = "flex";
  estadoVazioCategorias.style.display = "none";
  listaCategorias.style.display = "flex";

  lista.forEach((categoria) => {
    listaCategorias.appendChild(criarCategoriaAdmin(categoria));
  });
}

async function carregarCategorias() {
  try {
    const snapshot = await getDocs(collection(db, "categorias"));

    const lista = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    lista.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));

    atualizarListaCategorias(lista);
  } catch (error) {
    console.error("[AdminCategorias] Erro ao carregar categorias:", error);
    atualizarListaCategorias([]);
  }
}

if (formularioCategoria) {
  formularioCategoria.addEventListener("submit", async (event) => {
    event.preventDefault();

    const valor = inputCategoria?.value?.trim();

    if (!valor) {
      alert("Digite o nome da categoria.");
      return;
    }

    try {
      await addDoc(collection(db, "categorias"), {
        nome: valor,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });

      formularioCategoria.reset();
      await carregarCategorias();
    } catch (error) {
      console.error("[AdminCategorias] Erro ao criar categoria:", error);
      alert("Não foi possível criar a categoria.");
    }
  });
}

if (btnSair) {
  btnSair.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "../login.html";
    } catch (error) {
      console.error("[AdminCategorias] Erro ao sair:", error);
    }
  });
}

carregarCategorias();
