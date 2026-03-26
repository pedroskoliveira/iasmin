import { auth, db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function getUsuarioAtual() {
  return auth.currentUser || null;
}

function normalizarFavorito(video = {}) {
  return {
    id: String(video.id || "").trim(),
    docId: String(video.docId || video.id || "").trim(),
    titulo: String(video.titulo || "Sem título").trim(),
    descricao: String(video.descricao || "").trim(),
    categoria: String(video.categoria || "").trim(),
    thumbnail: String(video.thumbnail || video.capa || "").trim(),
    videoUrl: String(video.videoUrl || "").trim(),
    previewUrl: String(video.previewUrl || "").trim(),
    duracao: Number(video.duracao || video.duracaoSegundos || 0),
    adicionadoEm: new Date().toISOString()
  };
}

async function garantirDocumentoUsuario(uid, email = "") {
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(
      ref,
      {
        usuarioId: uid,
        uid,
        email,
        role: "user",
        favoritos: [],
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      },
      { merge: true }
    );
  }

  return ref;
}

export async function listarFavoritos() {
  const user = getUsuarioAtual();
  if (!user) return [];

  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return [];

  const dados = snap.data() || {};
  return Array.isArray(dados.favoritos) ? dados.favoritos : [];
}

export async function favoritado(videoId) {
  const user = getUsuarioAtual();
  if (!user || !videoId) return false;

  const favoritos = await listarFavoritos();
  return favoritos.some((item) => String(item.id) === String(videoId));
}

export async function adicionarFavorito(video) {
  const user = getUsuarioAtual();

  if (!user) {
    throw new Error("Faça login para adicionar favoritos.");
  }

  const favorito = normalizarFavorito(video);

  if (!favorito.id) {
    throw new Error("Vídeo inválido para favoritar.");
  }

  const ref = await garantirDocumentoUsuario(user.uid, user.email || "");

  const jaExiste = await favoritado(favorito.id);
  if (jaExiste) return false;

  await updateDoc(ref, {
    favoritos: arrayUnion(favorito),
    atualizadoEm: serverTimestamp()
  });

  return true;
}

export async function removerFavorito(videoId) {
  const user = getUsuarioAtual();

  if (!user) {
    throw new Error("Faça login para remover favoritos.");
  }

  if (!videoId) return false;

  const ref = await garantirDocumentoUsuario(user.uid, user.email || "");
  const favoritos = await listarFavoritos();
  const alvo = favoritos.find((item) => String(item.id) === String(videoId));

  if (!alvo) return false;

  await updateDoc(ref, {
    favoritos: arrayRemove(alvo),
    atualizadoEm: serverTimestamp()
  });

  return true;
}
