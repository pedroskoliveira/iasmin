import { db } from "./firebase-config.js";

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

async function salvarHistoricoEmocional(entry = {}) {
  if (!db || !entry || !entry.videoId) {
    return null;
  }

  try {
    const docRef = await addDoc(collection(db, "emotionAnalytics"), {
      videoId: entry.videoId,
      userId: entry.userId || "anonimo",
      currentTime: Number(entry.currentTime || 0),
      emocaoDominante: entry.emocaoDominante || "neutro",
      intensidade: Number(entry.intensidade || 0),
      timestamp: serverTimestamp()
    });

    return docRef.id;
  } catch (error) {
    console.error("[FirebaseService] Falha ao salvar histórico emocional:", error);
    return null;
  }
}

async function buscarVideoPorId(videoId = "") {
  if (!db || !videoId) return null;

  try {
    const consulta = query(collection(db, "videos"), where("id", "==", videoId));
    const snapshot = await getDocs(consulta);

    if (!snapshot.empty) {
      const primeiro = snapshot.docs[0];
      return {
        id: primeiro.data()?.id || primeiro.id,
        docId: primeiro.id,
        ...primeiro.data()
      };
    }

    const direto = await getDoc(doc(db, "videos", videoId));
    if (direto.exists()) {
      return {
        id: direto.data()?.id || direto.id,
        docId: direto.id,
        ...direto.data()
      };
    }

    return null;
  } catch (error) {
    console.error("[FirebaseService] Falha ao buscar vídeo por ID:", error);
    return null;
  }
}

async function buscarComentariosPorVideo(videoId = "") {
  if (!db || !videoId) return [];

  try {
    const consulta = query(collection(db, "comentarios"), where("videoId", "==", videoId));
    const snapshot = await getDocs(consulta);

    return snapshot.docs.map((documento) => ({
      id: documento.id,
      ...documento.data()
    }));
  } catch (error) {
    console.error("[FirebaseService] Falha ao buscar comentários por vídeo:", error);
    return [];
  }
}

async function buscarRecomendacoesPorCategoria(categoria = "") {
  if (!db || !categoria) return [];

  try {
    const consulta = query(collection(db, "videos"), where("categoria", "==", categoria));
    const snapshot = await getDocs(consulta);

    return snapshot.docs
      .map((documento) => ({
        id: documento.data()?.id || documento.id,
        docId: documento.id,
        ...documento.data()
      }))
      .filter((item) => item.categoria);
  } catch (error) {
    console.error("[FirebaseService] Falha ao buscar recomendações por categoria:", error);
    return [];
  }
}

async function buscarTodosVideos() {
  if (!db) return [];

  try {
    const snapshot = await getDocs(collection(db, "videos"));

    return snapshot.docs.map((documento) => ({
      id: documento.data()?.id || documento.id,
      docId: documento.id,
      ...documento.data()
    }));
  } catch (error) {
    console.error("[FirebaseService] Falha ao buscar todos os vídeos:", error);
    return [];
  }
}

async function atualizarCurtidasVideo(videoId = "", acao = "curtir") {
  if (!db || !videoId) {
    return null;
  }

  try {
    const consulta = query(collection(db, "videos"), where("id", "==", videoId));
    const snapshot = await getDocs(consulta);

    if (snapshot.empty) {
      return null;
    }

    const docRef = snapshot.docs[0].ref;
    const campo = acao === "descurtir" ? "dislikes" : "likes";

    await updateDoc(docRef, {
      [campo]: increment(1),
      atualizadoEm: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error("[FirebaseService] Falha ao atualizar likes/dislikes:", error);
    return null;
  }
}

async function buscarVideosPorCategoria(categoria = "") {
  if (!db || !categoria) {
    return [];
  }

  try {
    const consulta = query(collection(db, "videos"), where("categoria", "==", categoria));
    const snapshot = await getDocs(consulta);

    return snapshot.docs.map((documento) => ({
      id: documento.data()?.id || documento.id,
      docId: documento.id,
      ...documento.data()
    }));
  } catch (error) {
    console.error("[FirebaseService] Falha ao buscar vídeos por categoria:", error);
    return [];
  }
}

async function buscarHistoricoEmocional({ userId = null, videoId = null } = {}) {
  if (!db) {
    return [];
  }

  try {
    const constraints = [];

    if (userId) {
      constraints.push(where("userId", "==", userId));
    }

    if (videoId) {
      constraints.push(where("videoId", "==", videoId));
    }

    const consulta = constraints.length
      ? query(collection(db, "emotionAnalytics"), ...constraints)
      : query(collection(db, "emotionAnalytics"));

    const snapshot = await getDocs(consulta);

    return snapshot.docs.map((documento) => ({
      id: documento.id,
      ...documento.data()
    }));
  } catch (error) {
    console.error("[FirebaseService] Falha ao buscar histórico emocional:", error);
    return [];
  }
}

async function buscarUsuarios() {
  if (!db) return [];

  try {
    const snapshot = await getDocs(collection(db, "usuarios"));

    return snapshot.docs.map((documento) => ({
      id: documento.id,
      ...documento.data()
    }));
  } catch (error) {
    console.error("[FirebaseService] Falha ao buscar usuários:", error);
    return [];
  }
}

window.BrasflixFirebase = {
  salvarHistoricoEmocional,
  buscarVideoPorId,
  buscarComentariosPorVideo,
  buscarRecomendacoesPorCategoria,
  buscarTodosVideos,
  buscarVideosPorCategoria,
  atualizarCurtidasVideo,
  buscarHistoricoEmocional,
  buscarUsuarios
};

export {
  salvarHistoricoEmocional,
  buscarVideoPorId,
  buscarComentariosPorVideo,
  buscarRecomendacoesPorCategoria,
  buscarTodosVideos,
  buscarVideosPorCategoria,
  atualizarCurtidasVideo,
  buscarHistoricoEmocional,
  buscarUsuarios
};
