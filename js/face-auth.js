import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signInWithCustomToken
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const video = document.getElementById("videoFace");
const canvas = document.getElementById("canvasFace");
const statusEl = document.getElementById("statusFace");
const btnIniciarCamera = document.getElementById("btnIniciarCamera");
const btnCadastrarFace = document.getElementById("btnCadastrarFace");
const btnEntrarFace = document.getElementById("btnEntrarFace");
const aceitarTermos =
  document.getElementById("aceitarTermosFace") ||
  document.getElementById("aceitoTermosFace");
const termosWrap = document.getElementById("termosFaceWrap");

const FACE_MODE = (new URLSearchParams(window.location.search).get("mode") || "").toLowerCase();
const MODEL_CANDIDATES = ["/models", "./models", "models"];
const FACE_API_CANDIDATES = [
  "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js",
  "https://unpkg.com/face-api.js@0.22.2/dist/face-api.min.js"
];

let stream = null;
let modelosCarregados = false;
let usuarioAtual = null;
let resolvedModelsPath = "";

function status(texto) {
  if (statusEl) statusEl.textContent = texto;
}

async function safeJson(response) {
  const raw = await response.text();

  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {
      ok: false,
      error: raw || "Resposta inválida do servidor."
    };
  }
}

async function loadFaceApiScriptIfNeeded() {
  if (window.faceapi) return true;

  for (const src of FACE_API_CANDIDATES) {
    try {
      await new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-face-api="${src}"]`);
        if (existing) {
          const timeout = setTimeout(() => reject(new Error("face-api.js não carregou a tempo.")), 20000);

          const check = () => {
            if (window.faceapi) {
              clearTimeout(timeout);
              resolve(true);
              return;
            }
            requestAnimationFrame(check);
          };
          check();
          return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.defer = true;
        script.dataset.faceApi = src;

        const timeout = setTimeout(() => reject(new Error("face-api.js não carregou a tempo.")), 20000);

        script.onload = () => {
          const check = () => {
            if (window.faceapi) {
              clearTimeout(timeout);
              resolve(true);
              return;
            }
            requestAnimationFrame(check);
          };
          check();
        };

        script.onerror = () => {
          clearTimeout(timeout);
          reject(new Error(`Falha ao carregar ${src}`));
        };

        document.head.appendChild(script);
      });

      if (window.faceapi) return true;
    } catch (error) {
      console.warn("[FACE] Falha ao carregar script:", error.message);
    }
  }

  throw new Error("face-api.js não foi carregada a tempo.");
}

async function aguardarFaceApi() {
  if (window.faceapi) return window.faceapi;
  await loadFaceApiScriptIfNeeded();
  if (!window.faceapi) {
    throw new Error("face-api.js não foi carregada a tempo.");
  }
  return window.faceapi;
}

async function manifestExiste(basePath) {
  const normalizedBase = String(basePath || "").replace(/\/$/, "");
  const manifestUrl = `${normalizedBase}/tiny_face_detector_model-weights_manifest.json`;

  try {
    const response = await fetch(manifestUrl, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

async function descobrirPastaModelos() {
  if (resolvedModelsPath) return resolvedModelsPath;

  for (const candidate of MODEL_CANDIDATES) {
    if (await manifestExiste(candidate)) {
      resolvedModelsPath = candidate.replace(/\/$/, "");
      return resolvedModelsPath;
    }
  }

  throw new Error("A pasta de modelos faciais não foi encontrada em /models.");
}

function atualizarVisibilidade() {
  const streamAtivo = !!stream;
  const modoCadastro = FACE_MODE === "enroll";
  const modoLogin = FACE_MODE === "login";

  if (btnEntrarFace) {
    const podeExibir = streamAtivo && (modoLogin || !modoCadastro);
    btnEntrarFace.style.display = podeExibir ? "inline-flex" : "none";
  }

  if (termosWrap) {
    termosWrap.style.display = usuarioAtual && streamAtivo && !modoLogin ? "block" : "none";
  }

  if (btnCadastrarFace) {
    const podeCadastrar =
      !!usuarioAtual &&
      streamAtivo &&
      !modoLogin &&
      (!aceitarTermos || aceitarTermos.checked);

    btnCadastrarFace.style.display = podeCadastrar ? "inline-flex" : "none";
  }

  if (btnIniciarCamera) {
    btnIniciarCamera.textContent = streamAtivo ? "Reiniciar câmera" : "Iniciar câmera";
  }
}

async function carregarModelos() {
  if (modelosCarregados) return;

  const faceapi = await aguardarFaceApi();
  const modelsPath = await descobrirPastaModelos();

  status(`Carregando modelos faciais de ${modelsPath}...`);

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(modelsPath),
    faceapi.nets.faceLandmark68Net.loadFromUri(modelsPath),
    faceapi.nets.faceRecognitionNet.loadFromUri(modelsPath)
  ]);

  modelosCarregados = true;
  status("Modelos faciais carregados com sucesso.");
}

async function iniciarCamera() {
  try {
    await aguardarFaceApi();

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Seu navegador não suporta acesso à câmera.");
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });

    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadedmetadata = resolve;
    });

    await video.play();

    status("Câmera iniciada com sucesso.");
    atualizarVisibilidade();
  } catch (error) {
    console.error("[FACE]", error);
    status(error.message || "Erro ao iniciar câmera.");
    atualizarVisibilidade();
  }
}

async function capturar() {
  const faceapi = await aguardarFaceApi();

  if (!stream) {
    throw new Error("Inicie a câmera antes de capturar o rosto.");
  }

  if (video.readyState < 2) {
    throw new Error("A câmera ainda não está pronta.");
  }

  await carregarModelos();

  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    throw new Error("Nenhum rosto detectado. Ajuste a câmera e tente novamente.");
  }

  if (canvas) {
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const resized = faceapi.resizeResults(detection, {
      width: canvas.width,
      height: canvas.height
    });

    faceapi.draw.drawDetections(canvas, resized);
    faceapi.draw.drawFaceLandmarks(canvas, resized);
  }

  return detection;
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
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      },
      { merge: true }
    );
  } else {
    await updateDoc(ref, {
      atualizadoEm: serverTimestamp()
    });
  }
}

async function cadastrarFace() {
  try {
    if (!usuarioAtual) return status("Faça login antes de cadastrar o rosto.");
    if (aceitarTermos && !aceitarTermos.checked) return status("Marque o aceite dos termos para cadastrar o rosto.");

    status("Capturando rosto para cadastro...");
    const det = await capturar();

    await garantirDocumentoUsuario(usuarioAtual.uid, usuarioAtual.email || "");
    const token = await usuarioAtual.getIdToken();

    const response = await fetch("/api/face-enroll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        descriptor: Array.from(det.descriptor)
      })
    });

    const data = await safeJson(response);

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "Erro ao cadastrar rosto.");
    }

    await updateDoc(doc(db, "usuarios", usuarioAtual.uid), {
      aceitaTermosFace: true,
      faceLoginEnabled: true,
      faceRegisteredAt: serverTimestamp(),
      onboardingStatus: "done",
      atualizadoEm: serverTimestamp()
    });

    status("Rosto cadastrado com sucesso.");
    setTimeout(() => {
      location.href = "index.html";
    }, 1200);
  } catch (error) {
    console.error("[FACE]", error);
    status(error.message || "Erro no cadastro facial.");
  }
}

async function entrarComFace() {
  try {
    status("Capturando rosto para login...");
    const det = await capturar();

    const response = await fetch("/api/face-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        descriptor: Array.from(det.descriptor)
      })
    });

    const data = await safeJson(response);

    if (!response.ok || !data?.ok || !data.customToken) {
      throw new Error(data?.error || "Rosto não reconhecido.");
    }

    await signInWithCustomToken(auth, data.customToken);
    status("Login facial realizado com sucesso.");

    setTimeout(() => {
      location.href = "index.html";
    }, 1000);
  } catch (error) {
    console.error("[FACE]", error);
    status(error.message || "Erro no login facial.");
  }
}

onAuthStateChanged(auth, (user) => {
  usuarioAtual = user || null;
  atualizarVisibilidade();
});

btnIniciarCamera?.addEventListener("click", iniciarCamera);
btnCadastrarFace?.addEventListener("click", cadastrarFace);
btnEntrarFace?.addEventListener("click", entrarComFace);
aceitarTermos?.addEventListener("change", atualizarVisibilidade);

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await aguardarFaceApi();
    await descobrirPastaModelos();
    status(`Sistema facial pronto. Pasta detectada: ${resolvedModelsPath}`);
  } catch (error) {
    console.error("[FACE]", error);
    status(error.message || "Falha ao preparar login facial.");
  }

  atualizarVisibilidade();
});
