const STORAGE_KEY = "ai-chat-model"

export function getChatModel() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ""
  } catch {
    return ""
  }
}

export function setChatModel(value) {
  try {
    const trimmed = (value ?? "").trim()
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {}
}
