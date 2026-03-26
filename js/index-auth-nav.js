import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const userNome = document.getElementById("userNome");
const navActions = document.querySelector(".nav-actions") || document.querySelector(".nav");

function getAdminButton() {
  return document.getElementById("adminAccessButton");
}

function mostrarLogin() {
  if (loginButton) loginButton.classList.remove("oculto");
  if (logoutButton) logoutButton.classList.add("oculto");

  const adminButton = getAdminButton();
  if (adminButton) adminButton.remove();

  if (userNome) {
    userNome.classList.add("oculto");
    userNome.textContent = "";
  }
}

function garantirBotaoAdmin() {
  if (!navActions) return null;

  let adminButton = getAdminButton();

  if (!adminButton) {
    adminButton = document.createElement("button");
    adminButton.id = "adminAccessButton";
    adminButton.className = "btn-acao";
    adminButton.textContent = "Admin";
    adminButton.style.background = "#1b0b0b";
    adminButton.style.border = "1px solid #e50914";
    adminButton.style.color = "#fff";
    adminButton.addEventListener("click", () => {
      window.location.href = "/admin/dashboard.html";
    });

    navActions.insertBefore(adminButton, logoutButton || loginButton || null);
  }

  return adminButton;
}

function mostrarUsuario(nome, isAdmin = false) {
  if (loginButton) loginButton.classList.add("oculto");
  if (logoutButton) logoutButton.classList.remove("oculto");

  if (userNome) {
    userNome.classList.remove("oculto");
    userNome.textContent = `Olá, ${nome}`;
  }

  if (isAdmin) {
    garantirBotaoAdmin();
  } else {
    const adminButton = getAdminButton();
    if (adminButton) adminButton.remove();
  }
}

async function buscarDadosUsuario(uid, fallbackEmail = "") {
  try {
    const snap = await getDoc(doc(db, "usuarios", uid));

    if (!snap.exists()) {
      return {
        nome: fallbackEmail || "Usuário",
        isAdmin: false
      };
    }

    const dados = snap.data() || {};
    return {
      nome: dados.nome || dados.email || fallbackEmail || "Usuário",
      isAdmin: dados.role === "admin"
    };
  } catch (error) {
    console.error("[Navbar] Erro ao buscar usuário:", error);
    return {
      nome: fallbackEmail || "Usuário",
      isAdmin: false
    };
  }
}

async function atualizarNavbar(user) {
  if (!user) {
    mostrarLogin();
    return;
  }

  const { nome, isAdmin } = await buscarDadosUsuario(user.uid, user.email || "");
  mostrarUsuario(nome, isAdmin);
}

if (loginButton) {
  loginButton.addEventListener("click", () => {
    window.location.href = "/login.html";
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("faceLoginUser");
      localStorage.removeItem("faceLoginEmail");
      window.location.href = "/login.html";
    } catch (error) {
      console.error("[Navbar] Erro ao sair:", error);
      alert("Não foi possível sair agora.");
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  await atualizarNavbar(user);
});
