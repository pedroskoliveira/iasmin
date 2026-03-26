const Gestos = {
  elementos: {},
  stream: null,
  ativo: false,
  intervaloStatus: null,

  iniciar() {
    this.mapear();

    if (!this.elementos.widget || !this.elementos.indicador) {
      console.warn("[Gestos] Estrutura principal não encontrada no HTML.");
      return;
    }

    this.bind();
    this.aplicarEstadoInicial();
  },

  mapear() {
    this.elementos = {
      widget: document.getElementById("gestosWidget"),
      indicador: document.getElementById("gestosIndicador"),
      indicadorTexto: document.querySelector("#gestosIndicador .gestos-indicador-texto"),
      minimizar: document.getElementById("gestosMinimizar"),
      ativar: document.getElementById("ativarGestos"),
      desativar: document.getElementById("desativarGestos"),
      abrirTutorial: document.getElementById("abrirTutorialPainel"),
      gestoDetectado: document.getElementById("gestoDetectado"),
      webcam: document.getElementById("webcamGestos"),
      modalTutorial: document.getElementById("modalTutorialGestos"),
      fecharTutorial: document.getElementById("fecharTutorialGestos"),
      fecharOverlay: document.getElementById("fecharTutorialOverlay"),
      tutorialStatus: document.getElementById("tutorialStatusGesto")
    };
  },

  bind() {
    this.elementos.indicador?.addEventListener("click", () => {
      this.elementos.widget?.classList.remove("minimizado");
    });

    this.elementos.minimizar?.addEventListener("click", () => {
      this.elementos.widget?.classList.add("minimizado");
    });

    this.elementos.ativar?.addEventListener("change", async (event) => {
      if (event.target.checked) {
        await this.ativarGestos();
      } else {
        this.desativarGestos();
      }
    });

    this.elementos.desativar?.addEventListener("click", () => {
      this.desativarGestos();
      if (this.elementos.ativar) this.elementos.ativar.checked = false;
    });

    this.elementos.abrirTutorial?.addEventListener("click", () => this.abrirTutorial());
    this.elementos.fecharTutorial?.addEventListener("click", () => this.fecharTutorial());
    this.elementos.fecharOverlay?.addEventListener("click", () => this.fecharTutorial());
  },

  aplicarEstadoInicial() {
    this.definirIndicador("Abrir gestos");
    this.setTexto("O painel de gestos está disponível. Clique em “Abrir gestos” e ative a câmera.");
    this.elementos.widget?.classList.add("minimizado");
    this.elementos.indicador?.classList.remove("oculto");
  },

  definirIndicador(texto) {
    if (this.elementos.indicadorTexto) {
      this.elementos.indicadorTexto.textContent = texto;
    }
  },

  setTexto(texto) {
    if (this.elementos.gestoDetectado) this.elementos.gestoDetectado.textContent = texto;
    if (this.elementos.tutorialStatus) this.elementos.tutorialStatus.textContent = texto;
  },

  async ativarGestos() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Seu navegador não suporta uso da câmera para gestos.");
      }

      this.pararStream();

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      if (this.elementos.webcam) {
        this.elementos.webcam.srcObject = this.stream;
        await this.elementos.webcam.play();
      }

      this.ativo = true;
      this.definirIndicador("Gestos prontos");
      this.setTexto("Gestos ativados. Câmera iniciada com sucesso. Você já pode testar o tutorial e preparar os comandos.");
      this.elementos.indicador?.classList.remove("oculto");
      this.elementos.widget?.classList.remove("minimizado");
      this.iniciarLoopStatus();
    } catch (error) {
      console.error("[Gestos] Erro ao ativar:", error);
      this.ativo = false;
      this.definirIndicador("Abrir gestos");
      this.setTexto(error?.message || "Não foi possível ativar os gestos.");
    }
  },

  iniciarLoopStatus() {
    if (this.intervaloStatus) clearInterval(this.intervaloStatus);

    const mensagens = [
      "Gestos ativos. A câmera está pronta para capturar movimentos.",
      "Painel de gestos ativo. Abra o tutorial para testar a webcam ao vivo.",
      "Gestos ligados. Verifique a posição da mão e a iluminação do ambiente."
    ];

    let indice = 0;
    this.intervaloStatus = window.setInterval(() => {
      if (!this.ativo) return;
      indice = (indice + 1) % mensagens.length;
      this.setTexto(mensagens[indice]);
    }, 3500);
  },

  pararStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.elementos.webcam) {
      this.elementos.webcam.pause?.();
      this.elementos.webcam.srcObject = null;
    }
  },

  desativarGestos() {
    if (this.intervaloStatus) {
      clearInterval(this.intervaloStatus);
      this.intervaloStatus = null;
    }

    this.pararStream();
    this.ativo = false;
    this.definirIndicador("Abrir gestos");
    this.setTexto("Gestos desativados. Clique em ativar para ligar a câmera novamente.");
    this.elementos.indicador?.classList.remove("oculto");
  },

  abrirTutorial() {
    this.elementos.modalTutorial?.classList.remove("oculto");
    this.setTexto(
      this.ativo
        ? "Tutorial aberto. Use a mão diante da câmera para testar seus gestos."
        : "Tutorial aberto. Ative os gestos para usar a câmera no teste ao vivo."
    );
  },

  fecharTutorial() {
    this.elementos.modalTutorial?.classList.add("oculto");
  }
};

document.addEventListener("DOMContentLoaded", () => Gestos.iniciar());

window.GestosBRASFLIX = Gestos;
export { Gestos };
