 (function () {
  const MODEL_PATHS = ["/models", "./models", "models"];
  const statusId = "emotionStatus";

  let modelsReady = false;
  let stream = null;
  let videoElement = null;
  let observerInterval = null;
  let modelsPathResolved = "";

  async function detectModelPath() {
    if (modelsPathResolved) return modelsPathResolved;

    for (const path of MODEL_PATHS) {
      try {
        const response = await fetch(
          `${path.replace(/\/$/, "")}/tiny_face_detector_model-weights_manifest.json`,
          { cache: "no-store" }
        );

        if (response.ok) {
          modelsPathResolved = path.replace(/\/$/, "");
          return modelsPathResolved;
        }
      } catch {}
    }

    throw new Error("Modelos faciais não encontrados em /models.");
  }

  async function carregarModelosExpressoes() {
    if (modelsReady) return;

    const status = document.getElementById(statusId);
    if (status) status.textContent = "Carregando modelos de expressão facial...";

    const CDN_PATH = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights";

    async function carregarEm(caminho) {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(caminho),
        faceapi.nets.faceLandmark68Net.loadFromUri(caminho),
        faceapi.nets.faceExpressionNet.loadFromUri(caminho)
      ]);
    }

    try {
      const localPath = await detectModelPath();
      await carregarEm(localPath);
      if (status) status.textContent = `Modelos carregados de ${localPath}.`;
    } catch (erroModelosLocais) {
      console.warn("Falha ao carregar modelos locais, tentando CDN:", erroModelosLocais);

      try {
        await carregarEm(CDN_PATH);
        if (status) status.textContent = "Modelos carregados de CDN.";
      } catch (erroCDN) {
        console.error("Falha ao carregar modelos de CDN:", erroCDN);
        if (status) status.textContent = "Falha ao carregar modelos de expressão facial.";
        throw erroCDN;
      }
    }

    modelsReady = true;
    if (status) status.textContent = "Modelos de expressão carregados.";
  }

  async function iniciarCapturaExpressao(videoId = "") {
    if (!modelsReady) {
      await carregarModelosExpressoes();
    }

    if (stream) return;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      videoElement = document.createElement("video");
      videoElement.autoplay = true;
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.srcObject = stream;

      await videoElement.play();

      if (observerInterval) clearInterval(observerInterval);

      observerInterval = setInterval(async () => {
        if (!videoElement || videoElement.readyState < 2) return;

        const detections = await faceapi
          .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        if (!detections || !detections.expressions) {
          setStatus("Não foi possível detectar expressão facial.");
          return;
        }

        const topEmotion = Object.entries(detections.expressions).sort((a, b) => b[1] - a[1])[0];
        const nome = topEmotion[0];
        const valor = topEmotion[1];

        setStatus(`Expressão detectada: ${nome} (${(valor * 100).toFixed(0)}%)`);

        if (window.BrasflixEmotionAI && window.BrasflixEmotionAI.onNewEmotion) {
          window.BrasflixEmotionAI.onNewEmotion({ emotion: nome, confidence: valor, videoId });
        }
      }, 2500);
    } catch (error) {
      console.error("Erro em iniciar captura de expressão:", error);
      setStatus("Falha ao iniciar câmera para expressões faciais.");
    }
  }

  function setStatus(texto) {
    const status = document.getElementById(statusId);
    if (status) status.textContent = texto;
  }

  function pararCapturaExpressao() {
    if (observerInterval) {
      clearInterval(observerInterval);
      observerInterval = null;
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    if (videoElement) {
      videoElement.pause();
      videoElement.srcObject = null;
      videoElement = null;
    }

    setStatus("Captura de expressão facial parada.");
  }

  window.ExpressoesFaceAPI = {
    iniciar: iniciarCapturaExpressao,
    parar: pararCapturaExpressao,
    carregarModelos: carregarModelosExpressoes,
    estaPronto: () => modelsReady
  };
})();
