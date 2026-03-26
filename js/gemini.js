class GeminiClient {
  constructor() {
    this.provider = "gemini";
    this.defaultModel = "gemini-2.5-flash";
  }

  async sendMessage({ message, context = [], systemInstruction = "", model = this.defaultModel }) {
    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: this.provider,
          model,
          prompt: message,
          context,
          systemInstruction
        })
      });

      const raw = await response.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(raw || "A resposta do servidor não veio em JSON válido.");
      }

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || data?.text || "Erro ao chamar Gemini.");
      }

      return {
        ok: true,
        provider: data.provider || this.provider,
        model: data.model || model,
        text: data.text || "Sem resposta da IA.",
        notice: data.notice || ""
      };
    } catch (error) {
      console.error("[Gemini] Erro:", error);
      return { ok: false, provider: this.provider, model, error: error.message, text: "" };
    }
  }
}
const geminiClient = new GeminiClient();
window.geminiClient = geminiClient;
export { GeminiClient, geminiClient };
