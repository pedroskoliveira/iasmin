import { AIEngine } from "./ai-engine.js";
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const AnalyticsIA = {
  async obterMetricasVideo(videoId) {
    try {
      const comentariosSnap = await getDocs(
        query(collection(db, "comentarios"), where("videoId", "==", videoId))
      );

      const visualizacoesSnap = await getDocs(
        query(collection(db, "historico_visualizacoes"), where("videoId", "==", videoId))
      );

      const totalComentarios = comentariosSnap.size;
      const totalVisualizacoes = visualizacoesSnap.size;

      const tempoMedioAssistido = visualizacoesSnap.docs.length
        ? Math.round(
            visualizacoesSnap.docs.reduce((soma, item) => soma + Number(item.data().tempoAssistido || 0), 0) /
            visualizacoesSnap.docs.length
          )
        : 0;

      return {
        videoId,
        totalVisualizacoes,
        totalComentarios,
        tempoMedioAssistido,
        dataColetada: new Date().toISOString()
      };
    } catch (erro) {
      console.error("[AnalyticsIA] Erro ao obter métricas:", erro);
      return null;
    }
  },

  async analisarMetricas(metricas) {
    if (!AIEngine) {
      return { sucesso: false, erro: "AIEngine não disponível." };
    }

    if (!metricas) {
      return { sucesso: false, erro: "Métricas vazias." };
    }

    const prompt = `Analise estas métricas de vídeo da plataforma BRASFLIX:

Visualizações: ${metricas.totalVisualizacoes}
Comentários: ${metricas.totalComentarios}
Tempo médio assistido: ${metricas.tempoMedioAssistido} segundos

Forneça:
1. análise geral de performance
2. pontos fortes
3. problemas ou gargalos
4. ações recomendadas

Responda em português do Brasil, de forma objetiva e prática.`;

    const resultado = await AIEngine.gerar({
      prompt,
      system: "Você é um analista de dados de streaming e comportamento de audiência."
    });

    if (!resultado?.sucesso) {
      return { sucesso: false, erro: resultado?.erro || "Falha ao gerar análise." };
    }

    return {
      sucesso: true,
      origem: resultado.origem,
      analise: resultado.texto,
      metricas
    };
  },

  async analisarSentimentoComentarios(videoId) {
    if (!AIEngine) {
      return { sucesso: false, sentimentos: {} };
    }

    try {
      const comentariosSnap = await getDocs(
        query(collection(db, "comentarios"), where("videoId", "==", videoId))
      );

      if (comentariosSnap.empty) {
        return {
          sucesso: true,
          sentimentos: { positivo: 0, neutro: 100, negativo: 0 },
          resumo: "Ainda não há comentários suficientes.",
          totalComentarios: 0
        };
      }

      const textos = comentariosSnap.docs
        .map((item) => item.data().texto || item.data().conteudo || "")
        .filter(Boolean)
        .slice(0, 8);

      const prompt = `Analise o sentimento geral destes comentários:

${textos.join("\n\n")}

Retorne em JSON válido neste formato:
{
  "sentimentos": {
    "positivo": número,
    "neutro": número,
    "negativo": número
  },
  "resumo": "texto"
}`;

      const resultado = await AIEngine.gerar({ prompt });

      if (!resultado?.sucesso) {
        return { sucesso: false, sentimentos: {} };
      }

      try {
        const dados = JSON.parse(resultado.texto);
        return {
          sucesso: true,
          origem: resultado.origem,
          sentimentos: dados.sentimentos || { positivo: 0, neutro: 100, negativo: 0 },
          resumo: dados.resumo || "Sem resumo.",
          totalComentarios: comentariosSnap.size
        };
      } catch (erro) {
        console.error("[AnalyticsIA] JSON inválido:", erro);
        return { sucesso: false, sentimentos: {} };
      }
    } catch (erro) {
      console.error("[AnalyticsIA] Erro ao analisar sentimento:", erro);
      return { sucesso: false, sentimentos: {} };
    }
  },

  async renderizarAnalise(containerId, videoId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "<p>🔄 Analisando métricas...</p>";

    const metricas = await this.obterMetricasVideo(videoId);

    if (!metricas) {
      container.innerHTML = "<p>❌ Não foi possível obter métricas.</p>";
      return;
    }

    const analise = await this.analisarMetricas(metricas);
    const sentimentos = await this.analisarSentimentoComentarios(videoId);

    let html = `
      <div style="padding:20px; background:#1a1a1a; border-radius:8px; color:#fff;">
        <h3>📊 Análise Inteligente do Vídeo</h3>

        <div style="background:#2a2a2a; padding:15px; border-radius:6px; margin:12px 0;">
          <h4>Resumo rápido</h4>
          <p>👁️ <strong>${metricas.totalVisualizacoes}</strong> visualizações</p>
          <p>💬 <strong>${metricas.totalComentarios}</strong> comentários</p>
          <p>⏱️ <strong>${metricas.tempoMedioAssistido}s</strong> tempo médio assistido</p>
        </div>
    `;

    if (analise.sucesso) {
      html += `
        <div style="background:#2a2a2a; padding:15px; border-radius:6px; margin:12px 0;">
          <h4>🤖 Insights da IA</h4>
          <p>${String(analise.analise || "").replace(/\n/g, "<br>")}</p>
          <p style="font-size:12px; color:#999;">Provider: ${analise.origem || "desconhecido"}</p>
        </div>
      `;
    }

    if (sentimentos.sucesso) {
      html += `
        <div style="background:#2a2a2a; padding:15px; border-radius:6px; margin:12px 0;">
          <h4>😊 Sentimento dos comentários</h4>
          <p>Positivo: <strong>${sentimentos.sentimentos.positivo ?? 0}%</strong></p>
          <p>Neutro: <strong>${sentimentos.sentimentos.neutro ?? 0}%</strong></p>
          <p>Negativo: <strong>${sentimentos.sentimentos.negativo ?? 0}%</strong></p>
          <p style="margin-top:10px;">${sentimentos.resumo || ""}</p>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
  }
};

window.AnalyticsIA = AnalyticsIA;

export { AnalyticsIA };
