import { auth, db } from "./firebase-config.js";
import { collection, addDoc, query, where, getDocs, serverTimestamp, onSnapshot, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const chatMensagensContainer = document.getElementById("chatMensagensContainer");
const chatInputMensagem = document.getElementById("chatInputMensagem");
const chatBotaoEnviar = document.getElementById("chatBotaoEnviar");
let usuarioAtualId = null;
let usuarioAtualNome = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    usuarioAtualId = user.uid;
    usuarioAtualNome = user.displayName || user.email?.split("@")[0] || "Usuário";
  } else {
    usuarioAtualId = null;
    usuarioAtualNome = null;
  }
});

async function enviarMensagem(salaId, texto) {
  if (!usuarioAtualId || !salaId || !texto?.trim()) return false;
  await addDoc(collection(db, "chatRooms", salaId, "mensagens"), {
    texto: texto.trim(), autorId: usuarioAtualId, autorNome: usuarioAtualNome || "Usuário", criadoEm: serverTimestamp(), lida: false
  });
  return true;
}

function carregarChat(salaId, callback) {
  if (!salaId) return () => {};
  const consulta = query(collection(db, "chatRooms", salaId, "mensagens"), orderBy("criadoEm", "asc"), limit(100));
  return onSnapshot(consulta, (snapshot) => {
    const mensagens = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (typeof callback === "function") callback(mensagens);
    if (chatMensagensContainer) chatMensagensContainer.textContent = "";
  });
}

async function carregarSalasChat(uid = usuarioAtualId) {
  if (!uid) return [];
  const consulta = query(collection(db, "chatRooms"), where("participantes", "array-contains", uid));
  const snapshot = await getDocs(consulta);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export { enviarMensagem, carregarChat, carregarSalasChat };
