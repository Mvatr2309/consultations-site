import { apiRequest, formatDateTime, showMessage } from "./common.js";

const expertsWrapper = document.getElementById("experts-wrapper");
const bookingForm = document.getElementById("booking-form");
const bookingMessage = document.getElementById("booking-message");
const bookButton = document.getElementById("bookButton");
const cancelForm = document.getElementById("cancel-form");
const cancelMessage = document.getElementById("cancel-message");
const prevExpertBtn = document.getElementById("prevExpert");
const nextExpertBtn = document.getElementById("nextExpert");
const bookingPopup = document.getElementById("booking-popup");
const popupBookingId = document.getElementById("popup-booking-id");
const popupCancellationCode = document.getElementById("popup-cancellation-code");
const downloadBookingBtn = document.getElementById("download-booking-info");
const closePopupBtn = document.getElementById("close-popup");
const selectedSlotInfo = document.getElementById("selected-slot-info");
const selectedSlotDetails = document.getElementById("selected-slot-details");

let expertsCache = [];
let selectedSlotId = null;
let selectedSlotData = null;
let currentExpertIndex = 0;
let lastBookingData = null;
const MAX_VISIBLE_EXPERTS = 3;

const renderExperts = () => {
  expertsWrapper.innerHTML = "";
  if (expertsCache.length === 0) {
    expertsWrapper.innerHTML = "<p>Экспертов пока нет</p>";
    return;
  }

  const visibleExperts = expertsCache.filter((expert) => {
    const availableSlots = expert.slots.filter((slot) => slot.is_available);
    return availableSlots.length > 0;
  });

  if (visibleExperts.length === 0) {
    expertsWrapper.innerHTML = "<p>Нет доступных слотов</p>";
    return;
  }

  const startIndex = Math.max(0, Math.min(currentExpertIndex, visibleExperts.length - MAX_VISIBLE_EXPERTS));
  const endIndex = Math.min(startIndex + MAX_VISIBLE_EXPERTS, visibleExperts.length);
  const expertsToShow = visibleExperts.slice(startIndex, endIndex);

  prevExpertBtn.disabled = startIndex === 0;
  nextExpertBtn.disabled = endIndex >= visibleExperts.length;

  expertsToShow.forEach((expert) => {
    const availableSlots = expert.slots.filter((slot) => slot.is_available);
    if (availableSlots.length === 0) return;

    const card = document.createElement("div");
    card.className = "expert-card";
    card.innerHTML = `
      <h3>${expert.full_name}</h3>
      <p>${expert.expertise_area}</p>
      ${expert.bio ? `<p>${expert.bio}</p>` : ""}
      ${expert.contact_info ? `<p><strong>Контакты:</strong> ${expert.contact_info}</p>` : ""}
      ${expert.meeting_room ? `<p><strong>Комната для встречи:</strong> <a href="${expert.meeting_room}" target="_blank">${expert.meeting_room}</a></p>` : ""}
    `;

    const slotList = document.createElement("div");
    slotList.className = "slot-list slots";

    availableSlots.forEach((slot) => {
      const slotBox = document.createElement("div");
      slotBox.className = `slot ${selectedSlotId === slot.id ? "selected" : ""}`;
      slotBox.dataset.slotId = slot.id;
      slotBox.innerHTML = `
        <div class="slot-header">
          <span>${formatDateTime(slot.start_at)}</span>
          <span class="slot-duration">${slot.duration_minutes} мин</span>
        </div>
        <div class="slot-actions">
          <button type="button" class="slot-select-btn">${selectedSlotId === slot.id ? "Отменить" : "Выбрать"}</button>
        </div>
      `;
      const button = slotBox.querySelector(".slot-select-btn");
      button.addEventListener("click", () => selectSlot(slot, expert));
      slotList.appendChild(slotBox);
    });

    card.appendChild(slotList);
    expertsWrapper.appendChild(card);
  });
};

const selectSlot = (slot, expert) => {
  if (selectedSlotId === slot.id) {
    selectedSlotId = null;
    selectedSlotData = null;
    document.getElementById("slotId").value = "";
    bookButton.disabled = true;
    selectedSlotInfo.setAttribute("hidden", "");
    showMessage(bookingMessage, "", "");
  } else {
    selectedSlotId = slot.id;
    selectedSlotData = { slot, expert };
    document.getElementById("slotId").value = slot.id;
    bookButton.disabled = false;
    selectedSlotDetails.textContent = `${formatDateTime(slot.start_at)} у ${expert.full_name}`;
    selectedSlotInfo.removeAttribute("hidden");
    showMessage(bookingMessage, "", "");
  }
  renderExperts();
};

const loadExperts = async () => {
  const data = await apiRequest("/experts?horizon_days=365");
  expertsCache = data;
  renderExperts();
};

const showBookingPopup = (bookingId, cancellationCode, bookingData) => {
  popupBookingId.textContent = bookingId;
  popupCancellationCode.textContent = cancellationCode;
  lastBookingData = bookingData;
  bookingPopup.removeAttribute("hidden");
};

const downloadBookingInfo = () => {
  if (!lastBookingData) return;
  const bookingId = popupBookingId.textContent;
  const cancellationCode = popupCancellationCode.textContent;
  const content = `Запись на консультацию

ID записи: ${bookingId}
Код отмены: ${cancellationCode}

Информация о записи:
Имя: ${lastBookingData.student_name}
Email: ${lastBookingData.student_email}
${lastBookingData.vkr_type ? `Тип ВКР(С): ${lastBookingData.vkr_type}` : ""}
${lastBookingData.magistracy ? `Магистратура: ${lastBookingData.magistracy}` : ""}
Запрос: ${lastBookingData.question}
${lastBookingData.artifacts_link ? `Артефакты: ${lastBookingData.artifacts_link}` : ""}

Сохраните эту информацию для отмены записи.`;
  
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `booking_${bookingId}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedSlotId) {
    showMessage(bookingMessage, "Сначала выберите слот", "error");
    return;
  }
  
  // Валидация всех полей
  const studentName = document.getElementById("studentName").value.trim();
  const studentEmail = document.getElementById("studentEmail").value.trim();
  const vkrType = document.getElementById("vkrType").value;
  const magistracy = document.getElementById("magistracy").value;
  const question = document.getElementById("question").value.trim();
  const artifactsLink = document.getElementById("artifactsLink").value.trim();
  
  if (!studentName) {
    showMessage(bookingMessage, "Заполните поле 'Ваше имя'", "error");
    return;
  }
  if (!studentEmail) {
    showMessage(bookingMessage, "Заполните поле 'Почта'", "error");
    return;
  }
  if (!vkrType) {
    showMessage(bookingMessage, "Выберите тип работы", "error");
    return;
  }
  if (!magistracy) {
    showMessage(bookingMessage, "Выберите магистратуру", "error");
    return;
  }
  if (!question) {
    showMessage(bookingMessage, "Заполните поле 'Опишите запрос'", "error");
    return;
  }
  if (!artifactsLink) {
    showMessage(bookingMessage, "Заполните поле 'Приложите ссылку на артефакты'", "error");
    return;
  }
  
  bookButton.disabled = true;
  const payload = {
    student_name: studentName,
    student_email: studentEmail,
    question: question,
    vkr_type: vkrType,
    magistracy: magistracy,
    artifacts_link: artifactsLink,
  };

  try {
    const booking = await apiRequest(`/slots/${selectedSlotId}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    showBookingPopup(booking.id, booking.cancellation_code, payload);
    bookingForm.reset();
    selectedSlotId = null;
    selectedSlotData = null;
    bookButton.disabled = true;
    selectedSlotInfo.setAttribute("hidden", "");
    await loadExperts();
  } catch (error) {
    showMessage(bookingMessage, error.message, "error");
  } finally {
    bookButton.disabled = false;
  }
});

cancelForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const bookingId = document.getElementById("cancelBookingId").value;
  const code = document.getElementById("cancelCode").value.trim();
  try {
    await apiRequest(`/bookings/${bookingId}?cancellation_code=${code}`, { method: "DELETE" });
    showMessage(cancelMessage, "Запись удалена", "success");
    cancelForm.reset();
    await loadExperts();
  } catch (error) {
    showMessage(cancelMessage, error.message, "error");
  }
});

prevExpertBtn.addEventListener("click", () => {
  currentExpertIndex = Math.max(0, currentExpertIndex - MAX_VISIBLE_EXPERTS);
  renderExperts();
});

nextExpertBtn.addEventListener("click", () => {
  currentExpertIndex += MAX_VISIBLE_EXPERTS;
  renderExperts();
});

const closePopup = () => {
  bookingPopup.setAttribute("hidden", "");
};

closePopupBtn.addEventListener("click", closePopup);

// Закрытие попапа при клике на фон
bookingPopup.addEventListener("click", (event) => {
  if (event.target === bookingPopup) {
    closePopup();
  }
});

// Закрытие попапа при нажатии Escape
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !bookingPopup.hasAttribute("hidden")) {
    closePopup();
  }
});

downloadBookingBtn.addEventListener("click", downloadBookingInfo);

// Убедимся, что попап скрыт при загрузке страницы
closePopup();

loadExperts();
