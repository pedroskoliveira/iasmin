import { auth, db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { geminiClient } from "./gemini.js";
import { mistralClient } from "./mistral.js";

const AIEngine = {
  providerPadrao: "gemini",

  async coletarContextoUsuario(uid) {
    if (!uid) {
      return { historico: [], comentarios: [], favoritos: [] };
    }

    try {
      const [historicoSnap, comentariosSnap, usuariosSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "historico_visualizacoes"),
            where("userId", "==", uid),
            orderBy("timestamp", "desc"),
            limit(10)
          )
        ),
        getDocs(
          query(
            collection(db, "comentarios"),
            where("userId", "==", uid),
            orderBy("timestamp", "desc"),
            limit(10)
          )
        ),
        getDocs(
          query(
            collection(db, "usuarios"),
            where("usuarioId", "==", uid),
            limit(1)
          )
        )
      ]);

      const historico = historicoSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const comentarios = comentariosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const usuario = usuariosSnap.empty ? {} : (usuariosSnap.docs[0].data() || {});
      const favoritos = Array.isArray(usuario.favoritos) ? usuario.favoritos : [];

      return { historico, comentarios, favoritos };
    } catch (error) {
      console.error("[AIEngine] Erro ao coletar contexto:", error);
      return { historico: [], comentarios: [], favoritos: [] };
    }
  },

  montarContextoTexto(contexto = {}) {
    const partes = [];

    if (Array.isArray(contexto.historico) && contexto.historico.length) {
      partes.push(
        "Histórico recente:\n" +
          contexto.historico.map((item, i) => `${i + 1}. ${item.videoTitulo || item.titulo || "Vídeo"}`).join("\n")
      );
    }

    if (Array.isArray(contexto.favoritos) && contexto.favoritos.length) {
      partes.push(
        "Favoritos:\n" +
          contexto.favoritos.map((item, i) => `${i + 1}. ${item.titulo || "Vídeo"}`).join("\n")
      );
    }

    if (Array.isArray(contexto.comentarios) && contexto.comentarios.length) {
      partes.push(
        "Comentários recentes:\n" +
          contexto.comentarios.map((item, i) => `${i + 1}. ${item.texto || ""}`).join("\n")
      );
    }

    return partes.join("\n\n");
  },

  async gerar({
    prompt,
    system = "Você é a PedrIA da BRASFLIX. Responda em português do Brasil, de forma útil e objetiva.",
    provider = null,
    incluirContextoUsuario = true,
    contextoExtra = []
  }) {
    try {
      const uid = auth.currentUser?.uid || null;
      const context = [];

      if (Array.isArray(contextoExtra) && contextoExtra.length) {
        contextoExtra.forEach((item) => {
          if (item?.content) {
            context.push({
              role: item.role || "system",
              content: String(item.content)
            });
          }
        });
      }

      if (incluirContextoUsuario && uid) {
        const contexto = await this.coletarContextoUsuario(uid);
        const contextoTexto = this.montarContextoTexto(contexto);

        if (contextoTexto) {
          context.push({
            role: "system",
            content: `Contexto do usuário:\n${contextoTexto}`
          });
        }
      }

      const prov = provider || this.providerPadrao;

      let resposta =
        prov === "mistral"
          ? await mistralClient.sendMessage({
              message: prompt,
              context,
              systemInstruction: system
            })
          : await geminiClient.sendMessage({
              message: prompt,
              context,
              systemInstruction: system
            });

      if (!resposta?.ok && prov !== "mistral") {
        resposta = await mistralClient.sendMessage({
          message: prompt,
          context,
          systemInstruction: system
        });
      }

      if (!resposta?.ok) {
        return {
          sucesso: false,
          origem: resposta?.provider || prov,
          erro: resposta?.error || "Falha ao gerar resposta."
        };
      }

      return {
        sucesso: true,
        origem: resposta.provider || prov,
        texto: resposta.text || "",
        aviso: resposta.notice || ""
      };
    } catch (error) {
      console.error("[AIEngine] Erro:", error);
      return {
        sucesso: false,
        origem: provider || this.providerPadrao,
        erro: error.message || "Erro interno na IA."
      };
    }
  }
};

window.AIEngine = AIEngine;
export { AIEngine };
