import { apiRequest, formatDateTime, showMessage } from "./common.js";

const expertSelect = document.getElementById("expertSelect");
const expertBookingsContainer = document.getElementById("expert-bookings");
const expertMessage = document.getElementById("expert-message");
const expertRefreshBtn = document.getElementById("expert-refresh");
const logoutButton = document.getElementById("logoutButton");

let expertsCache = [];

const renderExpertOptions = () => {
  const placeholder = '<option value="">Выберите эксперта</option>';
  const options = expertsCache.map((expert) => `<option value="${expert.id}">${expert.full_name}</option>`);
  expertSelect.innerHTML = placeholder + options.join("");
  expertSelect.disabled = expertsCache.length === 0;
};

const findSlot = (slotId) =>
  expertsCache.flatMap((expert) => expert.slots).find((slot) => slot.id === slotId);

const renderExpertBookings = (bookings) => {
  expertBookingsContainer.innerHTML = "";
  if (bookings.length === 0) {
    expertBookingsContainer.innerHTML = "<p>Записей пока нет</p>";
    return;
  }
  bookings.forEach((booking) => {
    const slot = findSlot(booking.slot_id);
    const card = document.createElement("div");
    card.className = "expert-card";
    card.innerHTML = `
      <p><strong>Студент:</strong> ${booking.student_name}</p>
      <p><strong>Почта:</strong> ${booking.student_email}</p>
      <p><strong>Запрос:</strong> ${booking.question}</p>
      ${booking.vkr_type ? `<p><strong>Тип ВКР(С):</strong> ${booking.vkr_type}</p>` : ""}
      ${booking.magistracy ? `<p><strong>Магистратура:</strong> ${booking.magistracy}</p>` : ""}
      ${booking.artifacts_link ? `<p><strong>Артефакты:</strong> <a href="${booking.artifacts_link}" target="_blank">${booking.artifacts_link}</a></p>` : ""}
      <p><strong>Слот:</strong> ${
        slot ? formatDateTime(slot.start_at) : `ID ${booking.slot_id}`
      }</p>
    `;
    expertBookingsContainer.appendChild(card);
  });
};

const loadBookings = async (expertId) => {
  if (!expertId) {
    expertBookingsContainer.innerHTML = "";
    return;
  }
  try {
    const bookings = await apiRequest(`/experts/${expertId}/bookings`);
    renderExpertBookings(bookings);
    showMessage(expertMessage, "Список обновлён", "success");
  } catch (error) {
    showMessage(expertMessage, error.message, "error");
  }
};

const loadExperts = async () => {
  try {
    const data = await apiRequest("/experts?horizon_days=365");
    expertsCache = data;
    renderExpertOptions();
  } catch (error) {
    showMessage(expertMessage, error.message, "error");
  }
};

expertSelect.addEventListener("change", (event) => {
  const expertId = event.target.value;
  loadBookings(expertId);
});

expertRefreshBtn?.addEventListener("click", async () => {
  await loadExperts();
  if (expertSelect.value) {
    loadBookings(expertSelect.value);
  }
});

logoutButton.addEventListener("click", async () => {
  await fetch("/expert/logout", { method: "POST" });
  window.location.href = "/expert/login";
});

loadExperts().then(() => {
  if (expertSelect.options.length === 2) {
    expertSelect.selectedIndex = 1;
    expertSelect.dispatchEvent(new Event("change"));
  }
});
