import { apiRequest, formatDateTime, showMessage } from "./common.js";

const logoutButton = document.getElementById("logoutButton");
const expertsList = document.getElementById("experts-list");
const expertsRefreshBtn = document.getElementById("experts-refresh");
const expertForm = document.getElementById("expert-form");
const expertFormTitle = document.getElementById("expert-form-title");
const expertIdInput = document.getElementById("expertId");
const expertNameInput = document.getElementById("expertName");
const expertAreaInput = document.getElementById("expertArea");
const expertContactInput = document.getElementById("expertContact");
const expertMeetingRoomInput = document.getElementById("expertMeetingRoom");
const expertBioInput = document.getElementById("expertBio");
const expertSubmitBtn = document.getElementById("expertSubmit");
const expertCancelBtn = document.getElementById("expertCancel");

const slotForm = document.getElementById("slot-form");
const slotFormTitle = document.getElementById("slot-form-title");
const slotExpertSelect = document.getElementById("slotExpert");
const slotStartInput = document.getElementById("slotStart");
const slotEndInput = document.getElementById("slotEnd");
const slotDurationInput = document.getElementById("slotDuration");
const slotIdInput = document.getElementById("slotId");
const slotSubmitBtn = document.getElementById("slotSubmit");
const slotCancelBtn = document.getElementById("slotCancel");

const adminBookingsContainer = document.getElementById("admin-bookings");
const adminMessage = document.getElementById("admin-message");
const adminRefreshBtn = document.getElementById("admin-refresh");
const bookingExpertFilter = document.getElementById("bookingExpertFilter");

let expertsCache = [];

const placeholderOption = '<option value="">Выберите эксперта</option>';

const getAdminHeaders = () => {
  const token = sessionStorage.getItem("adminToken");
  if (!token) {
    window.location.href = "/admin/login";
    throw new Error("Требуется авторизация");
  }
  return {
    "Content-Type": "application/json",
    "X-Admin-Token": token,
  };
};

const syncSlotFormState = () => {
  const hasExperts = expertsCache.length > 0;
  slotExpertSelect.disabled = !hasExperts;
  slotSubmitBtn.disabled = !hasExperts;
  if (!hasExperts) {
    slotExpertSelect.innerHTML = '<option value="">Нет экспертов</option>';
  }
};

const restoreSelectValue = (select, value) => {
  if (!select || !value) return;
  if (Array.from(select.options).some((option) => option.value === value)) {
    select.value = value;
  }
};

const populateExpertSelects = () => {
  const prevSlotExpert = slotExpertSelect.value;
  const prevFilter = bookingExpertFilter.value;
  if (expertsCache.length === 0) {
    slotExpertSelect.innerHTML = '<option value="">Нет экспертов</option>';
    bookingExpertFilter.innerHTML = '<option value="">Эксперты отсутствуют</option>';
  } else {
    const options = expertsCache.map((expert) => `<option value="${expert.id}">${expert.full_name}</option>`);
    slotExpertSelect.innerHTML = placeholderOption + options.join("");
    bookingExpertFilter.innerHTML = '<option value="">Все эксперты</option>' + options.join("");
    restoreSelectValue(slotExpertSelect, prevSlotExpert);
    restoreSelectValue(bookingExpertFilter, prevFilter);
  }
  syncSlotFormState();
};

const renderSlots = (expert) => {
  const wrapper = document.createElement("div");
  wrapper.className = "slot-list slots";
  if (expert.slots.length === 0) {
    wrapper.innerHTML = "<small>Слоты ещё не назначены</small>";
    return wrapper;
  }
  expert.slots.forEach((slot) => {
    const slotBox = document.createElement("div");
    slotBox.className = `slot ${slot.is_available ? "" : "booked"}`;
    slotBox.innerHTML = `
      <div class="slot-header">
        <span>${formatDateTime(slot.start_at)}</span>
        <span class="slot-duration">${slot.duration_minutes} мин</span>
      </div>
      <div class="slot-actions"></div>
    `;
    const actions = slotBox.querySelector(".slot-actions");
    if (slot.is_available) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "Изменить";
      editBtn.addEventListener("click", () => setSlotFormMode(slot, expert.id));
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Удалить";
      deleteBtn.classList.add("btn-danger");
      deleteBtn.addEventListener("click", () => handleSlotDelete(slot.id));
      actions.append(editBtn, deleteBtn);
    } else {
      const occupied = document.createElement("div");
      occupied.className = "slot-status";
      occupied.textContent = "Занято";
      actions.replaceChildren(occupied);
    }
    wrapper.appendChild(slotBox);
  });
  return wrapper;
};

const renderExpertsList = () => {
  expertsList.innerHTML = "";
  if (expertsCache.length === 0) {
    expertsList.innerHTML = "<p>Экспертов пока нет</p>";
    return;
  }
  expertsCache.forEach((expert) => {
    const totalSlots = expert.slots.length;
    const freeSlots = expert.slots.filter((slot) => slot.is_available).length;
    const card = document.createElement("div");
    card.className = "expert-card";
    card.innerHTML = `
      <div class="expert-card-head">
        <div>
          <h4>${expert.full_name}</h4>
          <p class="muted">${expert.expertise_area}</p>
        </div>
        <span class="chip">${freeSlots}/${totalSlots || 0} свободно</span>
      </div>
      ${expert.bio ? `<p>${expert.bio}</p>` : ""}
      ${expert.contact_info ? `<p class="muted">${expert.contact_info}</p>` : ""}
      ${expert.meeting_room ? `<p class="muted"><strong>Комната для встречи:</strong> <a href="${expert.meeting_room}" target="_blank">${expert.meeting_room}</a></p>` : ""}
      <div class="expert-actions"></div>
    `;
    const actions = card.querySelector(".expert-actions");
    const editBtn = document.createElement("button");
    editBtn.textContent = "Редактировать";
    editBtn.addEventListener("click", () => setExpertFormMode(expert));
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Удалить";
    deleteBtn.classList.add("btn-danger");
    deleteBtn.addEventListener("click", () => handleExpertDelete(expert.id));
    actions.append(editBtn, deleteBtn);
    card.appendChild(renderSlots(expert));
    expertsList.appendChild(card);
  });
};

const loadExperts = async (notify = false) => {
  try {
    const data = await apiRequest("/experts?horizon_days=365");
    expertsCache = data;
    populateExpertSelects();
    renderExpertsList();
    if (notify) {
      showMessage(adminMessage, "Список экспертов обновлён", "success");
    }
  } catch (error) {
    showMessage(adminMessage, error.message, "error");
  }
};

const setExpertFormMode = (expert) => {
  if (expert) {
    expertFormTitle.textContent = "Редактировать эксперта";
    expertSubmitBtn.textContent = "Сохранить";
    expertCancelBtn.hidden = false;
    expertIdInput.value = expert.id;
    expertNameInput.value = expert.full_name;
    expertAreaInput.value = expert.expertise_area;
    expertContactInput.value = expert.contact_info ?? "";
    expertMeetingRoomInput.value = expert.meeting_room ?? "";
    expertBioInput.value = expert.bio ?? "";
  } else {
    expertForm.reset();
    expertFormTitle.textContent = "Добавить эксперта";
    expertSubmitBtn.textContent = "Создать эксперта";
    expertCancelBtn.hidden = true;
    expertIdInput.value = "";
  }
};

const setSlotFormMode = (slot, expertId) => {
  if (slot) {
    slotFormTitle.textContent = "Редактировать слот";
    slotSubmitBtn.textContent = "Сохранить";
    slotCancelBtn.hidden = false;
    slotIdInput.value = slot.id;
    slotExpertSelect.value = String(expertId);
    slotStartInput.value = new Date(slot.start_at).toISOString().slice(0, 16);
    slotEndInput.value = "";
    slotDurationInput.value = slot.duration_minutes;
  } else {
    slotFormTitle.textContent = "Назначить слот(ы)";
    slotSubmitBtn.textContent = "Сохранить";
    slotCancelBtn.hidden = true;
    slotIdInput.value = "";
    slotForm.reset();
  }
};

const handleExpertDelete = async (expertId) => {
  if (!confirm("Удалить эксперта и все его слоты?")) return;
  try {
    const headers = getAdminHeaders();
    await apiRequest(`/experts/${expertId}`, { method: "DELETE", headers });
    if (expertIdInput.value && Number(expertIdInput.value) === expertId) {
      setExpertFormMode(null);
    }
    await Promise.all([loadExperts(), loadAdminBookings()]);
    showMessage(adminMessage, "Эксперт удалён", "success");
  } catch (error) {
    showMessage(adminMessage, error.message, "error");
  }
};

const handleSlotDelete = async (slotId) => {
  if (!confirm("Удалить слот?")) return;
  try {
    const headers = getAdminHeaders();
    await apiRequest(`/slots/${slotId}`, { method: "DELETE", headers });
    if (slotIdInput.value && Number(slotIdInput.value) === slotId) {
      setSlotFormMode(null);
    }
    await loadExperts();
  } catch (error) {
    showMessage(adminMessage, error.message, "error");
  }
};

const renderAdminBookings = (bookings) => {
  adminBookingsContainer.innerHTML = "";
  if (bookings.length === 0) {
    adminBookingsContainer.innerHTML = "<p>Пока нет записей</p>";
    return;
  }
  bookings.forEach((booking) => {
    const slot = expertsCache
      .flatMap((expert) => expert.slots)
      .find((item) => item.id === booking.slot_id);
    const card = document.createElement("div");
    card.className = "expert-card";
    card.innerHTML = `
      <p><strong>ID:</strong> ${booking.id}</p>
      <p><strong>Слот:</strong> ${slot ? formatDateTime(slot.start_at) : booking.slot_id}</p>
      <p><strong>Студент:</strong> ${booking.student_name} (${booking.student_email})</p>
      <p><strong>Запрос:</strong> ${booking.question}</p>
      ${booking.vkr_type ? `<p><strong>Тип ВКР(С):</strong> ${booking.vkr_type}</p>` : ""}
      ${booking.magistracy ? `<p><strong>Магистратура:</strong> ${booking.magistracy}</p>` : ""}
      ${booking.artifacts_link ? `<p><strong>Артефакты:</strong> <a href="${booking.artifacts_link}" target="_blank">${booking.artifacts_link}</a></p>` : ""}
      <div class="expert-actions"></div>
    `;
    const actions = card.querySelector(".expert-actions");
    const editBtn = document.createElement("button");
    editBtn.textContent = "Редактировать";
    editBtn.addEventListener("click", () => adminEditBooking(booking));
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Удалить";
    deleteBtn.classList.add("btn-danger");
    deleteBtn.addEventListener("click", () => adminDeleteBooking(booking.id));
    actions.append(editBtn, deleteBtn);
    adminBookingsContainer.appendChild(card);
  });
};

const loadAdminBookings = async () => {
  try {
    const expertId = bookingExpertFilter.value;
    if (expertId) {
      const bookings = await apiRequest(`/experts/${expertId}/bookings`);
      renderAdminBookings(bookings);
      showMessage(adminMessage, "Фильтр по эксперту применён", "success");
    } else {
      const headers = getAdminHeaders();
      const bookings = await apiRequest("/bookings", { headers });
      renderAdminBookings(bookings);
    }
  } catch (error) {
    showMessage(adminMessage, error.message, "error");
  }
};

const adminDeleteBooking = async (bookingId) => {
  if (!confirm("Удалить запись?")) return;
  try {
    const headers = getAdminHeaders();
    await apiRequest(`/admin/bookings/${bookingId}`, { method: "DELETE", headers });
    showMessage(adminMessage, "Запись удалена", "success");
    await Promise.all([loadExperts(), loadAdminBookings()]);
  } catch (error) {
    showMessage(adminMessage, error.message, "error");
  }
};

const adminEditBooking = async (booking) => {
  const newQuestion = prompt("Измените запрос студента", booking.question);
  if (!newQuestion || newQuestion.trim() === booking.question) return;
  try {
    const headers = getAdminHeaders();
    await apiRequest(`/admin/bookings/${booking.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ question: newQuestion.trim() }),
    });
    showMessage(adminMessage, "Запись обновлена", "success");
    await loadAdminBookings();
  } catch (error) {
    showMessage(adminMessage, error.message, "error");
  }
};

expertForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const headers = getAdminHeaders();
    const payload = {
      full_name: expertNameInput.value.trim(),
      expertise_area: expertAreaInput.value.trim(),
      contact_info: expertContactInput.value.trim() || null,
      meeting_room: expertMeetingRoomInput.value.trim() || null,
      bio: expertBioInput.value.trim() || null,
    };
    const expertId = expertIdInput.value;
    const isEdit = Boolean(expertId);
    const url = isEdit ? `/experts/${expertId}` : "/experts";
    const method = isEdit ? "PATCH" : "POST";
    await apiRequest(url, {
      method,
      headers,
      body: JSON.stringify(payload),
    });
    showMessage(adminMessage, isEdit ? "Эксперт обновлён" : "Эксперт добавлен", "success");
    setExpertFormMode(null);
    await loadExperts();
  } catch (error) {
    showMessage(adminMessage, error.message, "error");
  }
});

expertCancelBtn.addEventListener("click", () => setExpertFormMode(null));

slotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const headers = getAdminHeaders();
    const expertId = Number(slotExpertSelect.value);
    if (!expertId) {
      throw new Error("Выберите эксперта для слотов");
    }
    const slotId = slotIdInput.value;
    const startValue = slotStartInput.value;
    if (!startValue) {
      throw new Error("Укажите дату и время начала");
    }
    const duration = Number(slotDurationInput.value);
    if (!duration) {
      throw new Error("Укажите длительность слота");
    }
    if (slotId) {
      await apiRequest(`/slots/${slotId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          start_at: new Date(startValue).toISOString(),
          duration_minutes: duration,
        }),
      });
      showMessage(adminMessage, "Слот обновлён", "success");
    } else if (slotEndInput.value) {
      const endValue = new Date(slotEndInput.value);
      if (endValue <= new Date(startValue)) {
        throw new Error("Конец периода должен быть позже начала");
      }
      await apiRequest("/slots/batch", {
        method: "POST",
        headers,
        body: JSON.stringify({
          expert_id: expertId,
          start_at: new Date(startValue).toISOString(),
          end_at: endValue.toISOString(),
          slot_duration_minutes: duration,
        }),
      });
      showMessage(adminMessage, "Слоты добавлены", "success");
    } else {
      await apiRequest("/slots", {
        method: "POST",
        headers,
        body: JSON.stringify({
          expert_id: expertId,
          start_at: new Date(startValue).toISOString(),
          duration_minutes: duration,
        }),
      });
      showMessage(adminMessage, "Слот добавлен", "success");
    }
    setSlotFormMode(null);
    await loadExperts();
  } catch (error) {
    showMessage(adminMessage, error.message, "error");
  }
});

slotCancelBtn.addEventListener("click", () => setSlotFormMode(null));

adminRefreshBtn.addEventListener("click", loadAdminBookings);
bookingExpertFilter.addEventListener("change", loadAdminBookings);
expertsRefreshBtn.addEventListener("click", () => loadExperts(true));
logoutButton.addEventListener("click", async () => {
  await fetch("/admin/logout", { method: "POST" });
  sessionStorage.removeItem("adminToken");
  window.location.href = "/admin/login";
});

loadExperts().then(() => {
  if (sessionStorage.getItem("adminToken")) {
    loadAdminBookings();
  }
});
