import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  getDocs,
  collection,
  query,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const inputUid = document.getElementById("userUid");
const inputEmail = document.getElementById("userEmail");
const searchEmail = document.getElementById("searchEmail");
const searchByEmailBtn = document.getElementById("searchByEmailBtn");
const selectRole = document.getElementById("userRole");
const statusEl = document.getElementById("result");
const btnSetRole = document.getElementById("setRoleBtn");
const btnRemove = document.getElementById("removeBtn");
const btnLoadUsers = document.getElementById("loadUsersBtn");
const syncClaimsBtn = document.getElementById("syncClaimsBtn");
const usersList = document.getElementById("usersList");
const loggedUserInfo = document.getElementById("loggedUserInfo");

let currentUser = null;
let isCurrentUserAdmin = false;

function setStatus(msg, isError = false) {
  if (!statusEl) return;

  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#ff6b6b" : "#22c55e";
}

function renderLoggedUser(user, dados = {}) {
  if (loggedUserInfo) {
    loggedUserInfo.textContent = user
      ? `${dados.nome || user.displayName || user.email || user.uid} • role: ${dados.role || "user"}`
      : "Nenhum usuário logado";
  }
}

async function buscarUsuarioPorUid(uid) {
  if (!uid) return null;

  const snap = await getDoc(doc(db, "usuarios", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function buscarUsuarioPorEmail(email) {
  if (!email) return null;

  const qs = query(
    collection(db, "usuarios"),
    where("email", "==", email),
    limit(1)
  );

  const snap = await getDocs(qs);

  if (snap.empty) return null;

  return {
    id: snap.docs[0].id,
    ...snap.docs[0].data()
  };
}

function preencher(usuario) {
  if (!usuario) return;

  if (inputUid) {
    inputUid.value = usuario.uid || usuario.usuarioId || usuario.id || "";
  }

  if (inputEmail) {
    inputEmail.value = usuario.email || "";
  }

  if (selectRole) {
    selectRole.value = usuario.role || "user";
  }
}

async function syncClaims() {
  if (!currentUser) {
    return setStatus("Faça login primeiro.", true);
  }

  const token = await currentUser.getIdToken();

  const response = await fetch("/api/admin-sync-claims", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({})
  });

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    return setStatus(data?.error || "Falha ao sincronizar claims.", true);
  }

  setStatus(`Claims sincronizadas. role=${data.role}`);
}

async function aplicarRole(role = "user") {
  if (!currentUser) {
    return setStatus("Faça login primeiro.", true);
  }

  if (!isCurrentUserAdmin) {
    return setStatus("Você não tem permissão para alterar cargos.", true);
  }

  const uid = inputUid?.value?.trim();

  if (!uid) {
    return setStatus("Informe ou selecione um usuário.", true);
  }

  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return setStatus("Usuário não encontrado.", true);
  }

  await updateDoc(ref, { role });

  if (selectRole) {
    selectRole.value = role;
  }

  setStatus(`Cargo atualizado para ${role}. Agora sincronize as claims se necessário.`);
  await carregarUsuarios();
}

async function carregarUsuarios() {
  if (!usersList) return;

  usersList.innerHTML = "<p>Carregando usuários...</p>";

  const snap = await getDocs(collection(db, "usuarios"));

  if (snap.empty) {
    usersList.innerHTML = "<p>Nenhum usuário encontrado.</p>";
    return;
  }

  usersList.innerHTML = "";

  snap.docs.forEach((docSnap) => {
    const usuario = {
      id: docSnap.id,
      ...docSnap.data()
    };

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "user-item";
    btn.textContent = `${usuario.nome || usuario.email || usuario.id} • ${usuario.role || "user"}`;

    btn.addEventListener("click", () => {
      preencher(usuario);
      setStatus(`Usuário selecionado: ${usuario.nome || usuario.email || usuario.id}`);
    });

    usersList.appendChild(btn);
  });
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;

  if (!user) {
    renderLoggedUser(null);
    return setStatus("Você precisa estar logado.", true);
  }

  const dados = await buscarUsuarioPorUid(user.uid);

  renderLoggedUser(user, dados || {});

  isCurrentUserAdmin = !!dados && dados.role === "admin";

  if (!isCurrentUserAdmin) {
    return setStatus(
      "Somente administradores podem alterar perfis. Para o primeiro admin, use setup-admin.html.",
      true
    );
  }

  setStatus("Administrador autenticado.");
  await carregarUsuarios();
});

btnLoadUsers?.addEventListener("click", carregarUsuarios);

btnSetRole?.addEventListener("click", () =>
  aplicarRole(selectRole?.value?.trim() || "user")
);

btnRemove?.addEventListener("click", () => aplicarRole("user"));

syncClaimsBtn?.addEventListener("click", syncClaims);

searchByEmailBtn?.addEventListener("click", async () => {
  const usuario = await buscarUsuarioPorEmail(searchEmail?.value?.trim() || "");

  if (!usuario) {
    return setStatus("Nenhum usuário encontrado com esse e-mail.", true);
  }

  preencher(usuario);
  setStatus(`Usuário selecionado: ${usuario.nome || usuario.email || usuario.id}`);
});
