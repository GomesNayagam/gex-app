const MODEL_KEY = "ai-chat-model"; // legacy — keep for now, unused after migration
const CUSTOM_MODELS_KEY = "ai-custom-models";
const PERSONA_KEY = "ai-agent-persona";

export const MODELS = [
  "deepseek/deepseek-v4-flash",
  "anthropic/claude-sonnet-4-5",
  "openai/gpt-4o",
  "google/gemini-2.5-pro",
  "mistralai/mistral-large",
];

export function getCustomModels() {
  try {
    const raw = localStorage.getItem(CUSTOM_MODELS_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomModels(models) {
  try {
    localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(models));
  } catch {}
}

export function getAllModels() {
  return [...MODELS, ...getCustomModels()];
}

export function getPersona() {
  try {
    return localStorage.getItem(PERSONA_KEY) || "";
  } catch {
    return "";
  }
}

export function savePersona(text) {
  try {
    if (text) {
      localStorage.setItem(PERSONA_KEY, text);
    } else {
      localStorage.removeItem(PERSONA_KEY);
    }
  } catch {}
}

// Legacy helpers — kept so Settings.jsx doesn't break before Task 8
export function getChatModel() {
  try {
    return localStorage.getItem(MODEL_KEY) ?? "";
  } catch {
    return "";
  }
}
export function setChatModel(value) {
  try {
    const t = (value ?? "").trim();
    if (t) {
      localStorage.setItem(MODEL_KEY, t);
    } else {
      localStorage.removeItem(MODEL_KEY);
    }
  } catch {}
}
