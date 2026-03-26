import { auth, db } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPhoneNumber,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  limit,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ids = {
  formCadastro: document.getElementById("form-cadastro"),
  formLogin: document.getElementById("form-login"),
  btnGoogle: document.getElementById("btnGoogle"),
  btnFace: document.getElementById("irParaFace"),
  btnAbrirRecuperar: document.getElementById("abrirRecuperar"),
  recuperarBox: document.getElementById("recuperarBox"),
  btnRecuperarEmail: document.getElementById("btnRecuperarEmail"),
  btnRecuperarTelefone: document.getElementById("btnRecuperarTelefone"),
  btnConfirmarCodigoTelefone: document.getElementById("btnConfirmarCodigoTelefone"),
  inputFotoPerfil: document.getElementById("fotoPerfil"),
  fotoPreview: document.querySelector(".foto-preview"),
  phoneRecoveryStepCodigo: document.getElementById("phoneRecoveryStepCodigo"),
  phoneRecoveryStatus: document.getElementById("phoneRecoveryStatus")
};

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

let recaptchaVerifier = null;
let phoneConfirmationResult = null;
let phoneRecoveryTarget = null;

async function prepararSessao() {
  try {
    await setPersistence(auth, browserSessionPersistence);
  } catch (error) {
    console.error("[Auth] Não foi possível ajustar persistência de sessão:", error);
  }
}

function valor(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function arquivo(id) {
  return document.getElementById(id)?.files?.[0] || null;
}

function alertar(texto) {
  window.alert(texto);
}

function setPhoneRecoveryStatus(texto, isError = false) {
  if (!ids.phoneRecoveryStatus) return;
  ids.phoneRecoveryStatus.textContent = texto;
  ids.phoneRecoveryStatus.style.color = isError ? "#ff7b7b" : "#d7d7d7";
}

function somenteDigitos(valor = "") {
  return String(valor).replace(/\D/g, "");
}

function normalizarTelefoneBR(valorTelefone = "") {
  const digits = somenteDigitos(valorTelefone);

  if (!digits) return "";

  if (digits.startsWith("55") && digits.length >= 12) {
    return `+${digits}`;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }

  return digits.startsWith("+") ? digits : `+${digits}`;
}

function formatarUsernameAPartirNome(nome = "") {
  return String(nome)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
}

function alternarAbas() {
  document.querySelectorAll(".aba-btn").forEach((botao) => {
    botao.addEventListener("click", () => {
      const aba = botao.dataset.aba;
      document.querySelectorAll(".aba-btn").forEach((item) => item.classList.remove("ativo"));
      document.querySelectorAll(".aba-conteudo").forEach((item) => item.classList.remove("ativo"));
      botao.classList.add("ativo");
      document.getElementById(`aba-${aba}`)?.classList.add("ativo");
    });
  });
}

function renderizarPreviewPadrao() {
  if (!ids.fotoPreview) return;
  ids.fotoPreview.classList.remove("tem-imagem");
  ids.fotoPreview.innerHTML = "<span>Adicionar foto</span>";
}

function configurarPreviewFoto() {
  if (!ids.inputFotoPerfil || !ids.fotoPreview) return;

  renderizarPreviewPadrao();

  ids.inputFotoPerfil.addEventListener("change", () => {
    const file = ids.inputFotoPerfil.files?.[0];

    if (!file) {
      renderizarPreviewPadrao();
      return;
    }

    try {
      validarImagem(file, 2);
    } catch (error) {
      alertar(error.message);
      ids.inputFotoPerfil.value = "";
      renderizarPreviewPadrao();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      ids.fotoPreview.classList.add("tem-imagem");
      ids.fotoPreview.innerHTML = `<img src="${reader.result}" alt="Prévia da foto de perfil">`;
    };
    reader.readAsDataURL(file);
  });
}

function validarImagem(file, limiteMB = 2) {
  if (!file) return true;
  const limiteBytes = limiteMB * 1024 * 1024;

  if (!file.type.startsWith("image/")) {
    throw new Error("A foto de perfil precisa ser uma imagem.");
  }

  if (file.size > limiteBytes) {
    throw new Error(`A foto de perfil deve ter no máximo ${limiteMB} MB.`);
  }

  return true;
}

async function uploadImagemCloudinary(file, pasta = "brasflix/avatars") {
  if (!file) return { url: "", publicId: "" };

  validarImagem(file, 2);

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error("Cloudinary não configurado. Verifique as variáveis na Vercel.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", pasta);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Erro ao enviar imagem.");
  }

  return {
    url: data.secure_url || "",
    publicId: data.public_id || ""
  };
}

async function garantirDocumentoUsuario(usuario, dados = {}) {
  const userRef = doc(db, "usuarios", usuario.uid);
  const snap = await getDoc(userRef);
  const existente = snap.exists() ? snap.data() || {} : {};

  const telefoneE164 = dados.telefoneE164 || existente.telefoneE164 || normalizarTelefoneBR(dados.telefone || existente.telefone || usuario.phoneNumber || "");

  const base = {
    usuarioId: usuario.uid,
    uid: usuario.uid,
    nome: dados.nome || existente.nome || usuario.displayName || "Usuário",
    email: dados.email || existente.email || usuario.email || "",
    telefone: dados.telefone || existente.telefone || usuario.phoneNumber || "",
    telefoneE164,
    telefoneVerificado: typeof dados.telefoneVerificado === "boolean" ? dados.telefoneVerificado : (existente.telefoneVerificado ?? false),
    cpf: dados.cpf || existente.cpf || "",
    dataNascimento: dados.dataNascimento || existente.dataNascimento || "",
    cep: dados.cep || existente.cep || "",
    endereco: dados.endereco || existente.endereco || "",
    bairro: dados.bairro || existente.bairro || "",
    cidade: dados.cidade || existente.cidade || "",
    estado: dados.estado || existente.estado || "",
    numero: dados.numero || existente.numero || "",
    avatar: dados.avatar || existente.avatar || usuario.photoURL || "",
    avatarPublicId: dados.avatarPublicId || existente.avatarPublicId || "",
    username: dados.username || existente.username || "",
    bio: dados.bio || existente.bio || "",
    seguidores: Array.isArray(existente.seguidores) ? existente.seguidores : [],
    seguindo: Array.isArray(existente.seguindo) ? existente.seguindo : [],
    categoriasFavoritas: Array.isArray(dados.categoriasFavoritas)
      ? dados.categoriasFavoritas
      : (Array.isArray(existente.categoriasFavoritas) ? existente.categoriasFavoritas : []),
    mostrarPerfilPublico: typeof dados.mostrarPerfilPublico === "boolean" ? dados.mostrarPerfilPublico : (existente.mostrarPerfilPublico ?? true),
    tipoLogin: dados.tipoLogin || existente.tipoLogin || "email",
    role: existente.role || "user",
    perfilCompleto: typeof dados.perfilCompleto === "boolean" ? dados.perfilCompleto : (existente.perfilCompleto ?? false),
    onboardingStatus: dados.onboardingStatus || existente.onboardingStatus || "pending_face",
    faceLoginEnabled: existente.faceLoginEnabled ?? false,
    atualizadoEm: serverTimestamp()
  };

  if (!snap.exists()) {
    await setDoc(userRef, {
      ...base,
      criadoEm: serverTimestamp()
    });
  } else {
    await updateDoc(userRef, base);
  }

  await setDoc(
    doc(db, "usuarios_publicos", usuario.uid),
    {
      uid: usuario.uid,
      nome: base.nome,
      username: base.username || "",
      bio: base.bio || "",
      avatar: base.avatar,
      categoriasFavoritas: base.categoriasFavoritas || [],
      mostrarPerfilPublico: base.mostrarPerfilPublico ?? true,
      atualizadoEm: serverTimestamp()
    },
    { merge: true }
  );
}

function senhaForte(senha = "") {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(senha);
}

async function cadastrarComEmail(event) {
  event.preventDefault();

  const nome = valor("nome-completo");
  const email = valor("cadastro-email");
  const senha = valor("senha-cadastro");
  const confirmar = valor("confirmar-senha");
  const telefone = valor("telefone");
  const telefoneE164 = normalizarTelefoneBR(telefone);

  if (!nome || !email || !senha) {
    return alertar("Preencha nome, e-mail e senha.");
  }

  if (!senhaForte(senha)) {
    return alertar("A senha deve ter 8+ caracteres, com maiúscula, minúscula, número e caractere especial.");
  }

  if (senha !== confirmar) {
    return alertar("As senhas não coincidem.");
  }

  try {
    await prepararSessao();
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    const usuario = cred.user;

    const avatarUpload = await uploadImagemCloudinary(arquivo("fotoPerfil"), "brasflix/avatars");

    await garantirDocumentoUsuario(usuario, {
      nome,
      email,
      telefone,
      telefoneE164,
      telefoneVerificado: false,
      username: valor("username") || formatarUsernameAPartirNome(nome),
      bio: valor("bio"),
      categoriasFavoritas: valor("categorias-favoritas").split(",").map((item) => item.trim()).filter(Boolean),
      cpf: valor("cpf"),
      dataNascimento: valor("data-nascimento"),
      cep: valor("cep"),
      endereco: valor("endereco"),
      bairro: valor("bairro"),
      cidade: valor("cidade"),
      estado: valor("estado"),
      numero: valor("numero"),
      avatar: avatarUpload.url,
      avatarPublicId: avatarUpload.publicId,
      tipoLogin: "email",
      perfilCompleto: true,
      onboardingStatus: "pending_face"
    });

    window.location.href = "face.html?mode=enroll";
  } catch (error) {
    console.error("[Auth] Erro no cadastro:", error);
    alertar(`Erro no cadastro: ${error.message}`);
  }
}

async function loginComEmail(event) {
  event.preventDefault();

  const email = valor("login-email");
  const senha = valor("login-senha");

  if (!email || !senha) {
    return alertar("Preencha e-mail e senha.");
  }

  try {
    await prepararSessao();
    const cred = await signInWithEmailAndPassword(auth, email, senha);
    await redirecionarPorEstado(cred.user);
  } catch (error) {
    console.error("[Auth] Erro no login:", error);
    alertar(`Erro no login: ${error.message}`);
  }
}

async function loginGoogle() {
  try {
    await prepararSessao();
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const userRef = doc(db, "usuarios", cred.user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await garantirDocumentoUsuario(cred.user, {
        tipoLogin: "google",
        perfilCompleto: true,
        onboardingStatus: "pending_face",
        nome: cred.user.displayName || "Usuário Google",
        email: cred.user.email || "",
        avatar: cred.user.photoURL || ""
      });
    } else {
      await garantirDocumentoUsuario(cred.user, {
        tipoLogin: "google"
      });
    }

    await redirecionarPorEstado(cred.user);
  } catch (error) {
    console.error("[Auth] Erro no Google Login:", error);
    alertar(`Erro ao entrar com Google: ${error.message}`);
  }
}

async function recuperarPorEmail() {
  const email = valor("rec-email") || valor("login-email") || valor("cadastro-email");

  if (!email) {
    return alertar("Informe um e-mail para recuperação.");
  }

  try {
    await sendPasswordResetEmail(auth, email);
    alertar("E-mail de recuperação enviado com sucesso.");
  } catch (error) {
    console.error("[Auth] Erro na recuperação por e-mail:", error);
    alertar(`Erro na recuperação: ${error.message}`);
  }
}

function getRecaptcha() {
  if (recaptchaVerifier) return recaptchaVerifier;

  recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
    size: "normal"
  });

  return recaptchaVerifier;
}

async function buscarUsuarioPorTelefone(telefoneE164) {
  const snap = await getDocs(
    query(collection(db, "usuarios"), where("telefoneE164", "==", telefoneE164), limit(1))
  );

  if (snap.empty) return null;

  return {
    id: snap.docs[0].id,
    ...snap.docs[0].data()
  };
}

async function recuperarPorTelefone() {
  const telefone = valor("rec-telefone");

  if (!telefone) {
    return alertar("Informe o telefone cadastrado.");
  }

  const telefoneE164 = normalizarTelefoneBR(telefone);

  try {
    setPhoneRecoveryStatus("Validando telefone...");
    phoneRecoveryTarget = await buscarUsuarioPorTelefone(telefoneE164);

    if (!phoneRecoveryTarget) {
      throw new Error("Nenhuma conta encontrada com esse telefone.");
    }

    await prepararSessao();

    const verifier = getRecaptcha();
    phoneConfirmationResult = await signInWithPhoneNumber(auth, telefoneE164, verifier);

    if (ids.phoneRecoveryStepCodigo) {
      ids.phoneRecoveryStepCodigo.style.display = "block";
    }

    setPhoneRecoveryStatus("Código SMS enviado. Digite o código recebido.");
  } catch (error) {
    console.error("[Auth] Erro na recuperação por telefone:", error);
    setPhoneRecoveryStatus(error.message || "Falha ao enviar SMS.", true);
    alertar(`Erro no SMS: ${error.message}`);
  }
}

async function confirmarCodigoTelefone() {
  const codigo = valor("rec-codigo");

  if (!phoneConfirmationResult) {
    return alertar("Primeiro envie o código SMS.");
  }

  if (!codigo) {
    return alertar("Digite o código recebido por SMS.");
  }

  const novaSenha = window.prompt(
    "Digite a nova senha.\nEla deve ter 8+ caracteres, com maiúscula, minúscula, número e caractere especial."
  );

  if (!novaSenha) return;

  if (!senhaForte(novaSenha)) {
    return alertar("A nova senha não atende aos critérios de segurança.");
  }

  try {
    setPhoneRecoveryStatus("Validando código...");
    const cred = await phoneConfirmationResult.confirm(codigo);
    const phoneUser = cred.user;
    const phoneIdToken = await phoneUser.getIdToken(true);

    const response = await fetch("/api/reset-password-sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        phoneIdToken,
        newPassword: novaSenha
      })
    });

    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "Falha ao redefinir senha via SMS.");
    }

    setPhoneRecoveryStatus("Senha redefinida com sucesso. Agora faça login normalmente.");
    await signOut(auth);
    phoneConfirmationResult = null;
    phoneRecoveryTarget = null;

    if (ids.phoneRecoveryStepCodigo) {
      ids.phoneRecoveryStepCodigo.style.display = "none";
    }

    alertar("Senha redefinida com sucesso por SMS.");
  } catch (error) {
    console.error("[Auth] Erro ao confirmar código SMS:", error);
    setPhoneRecoveryStatus(error.message || "Falha ao confirmar código.", true);
    alertar(`Erro na confirmação do SMS: ${error.message}`);
  }
}

async function redirecionarPorEstado(usuario) {
  const snap = await getDoc(doc(db, "usuarios", usuario.uid));
  const dados = snap.exists() ? snap.data() || {} : {};

  if (dados.role === "admin") {
    window.location.href = "admin/dashboard.html";
    return;
  }

  if (!dados.faceLoginEnabled || dados.onboardingStatus === "pending_face") {
    window.location.href = "face.html?mode=enroll";
    return;
  }

  window.location.href = "index.html";
}

function bindEventos() {
  alternarAbas();
  configurarPreviewFoto();

  ids.formCadastro?.addEventListener("submit", cadastrarComEmail);
  ids.formLogin?.addEventListener("submit", loginComEmail);
  ids.btnGoogle?.addEventListener("click", loginGoogle);
  ids.btnFace?.addEventListener("click", () => {
    window.location.href = "face.html?mode=login";
  });
  ids.btnAbrirRecuperar?.addEventListener("click", () => ids.recuperarBox?.classList.toggle("ativo"));
  ids.btnRecuperarEmail?.addEventListener("click", recuperarPorEmail);
  ids.btnRecuperarTelefone?.addEventListener("click", recuperarPorTelefone);
  ids.btnConfirmarCodigoTelefone?.addEventListener("click", confirmarCodigoTelefone);

  if (ids.phoneRecoveryStepCodigo) {
    ids.phoneRecoveryStepCodigo.style.display = "none";
  }
}

onAuthStateChanged(auth, async (usuario) => {
  if (!usuario || !window.location.pathname.toLowerCase().includes("login")) {
    return;
  }

  const snap = await getDoc(doc(db, "usuarios", usuario.uid));
  const dados = snap.exists() ? snap.data() || {} : {};

  if (dados.role === "admin" || dados.faceLoginEnabled) {
    await redirecionarPorEstado(usuario);
  }
});

document.addEventListener("DOMContentLoaded", bindEventos);
