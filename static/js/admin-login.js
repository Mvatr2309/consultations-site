const form = document.getElementById("admin-login-form");
const tokenInput = document.getElementById("loginToken");
const messageBox = document.getElementById("login-message");

const showMessage = (text, type = "error") => {
  messageBox.innerHTML = "";
  if (!text) return;
  const div = document.createElement("div");
  div.className = `message ${type}`;
  div.textContent = text;
  messageBox.appendChild(div);
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = tokenInput.value.trim();
  if (!token) {
    showMessage("Введите токен");
    return;
  }
  try {
    const res = await fetch("/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Неверный токен");
    }
    sessionStorage.setItem("adminToken", token);
    window.location.href = "/admin";
  } catch (error) {
    showMessage(error.message || "Ошибка входа");
  }
});
