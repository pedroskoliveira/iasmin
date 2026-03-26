import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_UPLOAD_PRESET_IMAGE =
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_IMAGE ||
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ||
  "";
const CLOUDINARY_UPLOAD_PRESET_VIDEO =
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_VIDEO ||
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ||
  "";

const state = {
  currentUser: null,
  currentUserData: null,
  editingId: null,
  videos: []
};

function qs(selectors = []) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

const els = {
  form: qs([
    "#formVideo",
    "#videoForm",
    "#formCadastrarVideo",
    "#form-video-admin",
    "form[data-admin-video-form]"
  ]),
  titulo: qs([
    "#tituloVideo",
    "#videoTitulo",
    "#titulo",
    "input[name='titulo']"
  ]),
  descricao: qs([
    "#descricaoVideo",
    "#videoDescricao",
    "#descricao",
    "textarea[name='descricao']"
  ]),
  categoria: qs([
    "#categoriaVideo",
    "#videoCategoria",
    "#categoria",
    "select[name='categoria']",
    "input[name='categoria']"
  ]),
  autor: qs([
    "#autorVideo",
    "#videoAutor",
    "#autor",
    "input[name='autor']"
  ]),
  thumbnailUrl: qs([
    "#thumbnailUrl",
    "#videoThumbnail",
    "#capaUrl",
    "input[name='thumbnailUrl']"
  ]),
  videoUrl: qs([
    "#videoUrl",
    "#urlVideo",
    "input[name='videoUrl']"
  ]),
  thumbnailFile: qs([
    "#thumbnailFile",
    "#thumbnailVideo",
    "#thumbFile",
    "#uploadThumbnail",
    "input[name='thumbnailFile']"
  ]),
  videoFile: qs([
    "#videoFile",
    "#arquivoVideo",
    "#uploadVideo",
    "input[name='videoFile']"
  ]),
  destaque: qs([
    "#videoDestaque",
    "#destaqueVideo",
    "#destaque",
    "input[name='destaque']"
  ]),
  lancamento: qs([
    "#videoLancamento",
    "#lancamentoVideo",
    "#lancamento",
    "input[name='lancamento']"
  ]),
  emAlta: qs([
    "#videoEmAlta",
    "#emAltaVideo",
    "#emAlta",
    "input[name='emAlta']"
  ]),
  topSemanal: qs([
    "#videoTopSemanal",
    "#topSemanalVideo",
    "#topSemanal",
    "input[name='topSemanal']"
  ]),
  ordem: qs([
    "#videoOrdem",
    "#ordemVideo",
    "#ordem",
    "input[name='ordem']"
  ]),
  duracao: qs([
    "#videoDuracao",
    "#duracaoVideo",
    "#duracao",
    "input[name='duracao']"
  ]),
  tags: qs([
    "#videoTags",
    "#tagsVideo",
    "#tags",
    "input[name='tags']"
  ]),
  btnSubmit: qs([
    "#btnSalvarVideo",
    "#btnCadastrarVideo",
    "button[type='submit']"
  ]),
  btnReset: qs([
    "#btnLimparVideo",
    "#btnCancelarEdicaoVideo",
    "button[type='reset']"
  ]),
  lista: qs([
    "#listaVideosAdmin",
    "#adminVideosLista",
    "#videosAdminLista",
    "[data-admin-videos-list]"
  ]),
  status: qs([
    "#adminVideosStatus",
    "#videoAdminStatus",
    "[data-admin-videos-status]"
  ]),
  previewThumb: qs([
    "#previewThumbnailAdmin",
    "#previewThumbnail",
    "#thumbnailPreview",
    "[data-video-thumbnail-preview]"
  ]),
  previewVideo: qs([
    "#previewArquivoVideoAdmin",
    "#previewVideo",
    "#videoPreview",
    "[data-video-preview]"
  ]),
  contador: document.getElementById("contadorVideosAdmin"),
  vazio: document.getElementById("estadoVazioVideosAdmin")
};

function setStatus(message, isError = false) {
  if (!els.status) {
    console[isError ? "error" : "log"]("[admin-videos]", message);
    return;
  }

  els.status.textContent = message;
  els.status.style.color = isError ? "#ffb2b2" : "#f3f3f3";
  els.status.style.borderColor = isError ? "#7a1d1d" : "#2f2f2f";
  els.status.style.background = isError ? "rgba(120,20,20,.18)" : "rgba(255,255,255,.03)";
}

function alertar(message) {
  window.alert(message);
}

function limparTexto(value) {
  return typeof value === "string" ? value.trim() : "";
}

function limparNumero(value, fallback = 0) {
  if (value === "" || value === null || typeof value === "undefined") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function splitTags(value) {
  return limparTexto(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugify(text = "") {
  return limparTexto(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function toBool(value) {
  return Boolean(value);
}

function isCloudinaryConfiguredForImage() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET_IMAGE);
}

function isCloudinaryConfiguredForVideo() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET_VIDEO);
}

function getFile(el) {
  return el?.files?.[0] || null;
}

function resetPreviews() {
  if (els.previewThumb) {
    els.previewThumb.innerHTML = `<span class="admin-preview-vazio">A prévia da thumbnail aparecerá aqui.</span>`;
  }

  if (els.previewVideo) {
    els.previewVideo.innerHTML = `<span class="admin-preview-vazio">A prévia do vídeo aparecerá aqui.</span>`;
  }
}

function renderThumbPreview(url = "") {
  if (!els.previewThumb) return;
  const safe = limparTexto(url);
  if (!safe) {
    resetPreviews();
    return;
  }

  els.previewThumb.innerHTML = `<img src="${safe}" alt="Prévia da thumbnail" style="max-width:220px;border-radius:12px;display:block;">`;
}

function renderVideoPreview(url = "") {
  if (!els.previewVideo) return;
  const safe = limparTexto(url);
  if (!safe) {
    els.previewVideo.innerHTML = `<span class="admin-preview-vazio">A prévia do vídeo aparecerá aqui.</span>`;
    return;
  }

  els.previewVideo.innerHTML = `
    <video controls style="max-width:260px;border-radius:12px;display:block;">
      <source src="${safe}">
      Seu navegador não suporta vídeo.
    </video>
  `;
}

function bindPreviewEvents() {
  els.thumbnailUrl?.addEventListener("input", () => {
    renderThumbPreview(els.thumbnailUrl.value);
  });

  els.videoUrl?.addEventListener("input", () => {
    renderVideoPreview(els.videoUrl.value);
  });

  els.thumbnailFile?.addEventListener("change", () => {
    const file = getFile(els.thumbnailFile);
    if (!file || !els.previewThumb) return;

    const reader = new FileReader();
    reader.onload = () => renderThumbPreview(reader.result || "");
    reader.readAsDataURL(file);
  });

  els.videoFile?.addEventListener("change", () => {
    const file = getFile(els.videoFile);
    if (!file || !els.previewVideo) return;

    const objectUrl = URL.createObjectURL(file);
    renderVideoPreview(objectUrl);
  });
}

async function uploadToCloudinary(file, resourceType = "image") {
  if (!file) {
    return {
      url: "",
      secureUrl: "",
      publicId: ""
    };
  }

  const isImage = resourceType === "image";
  const preset = isImage ? CLOUDINARY_UPLOAD_PRESET_IMAGE : CLOUDINARY_UPLOAD_PRESET_VIDEO;

  if (!CLOUDINARY_CLOUD_NAME || !preset) {
    throw new Error(
      isImage
        ? "Cloudinary de imagem não configurado."
        : "Cloudinary de vídeo não configurado."
    );
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", preset);
  formData.append("folder", isImage ? "brasflix/thumbnails" : "brasflix/videos");

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `Erro ao enviar ${isImage ? "imagem" : "vídeo"}.`);
  }

  return {
    url: limparTexto(data?.url || data?.secure_url || ""),
    secureUrl: limparTexto(data?.secure_url || data?.url || ""),
    publicId: limparTexto(data?.public_id || "")
  };
}

function montarPayloadVideo(base = {}) {
  const titulo = limparTexto(base.titulo);
  const categoria = limparTexto(base.categoria);
  const thumbnailUrl = limparTexto(base.thumbnailUrl);
  const thumbnailSecureUrl = limparTexto(base.thumbnailSecureUrl) || thumbnailUrl || "";
  const videoUrl = limparTexto(base.videoUrl);
  const videoSecureUrl = limparTexto(base.videoSecureUrl) || videoUrl || "";
  const idGerado = limparTexto(base.id) || slugify(`${titulo}-${categoria}`) || `video-${Date.now()}`;

  return {
    id: idGerado,
    titulo,
    descricao: limparTexto(base.descricao),
    categoria,
    autor: limparTexto(base.autor),
    thumbnailUrl,
    thumbnailSecureUrl,
    thumbnail: thumbnailSecureUrl || thumbnailUrl || "",
    thumbnailPublicId: limparTexto(base.thumbnailPublicId),
    videoUrl,
    videoSecureUrl,
    urlVideo: videoSecureUrl || videoUrl || "",
    src: videoSecureUrl || videoUrl || "",
    previewUrl: videoSecureUrl || videoUrl || "",
    videoPublicId: limparTexto(base.videoPublicId),
    destaque: toBool(base.destaque),
    lancamento: toBool(base.lancamento),
    emAlta: toBool(base.emAlta),
    topSemanal: toBool(base.topSemanal),
    topVideos: toBool(base.destaque) || toBool(base.topSemanal),
    ordem: limparNumero(base.ordem, 0),
    duracao: limparTexto(base.duracao),
    tags: Array.isArray(base.tags) ? base.tags.filter(Boolean) : [],
    ativo: typeof base.ativo === "boolean" ? base.ativo : true,
    views: limparNumero(base.views, 0),
    likes: limparNumero(base.likes, 0),
    favoritos: limparNumero(base.favoritos, 0),
    atualizadoEm: serverTimestamp()
  };
}

async function ensureAdmin(user) {
  const snap = await getDoc(doc(db, "usuarios", user.uid));
  const data = snap.exists() ? snap.data() || {} : {};

  if (data.role !== "admin") {
    window.location.href = "../index.html";
    return null;
  }

  return data;
}

function getFormValues() {
  return {
    titulo: els.titulo?.value || "",
    descricao: els.descricao?.value || "",
    categoria: els.categoria?.value || "",
    autor: els.autor?.value || "",
    thumbnailUrl: els.thumbnailUrl?.value || "",
    videoUrl: els.videoUrl?.value || "",
    destaque: els.destaque?.checked || false,
    lancamento: els.lancamento?.checked || false,
    emAlta: els.emAlta?.checked || false,
    topSemanal: els.topSemanal?.checked || false,
    ordem: els.ordem?.value || 0,
    duracao: els.duracao?.value || "",
    tags: splitTags(els.tags?.value || "")
  };
}

function validatePayload(payload) {
  if (!payload.titulo) throw new Error("Informe o título do vídeo.");
  if (!payload.descricao) throw new Error("Informe a descrição.");
  if (!payload.categoria) throw new Error("Informe a categoria.");

  if (!payload.thumbnailUrl && !payload.thumbnailSecureUrl) {
    throw new Error("Envie a thumbnail do vídeo.");
  }

  if (!payload.videoUrl && !payload.videoSecureUrl) {
    throw new Error("Envie o arquivo de vídeo.");
  }
}

function limparFormulario() {
  state.editingId = null;
  els.form?.reset?.();
  resetPreviews();
  setStatus("Formulário limpo.");
  if (els.btnSubmit) {
    els.btnSubmit.textContent = "Salvar vídeo";
    els.btnSubmit.disabled = false;
  }
}

function preencherFormulario(video) {
  state.editingId = video.id;

  if (els.titulo) els.titulo.value = video.titulo || "";
  if (els.descricao) els.descricao.value = video.descricao || "";
  if (els.categoria) els.categoria.value = video.categoria || "";
  if (els.autor) els.autor.value = video.autor || "";
  if (els.thumbnailUrl) els.thumbnailUrl.value = video.thumbnailSecureUrl || video.thumbnailUrl || "";
  if (els.videoUrl) els.videoUrl.value = video.videoSecureUrl || video.videoUrl || "";
  if (els.destaque) els.destaque.checked = !!video.destaque;
  if (els.lancamento) els.lancamento.checked = !!video.lancamento;
  if (els.emAlta) els.emAlta.checked = !!video.emAlta;
  if (els.topSemanal) els.topSemanal.checked = !!video.topSemanal;
  if (els.ordem) els.ordem.value = video.ordem ?? 0;
  if (els.duracao) els.duracao.value = video.duracao ?? "";
  if (els.tags) els.tags.value = Array.isArray(video.tags) ? video.tags.join(", ") : "";

  renderThumbPreview(video.thumbnailSecureUrl || video.thumbnailUrl || "");
  renderVideoPreview(video.videoSecureUrl || video.videoUrl || "");

  if (els.btnSubmit) {
    els.btnSubmit.textContent = "Atualizar vídeo";
  }

  setStatus(`Editando: ${video.titulo}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function excluirVideo(id, titulo = "") {
  const ok = window.confirm(`Deseja excluir o vídeo "${titulo || "sem título"}"?`);
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "videos", id));
    setStatus("Vídeo excluído com sucesso.");
    await carregarVideos();
  } catch (error) {
    console.error("[admin-videos] Erro ao excluir:", error);
    setStatus(error.message || "Erro ao excluir vídeo.", true);
    alertar(error.message || "Erro ao excluir vídeo.");
  }
}

function atualizarResumoLista() {
  if (els.contador) {
    els.contador.textContent = `${state.videos.length} vídeo(s)`;
  }

  if (els.vazio) {
    els.vazio.style.display = state.videos.length ? "none" : "flex";
  }
}

function renderLista(videos = []) {
  if (!els.lista) return;

  atualizarResumoLista();

  if (!videos.length) {
    els.lista.innerHTML = "";
    return;
  }

  els.lista.innerHTML = videos.map((video) => {
    const thumb = video.thumbnailSecureUrl || video.thumbnailUrl || "";
    const safeTitle = video.titulo || "Sem título";

    return `
      <div class="admin-video-card" data-id="${video.id}" style="border:1px solid #232323;border-radius:18px;padding:16px;background:#0f0f0f;margin-bottom:14px;">
        <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;">
          <div style="width:180px;max-width:100%;">
            ${thumb ? `<img src="${thumb}" alt="${safeTitle}" style="width:100%;border-radius:12px;display:block;">` : `<div style="height:100px;border-radius:12px;background:#161616;display:flex;align-items:center;justify-content:center;">Sem thumb</div>`}
          </div>
          <div style="flex:1;min-width:240px;">
            <h3 style="margin:0 0 8px;color:#fff;">${safeTitle}</h3>
            <p style="margin:0 0 8px;color:#cfcfcf;">${video.descricao || ""}</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
              <span style="padding:6px 10px;border-radius:999px;background:#1a1a1a;color:#fff;">${video.categoria || "Sem categoria"}</span>
              <span style="padding:6px 10px;border-radius:999px;background:#1a1a1a;color:#fff;">Duração: ${video.duracao || "—"}</span>
              ${video.destaque ? `<span style="padding:6px 10px;border-radius:999px;background:#2c0f0f;color:#fff;border:1px solid #e50914;">Destaque</span>` : ""}
              ${video.emAlta ? `<span style="padding:6px 10px;border-radius:999px;background:#1b1010;color:#fff;border:1px solid #ff6b6b;">Em alta</span>` : ""}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" data-action="editar" data-id="${video.id}" style="padding:10px 14px;border-radius:12px;border:none;background:#2b2b2b;color:#fff;cursor:pointer;">Editar</button>
              <button type="button" data-action="excluir" data-id="${video.id}" style="padding:10px 14px;border-radius:12px;border:none;background:#6a1212;color:#fff;cursor:pointer;">Excluir</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  qsa("[data-action='editar']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const video = state.videos.find((item) => item.id === id);
      if (video) preencherFormulario(video);
    });
  });

  qsa("[data-action='excluir']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const video = state.videos.find((item) => item.id === id);
      excluirVideo(id, video?.titulo || "");
    });
  });
}

async function carregarVideos() {
  try {
    const snap = await getDocs(query(collection(db, "videos"), orderBy("criadoEm", "desc")));
    state.videos = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    renderLista(state.videos);
  } catch (error) {
    console.error("[admin-videos] Erro ao carregar vídeos:", error);
    setStatus(error.message || "Erro ao carregar vídeos.", true);
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  try {
    if (els.btnSubmit) {
      els.btnSubmit.disabled = true;
      els.btnSubmit.textContent = state.editingId ? "Atualizando..." : "Salvando...";
    }

    setStatus("Preparando envio...");

    const values = getFormValues();
    const thumbFile = getFile(els.thumbnailFile);
    const videoFile = getFile(els.videoFile);

    let thumbnailUpload = {
      url: limparTexto(values.thumbnailUrl),
      secureUrl: limparTexto(values.thumbnailUrl),
      publicId: ""
    };

    let videoUpload = {
      url: limparTexto(values.videoUrl),
      secureUrl: limparTexto(values.videoUrl),
      publicId: ""
    };

    if (thumbFile) {
      if (!isCloudinaryConfiguredForImage()) {
        throw new Error("Cloudinary de imagem não configurado para upload da thumbnail.");
      }
      setStatus("Enviando thumbnail...");
      thumbnailUpload = await uploadToCloudinary(thumbFile, "image");
    }

    if (videoFile) {
      if (!isCloudinaryConfiguredForVideo()) {
        throw new Error("Cloudinary de vídeo não configurado para upload do vídeo.");
      }
      setStatus("Enviando vídeo...");
      videoUpload = await uploadToCloudinary(videoFile, "video");
    }

    const payload = montarPayloadVideo({
      titulo: values.titulo,
      descricao: values.descricao,
      categoria: values.categoria,
      autor: values.autor,
      thumbnailUrl: thumbnailUpload.url || values.thumbnailUrl || "",
      thumbnailSecureUrl: thumbnailUpload.secureUrl || thumbnailUpload.url || values.thumbnailUrl || "",
      thumbnailPublicId: thumbnailUpload.publicId || "",
      videoUrl: videoUpload.url || values.videoUrl || "",
      videoSecureUrl: videoUpload.secureUrl || videoUpload.url || values.videoUrl || "",
      videoPublicId: videoUpload.publicId || "",
      destaque: values.destaque,
      lancamento: values.lancamento,
      emAlta: values.emAlta,
      topSemanal: values.topSemanal,
      ordem: values.ordem,
      duracao: values.duracao,
      tags: values.tags,
      ativo: true
    });

    validatePayload(payload);

    if (state.editingId) {
      await updateDoc(doc(db, "videos", state.editingId), payload);
      setStatus("Vídeo atualizado com sucesso.");
    } else {
      await addDoc(collection(db, "videos"), {
        ...payload,
        criadoEm: serverTimestamp(),
        criadoPor: state.currentUser?.uid || "",
        criadoPorNome: state.currentUserData?.nome || state.currentUser?.email || ""
      });
      setStatus("Vídeo cadastrado com sucesso.");
    }

    limparFormulario();
    await carregarVideos();
  } catch (error) {
    console.error("[admin-videos] Erro ao salvar vídeo:", error);
    setStatus(error.message || "Erro ao salvar vídeo.", true);
    alertar(error.message || "Erro ao salvar vídeo.");
  } finally {
    if (els.btnSubmit) {
      els.btnSubmit.disabled = false;
      els.btnSubmit.textContent = state.editingId ? "Atualizar vídeo" : "Salvar vídeo";
    }
  }
}

function bind() {
  if (!els.form) {
    console.error("[admin-videos] Formulário não encontrado.");
    return;
  }

  els.form.addEventListener("submit", handleSubmit);

  els.btnReset?.addEventListener("click", () => {
    setTimeout(() => limparFormulario(), 0);
  });

  bindPreviewEvents();
  resetPreviews();
}

function init() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "../login.html";
      return;
    }

    state.currentUser = user;

    const adminData = await ensureAdmin(user);
    if (!adminData) return;

    state.currentUserData = adminData;
    bind();
    await carregarVideos();
    setStatus("Área de vídeos pronta.");
  });
}

document.addEventListener("DOMContentLoaded", init);
