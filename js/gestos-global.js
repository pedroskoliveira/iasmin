import { Gestos } from "./gestos.js";

const GestosGlobal = {
  init() {
    window.addEventListener("brasflix:start-gestos", () => {
      Gestos.ativarGestos();
    });

    window.addEventListener("brasflix:stop-gestos", () => {
      Gestos.desativarGestos();
    });

    const fallbackAntigo = document.getElementById("gestosBox");
    if (fallbackAntigo) {
      fallbackAntigo.remove();
    }
  }
};

document.addEventListener("DOMContentLoaded", () => GestosGlobal.init());

window.GestosGlobalBRASFLIX = GestosGlobal;
export { GestosGlobal };
