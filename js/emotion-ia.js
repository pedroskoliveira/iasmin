 (function () {
    const STORAGE_CONSENTIMENTO_EMOCAO = "brasflix_consentimento_emocao";

    const player = document.getElementById("playerBrasflix");

    const videoCamera = document.getElementById("emotionCamera");
    const canvasProcessamento = document.getElementById("emotionCanvas");

    const statusBox = document.getElementById("emotionStatus");

    const estado = {
        ativo: false,
        stream: null,
        intervaloAnalise: null,
        amostras: [],
        videoId: "",
        ultimoStatus: ""
    };

    function obterVideoIdDaUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get("id") || "";
    }

    function atualizarStatus(texto) {
        estado.ultimoStatus = texto;

        if (statusBox) {
            statusBox.textContent = texto;
        }
    }

    function salvarConsentimento(valor) {
        localStorage.setItem(STORAGE_CONSENTIMENTO_EMOCAO, valor ? "true" : "false");
    }

    function obterConsentimentoSalvo() {
        return localStorage.getItem(STORAGE_CONSENTIMENTO_EMOCAO) === "true";
    }

    async function iniciarCameraOculta() {
        if (estado.stream) return;

        estado.stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user",
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        });

        if (videoCamera) {
            videoCamera.srcObject = estado.stream;
            await videoCamera.play().catch(() => {});
        }

        await new Promise((resolve) => {
            if (!videoCamera) {
                resolve();
                return;
            }

            if (videoCamera.readyState >= 1) {
                if (canvasProcessamento) {
                    canvasProcessamento.width = videoCamera.videoWidth || 640;
                    canvasProcessamento.height = videoCamera.videoHeight || 480;
                }
                resolve();
                return;
            }

            videoCamera.onloadedmetadata = () => {
                if (canvasProcessamento) {
                    canvasProcessamento.width = videoCamera.videoWidth || 640;
                    canvasProcessamento.height = videoCamera.videoHeight || 480;
                }
                resolve();
            };
        });
    }

    function pararCameraOculta() {
        if (estado.stream) {
            estado.stream.getTracks().forEach((track) => track.stop());
            estado.stream = null;
        }

        if (videoCamera) {
            videoCamera.srcObject = null;
        }
    }

    function obterCurrentTimeDoPlayer() {
        if (!player) return 0;
        return Number(player.currentTime || 0);
    }

    function playerEstaRodando() {
        if (!player) return false;
        return !player.paused && !player.ended;
    }

    const EMOCOES_PADRAO = ["neutro", "feliz", "triste", "irritado", "surpreso", "curioso"];

    function mapFaceApiParaEmocao(expressao) {
        const mapeamento = {
            neutral: "neutro",
            happy: "feliz",
            sad: "triste",
            angry: "irritado",
            surprised: "surpreso",
            fearful: "curioso",
            disgusted: "irritado"
        };

        return mapeamento[expressao] || "neutro";
    }

    async function detectarEmocaoFaceApi() {
        if (!window.faceapi || !videoCamera) {
            return null;
        }

        try {
            const detections = await window.faceapi
                .detectSingleFace(videoCamera, new window.faceapi.TinyFaceDetectorOptions())
                .withFaceExpressions();

            if (!detections || !detections.expressions) {
                return null;
            }

            const melhor = Object.entries(detections.expressions).reduce(
                (acc, [nome, valor]) => (valor > acc.valor ? { nome, valor } : acc),
                { nome: "neutral", valor: 0 }
            );

            return {
                emocaoDominante: mapFaceApiParaEmocao(melhor.nome),
                intensidade: Math.min(1, melhor.valor + 0.1)
            };
        } catch (erro) {
            console.warn("Erro ao processar expressao facial", erro);
            return null;
        }
    }

    async function gerarAmostraEstrutural() {
        const expressaoDetectada = await detectarEmocaoFaceApi();

        let emocaoDominante = "neutro";
        let intensidade = 0.3;

        if (expressaoDetectada) {
            emocaoDominante = expressaoDetectada.emocaoDominante;
            intensidade = expressaoDetectada.intensidade;
        } else {
            emocaoDominante = EMOCOES_PADRAO[Math.floor(Math.random() * EMOCOES_PADRAO.length)];
            intensidade = Math.min(1, Math.random() + 0.2);
        }

        return {
            videoId: estado.videoId,
            currentTime: obterCurrentTimeDoPlayer(),
            emocaoDominante,
            intensidade,
            timestamp: new Date().toISOString()
        };
    }

    function registrarAmostra(amostra) {
        estado.amostras.push(amostra);

        if (estado.amostras.length > 200) {
            estado.amostras.splice(0, estado.amostras.length - 200);
        }

        const historico = estado.amostras.map((item) => ({
            videoId: item.videoId,
            currentTime: item.currentTime,
            emocaoDominante: item.emocaoDominante,
            intensidade: item.intensidade,
            timestamp: item.timestamp
        }));

        localStorage.setItem("brasflixEmotionHistory", JSON.stringify(historico));

        if (window.BrasflixAnalyticsPage?.atualizarHistoricoEmocional) {
            window.BrasflixAnalyticsPage.atualizarHistoricoEmocional(historico);
        }

        if (window.BrasflixFirebase?.salvarHistoricoEmocional) {
            window.BrasflixFirebase.salvarHistoricoEmocional({
                userId: window.currentUserId || "anonimo",
                ...amostra
            }).catch((erro) => console.warn("Falha ao salvar no Firestore:", erro));
        }
    }

    function iniciarLoopAnalise() {
        if (estado.intervaloAnalise) return;

        estado.intervaloAnalise = setInterval(async () => {
            if (!estado.ativo) return;
            if (!playerEstaRodando()) return;

            const amostra = await gerarAmostraEstrutural();
            registrarAmostra(amostra);

            if (typeof estado.onUpdate === "function") {
                estado.onUpdate({
                    metricas: {
                        emocaoPredominante: amostra.emocaoDominante,
                        intensidade: amostra.intensidade,
                        currentTime: amostra.currentTime
                    },
                    amostra
                });
            }

            if (window.BrasflixEmotionRecommender?.sugerir) {
                window.BrasflixEmotionRecommender.sugerir(amostra.emocaoDominante);
            }

            atualizarStatus(
                `Análise emocional ativa. Última leitura em ${Math.floor(amostra.currentTime)}s (${amostra.emocaoDominante}).`
            );
        }, 5000);
    }

    function pararLoopAnalise() {
        if (estado.intervaloAnalise) {
            clearInterval(estado.intervaloAnalise);
            estado.intervaloAnalise = null;
        }
    }

    async function ativarAnaliseEmocional() {
        try {
            estado.videoId = obterVideoIdDaUrl();
            estado.ativo = true;
            salvarConsentimento(true);

            atualizarStatus("Iniciando análise emocional...");
            await iniciarCameraOculta();
            iniciarLoopAnalise();

            atualizarStatus("Análise emocional ativa durante a reprodução do vídeo.");
        } catch (erro) {
            console.error("Erro ao ativar análise emocional:", erro);
            estado.ativo = false;
            salvarConsentimento(false);
            atualizarStatus("Não foi possível ativar a análise emocional.");
        }
    }

    function desativarAnaliseEmocional() {
        estado.ativo = false;
        salvarConsentimento(false);

        pararLoopAnalise();
        pararCameraOculta();

        atualizarStatus("Análise emocional desativada.");
    }

    function prepararEstruturaFutura() {
        /*
        FUTURO:
        Aqui entraremos com:
        - carregamento dos modelos de expressão facial
        - classificação real de emoções
        - associação emoção x currentTime
        - métricas por trecho do vídeo
        - envio para analytics do usuário/admin
        */
    }

    function inicializarEventos() {
        if (player) {
            player.addEventListener("play", () => {
                if (estado.ativo) {
                    atualizarStatus("Análise emocional acompanhando a reprodução.");
                }
            });

            player.addEventListener("pause", () => {
                if (estado.ativo) {
                    atualizarStatus("Vídeo pausado. A análise emocional aguardará a retomada.");
                }
            });

            player.addEventListener("ended", () => {
                if (estado.ativo) {
                    atualizarStatus("Vídeo finalizado. Análise emocional encerrando ciclo atual.");
                }
            });
        }
    }

    async function inicializarEstadoInicial() {
        estado.videoId = obterVideoIdDaUrl();
        prepararEstruturaFutura();

        // Iniciar modelos de expressão facial do módulo expressoes.js
        if (window.ExpressoesFaceAPI && typeof window.ExpressoesFaceAPI.carregarModelos === "function") {
            try {
                await window.ExpressoesFaceAPI.carregarModelos();
                console.log("ExpressoesFaceAPI: modelos carregados com sucesso.");
            } catch (erro) {
                console.warn("Falha ao carregar modelos de expressoes:", erro);
            }
        }

        // Opcional: iniciar o motor de expressão (não obrigatório, mas disponível)
        if (window.ExpressoesFaceAPI && typeof window.ExpressoesFaceAPI.iniciar === "function") {
            window.ExpressoesFaceAPI.iniciar(estado.videoId).catch((erro) => {
                console.warn("Falha ao iniciar ExpressoesFaceAPI:", erro);
            });
        }

        // análise emocional sempre ativa durante exibição de vídeo (sem botão).
        ativarAnaliseEmocional();
    }

    window.BrasflixEmotionAI = {
        ativar: ativarAnaliseEmocional,
        desativar: desativarAnaliseEmocional,
        iniciarEmotionAcompanhamento: async (options = {}) => {
            if (typeof options.onUpdate === "function") {
                estado.onUpdate = options.onUpdate;
            }

            if (options.videoElement) {
                estado.videoElement = options.videoElement;
            }

            await ativarAnaliseEmocional();

            return {
                estado
            };
        },
        estado
    };

    window.EmotionAI = window.BrasflixEmotionAI;

    inicializarEventos();
    inicializarEstadoInicial();
})();
