
import { AIEngine } from "./ai-engine.js";
import { db } from "./firebase-config.js";
import { collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const DashboardAdminIA = {
    // Coletar métricas gerais
    async coletarMetricasGerais() {
        try {
            const usuarios = await getDocs(collection(db, "usuarios"));
            const videos = await getDocs(collection(db, "videos"));
            const comentarios = await getDocs(collection(db, "comentarios"));
            const visualizacoes = await getDocs(collection(db, "historico_visualizacoes"));

            return {
                totalUsuarios: usuarios.size,
                totalVideos: videos.size,
                totalComentarios: comentarios.size,
                totalVisualizacoes: visualizacoes.size,
                videosMaisAssistidos: await this.obterVideosMaisAssistidos(),
                usuariosAtivos: usuarios.docs.filter(doc => {
                    const lastAuth = doc.data().lastAuthTimestamp;
                    if (!lastAuth) return false;
                    const umDiaAtras = Date.now() - 86400000;
                    return lastAuth > umDiaAtras;
                }).length
            };
        } catch (erro) {
            console.error("Erro ao coletar métricas:", erro);
            return null;
        }
    },

    // Vídeos mais assistidos
    async obterVideosMaisAssistidos(limite = 5) {
        try {
            const vis = await getDocs(collection(db, "historico_visualizacoes"));
            const contagemVideos = {};

            vis.docs.forEach(doc => {
                const videoId = doc.data().videoId;
                contagemVideos[videoId] = (contagemVideos[videoId] || 0) + 1;
            });

            return Object.entries(contagemVideos)
                .sort(([, a], [, b]) => b - a)
                .slice(0, limite)
                .map(([id, count]) => ({ videoId: id, visualizacoes: count }));
        } catch (erro) {
            return [];
        }
    },

    // IA gera relatório executivo
    async gerarRelatorioExecutivo() {
        if (!AIEngine) return { sucesso: false, erro: "AIEngine não disponível" };

        const metricas = await this.coletarMetricasGerais();
        if (!metricas) {
            return { sucesso: false, erro: "Erro ao coletar métricas" };
        }

        const prompt = `Analise estas métricas da plataforma BRASFLIX e gere um relatório executivo:

- Usuários: ${metricas.totalUsuarios}
- Usuários ativos (últimas 24h): ${metricas.usuariosAtivos}
- Vídeos: ${metricas.totalVideos}
- Visualizações totais: ${metricas.totalVisualizacoes}
- Comentários: ${metricas.totalComentarios}

Vídeos mais assistidos:
${metricas.videosMaisAssistidos.map((v, i) => `${i + 1}. ${v.videoId}: ${v.visualizacoes} views`).join("\n")}

Forneça (em formato estruturado):
1. Status geral (saúde da plataforma)
2. KPIs principais (highlight)
3. Tendências observadas
4. Alertas ou preocupações
5. Recomendações para crescimento`;

        const resultado = await AIEngine.gerar({
            prompt,
            system: "Você é um analista de negócios sênior. Forneça insights executivos claros e acionáveis."
        });

        if (!resultado.sucesso) {
            return { sucesso: false, erro: resultado.erro };
        }

        return {
            sucesso: true,
            origem: resultado.origem,
            relatorio: resultado.texto,
            metricas: metricas,
            geradoEm: new Date().toISOString()
        };
    },

    // IA analisa crescimento
    async analisarTendencias() {
        if (!AIEngine) return { sucesso: false, erro: "AIEngine não disponível" };

        const metricas = await this.coletarMetricasGerais();
        if (!metricas) return { sucesso: false, erro: "Erro ao coletar métricas" };

        const prompt = `Analise as tendências de crescimento da plataforma:

Total de usuários: ${metricas.totalUsuarios}
Taxa de atividade: ${((metricas.usuariosAtivos / metricas.totalUsuarios) * 100).toFixed(1)}%
Total de vídeos: ${metricas.totalVideos}
Média de visualizações por vídeo: ${(metricas.totalVisualizacoes / (metricas.totalVideos || 1)).toFixed(1)}

Identifique:
1. Padrões de crescimento
2. Saúde do engajamento (comentários/visualizações)
3. Fatores de retenção
4. Oportunidades de otimização`;

        const resultado = await AIEngine.gerar({ prompt });

        if (!resultado.sucesso) {
            return { sucesso: false, erro: resultado.erro };
        }

        return {
            sucesso: true,
            origem: resultado.origem,
            tendencias: resultado.texto,
            metricas: metricas
        };
    },

    // Renderizar dashboard
    async renderizarDashboard(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = "<p>🔄 Gerando insights...</p>";

        const relatorio = await this.gerarRelatorioExecutivo();
        const tendencias = await this.analisarTendencias();

        let html = `
            <div style="padding: 20px; background: #1a1a1a; border-radius: 8px; color: #fff;">
                <h2>📊 Dashboard Admin Inteligente</h2>
        `;

        if (relatorio.sucesso) {
            html += `
                <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e50914;">
                    <h3>📋 Relatório Executivo (Via ${relatorio.origem})</h3>
                    <div style="line-height: 1.6; color: #d1d5db; white-space: pre-wrap;">
                        ${relatorio.relatorio}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 20px 0;">
                    <div style="background: #2a2a2a; padding: 15px; border-radius: 8px; text-align: center;">
                        <p style="margin: 0; color: #999; font-size: 12px;">USUÁRIOS</p>
                        <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; color: #e50914;">${relatorio.metricas.totalUsuarios}</p>
                    </div>
                    <div style="background: #2a2a2a; padding: 15px; border-radius: 8px; text-align: center;">
                        <p style="margin: 0; color: #999; font-size: 12px;">ATIVOS (24H)</p>
                        <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; color: #4ade80;">${relatorio.metricas.usuariosAtivos}</p>
                    </div>
                    <div style="background: #2a2a2a; padding: 15px; border-radius: 8px; text-align: center;">
                        <p style="margin: 0; color: #999; font-size: 12px;">VÍDEOS</p>
                        <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; color: #60a5fa;">${relatorio.metricas.totalVideos}</p>
                    </div>
                    <div style="background: #2a2a2a; padding: 15px; border-radius: 8px; text-align: center;">
                        <p style="margin: 0; color: #999; font-size: 12px;">VISUALIZAÇÕES</p>
                        <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; color: #a78bfa;">${relatorio.metricas.totalVisualizacoes}</p>
                    </div>
                </div>
            `;
        }

        if (tendencias.sucesso) {
            html += `
                <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #60a5fa;">
                    <h3>📈 Análise de Tendências (Via ${tendencias.origem})</h3>
                    <div style="line-height: 1.6; color: #d1d5db; white-space: pre-wrap;">
                        ${tendencias.tendencias}
                    </div>
                </div>
            `;
        }

        html += "</div>";
        container.innerHTML = html;
    }
};

window.DashboardAdminIA = DashboardAdminIA;
export { DashboardAdminIA };
