export const API_BASE = "";

export const formatDateTime = (value) =>
  new Date(value).toLocaleString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

export const showMessage = (element, text, type = "success") => {
  if (!element) return;
  element.innerHTML = "";
  if (!text) return;
  const div = document.createElement("div");
  div.className = `message ${type}`;
  div.textContent = text;
  element.replaceChildren(div);
};

export const apiRequest = async (path, options = {}) => {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    let detail = "Ошибка запроса";
    try {
      const data = await res.json();
      if (Array.isArray(data.detail)) {
        detail =
          data.detail
            .map((item) => item?.msg || item?.message || JSON.stringify(item))
            .join("; ") || detail;
      } else if (typeof data.detail === "object" && data.detail !== null) {
        detail = data.detail.message || JSON.stringify(data.detail);
      } else {
        detail = data.detail || data.message || detail;
      }
    } catch (error) {
      // ignore JSON parsing errors
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  try {
    return await res.json();
  } catch (error) {
    return null;
  }
};
