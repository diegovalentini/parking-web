// ========================
//   VARIABLES GLOBALES
// ========================
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

let currentUser = null;
let currentUserRole = "viewer"; 

const HISTORY_KEY = "estacionamiento_history"; 

// ========================
//   INICIALIZACIÓN
// ========================
document.addEventListener("DOMContentLoaded", () => {
  initFirebase();
  initAuthObserver();

  initClock();
  initLogin();
  initParking();
  initHistory();
  initProfilePanel(); 
});

// ========================
//   FIREBASE
// ========================
function initFirebase() {
  if (!window.firebase || !window.firebaseConfig) {
    console.warn("Firebase o firebaseConfig no están disponibles.");
    return;
  }
  if (firebaseApp) return; // ya inicializado

  firebaseApp = firebase.initializeApp(window.firebaseConfig);
  firebaseAuth = firebase.auth();
  firebaseDb = firebase.firestore();
}

async function fetchUserRole(uid) {
  if (!firebaseDb) return "viewer";
  try {
    const doc = await firebaseDb.collection("users").doc(uid).get();
    if (doc.exists) {
      const data = doc.data();
      return data.role || "viewer";
    }
    const user = firebaseAuth.currentUser;
    const displayName = user?.displayName || "";
    await firebaseDb.collection("users").doc(uid).set({
      displayName,
      email: user?.email || "",
      role: "viewer",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return "viewer";
  } catch (err) {
    console.error("Error al obtener rol:", err);
    return "viewer";
  }
}

function initAuthObserver() {
  if (!firebaseAuth) return;

  firebaseAuth.onAuthStateChanged(async (user) => {
    currentUser = user;

    if (!user) {
      currentUserRole = "viewer";
      sessionStorage.removeItem("userRole");
      if (
        document.body.classList.contains("page-parking") ||
        document.body.classList.contains("page-history")
      ) {
        window.location.href = "index.html";
      }
      return;
    }
    let role = sessionStorage.getItem("userRole");
    if (!role) {
      role = await fetchUserRole(user.uid);
      sessionStorage.setItem("userRole", role);
    }

    currentUserRole = role;

    if (document.body.classList.contains("page-login")) {
      window.location.href = "parking.html";
    }
  });
}

// ========================
//   RELOJ SUPERIOR
// ========================
function initClock() {
  const timeEl = document.querySelector(".topbar-time");
  if (!timeEl) return;

  function updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    timeEl.textContent = `${hours}:${minutes}`;
  }

  updateTime();
  setInterval(updateTime, 30 * 1000);
}

// ========================
//   LOGIN / REGISTRO
// ========================
function initLogin() {
  const form = document.getElementById("login-form");
  if (!form) return; // no estamos en index.html

  const signupBtn = document.getElementById("signup-btn");
  const forgotLink = document.getElementById("forgot-password-link");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!firebaseAuth) {
      alert("Firebase no está inicializado.");
      return;
    }

    const email = form.elements["email"]?.value.trim();
    const password = form.elements["password"]?.value;

    if (!email || !password) {
      alert("Por favor ingresa email y contraseña.");
      return;
    }

    try {
      const cred = await firebaseAuth.signInWithEmailAndPassword(email, password);

      const role = await fetchUserRole(cred.user.uid);
      currentUserRole = role;
      sessionStorage.setItem("userRole", role);

      window.location.href = "parking.html";
    } catch (err) {
      console.error(err);
      alert("Error al iniciar sesión: " + (err.message || ""));
    }
  });

  // ===== ABRIR MODAL DE CREAR CUENTA =====
  if (signupBtn) {
    signupBtn.addEventListener("click", () => {
      const signupName = document.getElementById("signup-name");
      const signupEmail = document.getElementById("signup-email");
      const signupPassword = document.getElementById("signup-password");

      if (signupName) signupName.value = "";
      if (signupEmail) signupEmail.value = form.elements["email"]?.value.trim() || "";
      if (signupPassword) signupPassword.value = "";

      showModal("signup-modal");
    });
  }

  // ===== LÓGICA DEL FORMULARIO DE REGISTRO =====
  const signupForm = document.getElementById("signup-form");
  const signupCancel = document.getElementById("signup-cancel");

  if (signupCancel) {
    signupCancel.addEventListener("click", () => {
      hideModal("signup-modal");
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!firebaseAuth || !firebaseDb) {
        alert("Firebase no está inicializado.");
        return;
      }

      const name = document.getElementById("signup-name")?.value.trim();
      const email = document.getElementById("signup-email")?.value.trim();
      const password = document.getElementById("signup-password")?.value;

      if (!name || !email || !password) {
        alert("Completa nombre, email y contraseña.");
        return;
      }

      try {
        const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);

        await cred.user.updateProfile({ displayName: name });

        await firebaseDb.collection("users").doc(cred.user.uid).set({
          displayName: name,
          email,
          role: "viewer",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        currentUserRole = "viewer";
        sessionStorage.setItem("userRole", "viewer");

        hideModal("signup-modal");
        alert("Cuenta creada correctamente. Entrando...");
        window.location.href = "parking.html";
      } catch (err) {
        console.error(err);
        alert("Error al crear cuenta: " + (err.message || ""));
      }
    });
  }

  // ===== RECUPERAR CONTRASEÑA =====
  const resetCancel = document.getElementById("reset-cancel");
  const resetSend = document.getElementById("reset-send");

  if (forgotLink) {
    forgotLink.addEventListener("click", () => {
      const resetEmailInput = document.getElementById("reset-email");
      if (resetEmailInput) {
        resetEmailInput.value = form.elements["email"]?.value.trim() || "";
      }
      showModal("reset-password-modal");
    });
  }

  if (resetCancel) {
    resetCancel.addEventListener("click", () => {
      hideModal("reset-password-modal");
    });
  }

  if (resetSend) {
    resetSend.addEventListener("click", async () => {
      if (!firebaseAuth) {
        alert("Firebase no está inicializado.");
        return;
      }

      const emailInput = document.getElementById("reset-email");
      const email = emailInput ? emailInput.value.trim() : "";

      if (!email) {
        alert("Ingresa un email para recuperar la contraseña.");
        return;
      }

      try {
        await firebaseAuth.sendPasswordResetEmail(email);
        alert("Te enviamos un correo con instrucciones para restablecer tu contraseña.");
        hideModal("reset-password-modal");
      } catch (err) {
        console.error(err);
        alert("No se pudo enviar el email: " + (err.message || ""));
      }
    });
  }
}

// ========================
//   ESTADO DE PLAZAS
// ========================
const spotsState = {};
let currentSpotLabel = null;
let currentSpotElement = null;

let pendingFinish = null;
let moveSourceLabel = null;
let moveSourceElement = null;
// Historial 
let historyCurrentDateKey = null;
let historyRecordsIndex = {}; 
let historyListEl = null;
let historySummaryTotalEl = null;
let historySummaryDateEl = null;
let currentHistoryRecordId = null;

// ========================
//   PÁGINA PARKING
// ========================
function initParking() {
  const grid = document.querySelector(".parking-grid");
  if (!grid) return; 

  // Plazas de motoos M1–M5
  const specialSpots = ["M1", "M2", "M3", "M4", "M5"];
  specialSpots.forEach((label) => {
    createSpotCard(grid, label, true);
  });

  // Plazas normales 1–50
  for (let i = 1; i <= 50; i++) {
    createSpotCard(grid, i, false);
  }

  // Botón cerrar sesión
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      if (firebaseAuth) {
        await firebaseAuth.signOut();
      } else {
        window.location.href = "index.html";
      }
    });
  }

  // Botón historial
  const historyBtn = document.getElementById("history-btn");
  if (historyBtn) {
    historyBtn.addEventListener("click", () => {
      if (currentUserRole === "viewer") {
        alert("No tienes permisos para ver el historial.");
        return;
      }
      window.location.href = "history.html";
    });
  }

  // Lógica de modales
  initSpotModal();
  initVehicleModal();
  initOccupiedModal();
  initFinishModal();
  initChargeModal();
  initMoveBanner();
}
// ========================
//   PANEL DE USUARIO
// ========================

function initProfilePanel() {
  const profileBtn = document.getElementById("profile-btn");
  const modalEl = document.getElementById("profile-modal");
  if (!profileBtn || !modalEl) return; 

  const closeBtn = document.getElementById("profile-close-btn");
  const saveBtn = document.getElementById("profile-save-btn");

  profileBtn.addEventListener("click", () => {
    openProfileModal();
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      hideModal("profile-modal");
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      handleProfileSave();
    });
  }
}

function openProfileModal() {
  const emailEl = document.getElementById("profile-email");
  const nameInput = document.getElementById("profile-name-input");
  const passwordInput = document.getElementById("profile-password-input");
  const adminSection = document.getElementById("admin-users-section");

  if (emailEl) {
    emailEl.textContent = currentUser?.email || "-";
  }
  if (nameInput) {
    nameInput.value = currentUser?.displayName || "";
  }
  if (passwordInput) {
    passwordInput.value = "";
  }

  // Mostrar sección admin sólo si el rol es admin
  if (adminSection) {
    if (currentUserRole === "admin") {
      adminSection.classList.add("is-visible");
      loadAdminUsers();
    } else {
      adminSection.classList.remove("is-visible");
    }
  }

  showModal("profile-modal");
}

// Guardar cambios del propio usuario
async function handleProfileSave() {
  if (!currentUser) {
    alert("No hay usuario autenticado.");
    return;
  }

  const nameInput = document.getElementById("profile-name-input");
  const passwordInput = document.getElementById("profile-password-input");

  const newName = nameInput ? nameInput.value.trim() : "";
  const newPassword = passwordInput ? passwordInput.value : "";

  try {
    if (newName && newName !== (currentUser.displayName || "")) {
      await currentUser.updateProfile({ displayName: newName });

      if (firebaseDb) {
        await firebaseDb.collection("users").doc(currentUser.uid).update({
          displayName: newName,
        });
      }
    }
    if (newPassword) {
      await currentUser.updatePassword(newPassword);
    }
    alert("Datos actualizados correctamente.");
    hideModal("profile-modal");
  } catch (err) {
    console.error("Error actualizando perfil:", err);
    if (err.code === "auth/requires-recent-login") {
      alert(
        "Por seguridad, debes volver a iniciar sesión para cambiar la contraseña. Cierra sesión y vuelve a entrar."
      );
    } else {
      alert("No se pudieron guardar los cambios: " + (err.message || ""));
    }
  }
}

async function loadAdminUsers() {
  const container = document.getElementById("admin-users-list");
  if (!container || !firebaseDb) return;

  container.innerHTML = "Cargando usuarios...";

  try {
    const snapshot = await firebaseDb.collection("users").get();

    container.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const uid = doc.id;

      const row = document.createElement("div");
      row.classList.add("admin-user-row");
      row.dataset.uid = uid;

      const role = data.role || "viewer";

      row.innerHTML = `
        <div class="admin-user-main">
          <input
            type="text"
            class="admin-user-name-input"
            value="${data.displayName || ""}"
            placeholder="Nombre"
          />
          <div class="admin-user-email">${data.email || ""}</div>
        </div>

        <div class="admin-user-controls">
          <select class="admin-role-select">
            <option value="viewer" ${role === "viewer" ? "selected" : ""}>Viewer</option>
            <option value="operator" ${role === "operator" ? "selected" : ""}>Operator</option>
            <option value="admin" ${role === "admin" ? "selected" : ""}>Admin</option>
          </select>
          <button class="admin-user-save-btn">Guardar</button>
        </div>
      `;

      container.appendChild(row);
    });

    const saveButtons = container.querySelectorAll(".admin-user-save-btn");
    saveButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest(".admin-user-row");
        const uid = row.dataset.uid;
        const nameInput = row.querySelector(".admin-user-name-input");
        const roleSelect = row.querySelector(".admin-role-select");

        const newName = nameInput.value.trim();
        const newRole = roleSelect.value;

        try {
          await firebaseDb.collection("users").doc(uid).update({
            displayName: newName,
            role: newRole,
          });
          alert("Usuario actualizado.");
        } catch (err) {
          console.error("Error actualizando usuario:", err);
          alert("No se pudo actualizar el usuario.");
        }
      });
    });
  } catch (err) {
    console.error("Error cargando usuarios:", err);
    container.innerHTML = "No se pudieron cargar los usuarios.";
  }
}

function createSpotCard(container, label, isSpecial) {
  const spot = document.createElement("button");
  spot.type = "button";
  spot.classList.add("spot");
  spot.classList.add(isSpecial ? "spot-special" : "spot-regular");
  spot.dataset.label = label;

  spot.innerHTML = `
    <div class="spot-label">${label}</div>
    <div class="spot-status">Libre</div>
  `;

  spot.addEventListener("click", () => {
    const clickedLabel = spot.dataset.label;
    const state = spotsState[clickedLabel];

    if (currentUserRole === "viewer") {
      return;
    }

    if (moveSourceLabel) {
      handleMoveClick(clickedLabel, spot, state);
      return;
    }

    // Modo normal
    currentSpotLabel = clickedLabel;
    currentSpotElement = spot;

    if (state && state.status === "ocupado") {
      openOccupiedModal(clickedLabel, state);
    } else {
      openSpotModal(clickedLabel);
    }
  });

  container.appendChild(spot);
}

// =========================
//   MODAL 1: PLAZA
// =========================
function initSpotModal() {
  const closeBtn = document.getElementById("spot-close");
  const blockBtn = document.getElementById("spot-block");
  const startBtn = document.getElementById("spot-start");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      hideModal("spot-modal");
    });
  }

  if (blockBtn) {
    blockBtn.addEventListener("click", () => {
      if (!currentSpotLabel || !currentSpotElement) return;
      const plateInput = document.getElementById("plate-input");
      const plate = plateInput ? plateInput.value.trim() : "";

      spotsState[currentSpotLabel] = {
        status: "bloqueado",
        plate,
        vehicle: null,
        startTime: null,
      };

      applySpotState(currentSpotLabel, currentSpotElement);
      hideModal("spot-modal");
    });
  }

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      if (!currentSpotLabel || !currentSpotElement) return;
      hideModal("spot-modal");
      showModal("vehicle-modal");
    });
  }
}

function openSpotModal(label) {
  const titleSpan = document.getElementById("spot-modal-title");
  if (titleSpan) titleSpan.textContent = label;

  const plateInput = document.getElementById("plate-input");
  if (plateInput) {
    const previousPlate = spotsState[label]?.plate || "";
    plateInput.value = previousPlate;
    plateInput.focus();
  }

  showModal("spot-modal");
}

// ================================
//   MODAL 2: TIPO DE VEHÍCULO
// ================================
function initVehicleModal() {
  const vehicleButtons = document.querySelectorAll(".vehicle-btn");

  vehicleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!currentSpotLabel || !currentSpotElement) return;

      const vehicleType = btn.dataset.vehicle;
      const plateInput = document.getElementById("plate-input");
      const plate = plateInput ? plateInput.value.trim() : "";
      const now = Date.now();

        spotsState[currentSpotLabel] = {
        status: "ocupado",
        plate,
        vehicle: vehicleType,
        startTime: now,
        openedByUid: currentUser?.uid || null,
        openedByName: currentUser?.displayName || currentUser?.email || "",
      };
      applySpotState(currentSpotLabel, currentSpotElement);
      hideModal("vehicle-modal");
    });
  });
}

// ================================
//   MODAL 3: PLAZA OCUPADA
// ================================
function initOccupiedModal() {
  const closeBtn = document.getElementById("occupied-close");
  const moveBtn = document.getElementById("occupied-move");
  const finishBtn = document.getElementById("occupied-finish");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      hideModal("occupied-modal");
    });
  }

  if (moveBtn) {
    moveBtn.addEventListener("click", () => {
      if (!currentSpotLabel || !currentSpotElement) return;

      const state = spotsState[currentSpotLabel];
      if (!state || state.status !== "ocupado") return;

      if (currentUserRole === "viewer") return;

      moveSourceLabel = currentSpotLabel;
      moveSourceElement = currentSpotElement;
      enterMoveMode();
      hideModal("occupied-modal");
    });
  }

  if (finishBtn) {
    finishBtn.addEventListener("click", () => {
      if (!currentSpotLabel) return;
      const state = spotsState[currentSpotLabel];
      if (!state) return;

      hideModal("occupied-modal");
      openFinishModal(currentSpotLabel, state);
    });
  }
}

function openOccupiedModal(label, state) {
  const iconMap = {
    auto: "🚗",
    camioneta: "🚙",
    moto: "🛵",
  };

  const iconEl = document.getElementById("occupied-vehicle-icon");
  const labelEl = document.getElementById("occupied-spot-label");
  const plateEl = document.getElementById("occupied-plate");
  const sinceEl = document.getElementById("occupied-since");

  if (iconEl) iconEl.textContent = iconMap[state.vehicle] || "🚗";
  if (labelEl) labelEl.textContent = label;
  if (plateEl) plateEl.textContent = state.plate || "—";

  if (sinceEl) {
    if (state.startTime) {
      sinceEl.textContent = "Desde: " + formatDateTime(state.startTime);
    } else {
      sinceEl.textContent = "Desde: —";
    }
  }

  showModal("occupied-modal");
}

// ================================
//   MODAL 4: FINALIZAR
// ================================
function initFinishModal() {
  const cancelBtn = document.getElementById("finish-cancel");
  const confirmBtn = document.getElementById("finish-confirm");

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      pendingFinish = null;
      hideModal("finish-modal");
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      if (!pendingFinish) return;
      hideModal("finish-modal");
      showModal("charge-modal");
    });
  }
}

function openFinishModal(label, state) {
  const now = Date.now();
  const durationMs = now - (state.startTime || now);

  pendingFinish = {
    label,
    state,
    endTime: now,
    durationMs,
  };

  const spotEl = document.getElementById("finish-spot-label");
  const plateEl = document.getElementById("finish-plate");
  const vehicleEl = document.getElementById("finish-vehicle");
  const startEl = document.getElementById("finish-start");
  const endEl = document.getElementById("finish-end");
  const durationEl = document.getElementById("finish-duration");

  if (spotEl) spotEl.textContent = label;
  if (plateEl) plateEl.textContent = state.plate || "—";
  if (vehicleEl) vehicleEl.textContent = formatVehicle(state.vehicle);
  if (startEl) startEl.textContent = state.startTime ? formatDateTime(state.startTime) : "—";
  if (endEl) endEl.textContent = formatDateTime(now);
  if (durationEl) durationEl.textContent = formatDuration(durationMs);

  showModal("finish-modal");
}

// ================================
//   MODAL 5: ¿CUÁNTO COBRASTE?
// ================================
function initChargeModal() {
  const cancelBtn = document.getElementById("charge-cancel");
  const saveBtn = document.getElementById("charge-save");

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      hideModal("charge-modal");
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (!pendingFinish || !currentSpotLabel || !currentSpotElement) return;

      const input = document.getElementById("charge-input");
      const amount = input ? input.value.trim() : "";

      saveHistoryRecord(pendingFinish, amount);

      delete spotsState[currentSpotLabel];
      applySpotState(currentSpotLabel, currentSpotElement);

      if (input) input.value = "";
      pendingFinish = null;

      hideModal("charge-modal");
    });
  }
}

// ========================
//   MODO MOVER
// ========================
function initMoveBanner() {
  const cancelBtn = document.getElementById("move-cancel");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      cancelMoveMode();
    });
  }
}

function enterMoveMode() {
  const banner = document.getElementById("move-banner");
  if (banner) banner.classList.add("is-visible");
  if (moveSourceElement) {
    moveSourceElement.classList.add("spot-moving-source");
  }
}

function cancelMoveMode() {
  const banner = document.getElementById("move-banner");
  if (banner) banner.classList.remove("is-visible");

  if (moveSourceElement) {
    moveSourceElement.classList.remove("spot-moving-source");
  }

  moveSourceLabel = null;
  moveSourceElement = null;
}

function handleMoveClick(targetLabel, targetElement, targetState) {
  if (targetLabel === moveSourceLabel) {
    cancelMoveMode();
    return;
  }

  if (targetState) {
    alert("Solo puedes mover el vehículo a una plaza libre.");
    return;
  }

  spotsState[targetLabel] = { ...spotsState[moveSourceLabel] };
  delete spotsState[moveSourceLabel];

  applySpotState(targetLabel, targetElement);
  if (moveSourceElement) {
    applySpotState(moveSourceLabel, moveSourceElement);
  }

  cancelMoveMode();
}

// ========================
//   MODALES UTILIDAD
// ========================
function showModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("is-visible");
}

function hideModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("is-visible");
}

// ========================
//   PLAZAS: ACTUALIZAR UI
// ========================
function applySpotState(label, element) {
  const state = spotsState[label];

  element.classList.remove("spot-occupied", "spot-blocked", "spot-moving-source");

  if (!state) {
    element.innerHTML = `
      <div class="spot-letter">P</div>
      <div class="spot-label">${label}</div>
      <div class="spot-status">Libre</div>
    `;
    return;
  }

  if (state.status === "bloqueado") {
    element.classList.add("spot-blocked");
    element.innerHTML = `
      <div class="spot-letter">P</div>
      <div class="spot-label">${label}</div>
      <div class="spot-status">Bloqueado</div>
    `;
  } else if (state.status === "ocupado") {
    element.classList.add("spot-occupied");

    const iconMap = {
      auto: "🚗",
      camioneta: "🚙",
      moto: "🛵",
    };
    const icon = iconMap[state.vehicle] || "🚗";

    element.innerHTML = `
      <div class="spot-icon">${icon}</div>
      <div class="spot-label">${label}</div>
      <div class="spot-status">${state.plate || "Ocupado"}</div>
    `;
  }
}

// ========================
//   FORMATOS FECHA / HORA
// ========================
function formatDateTime(ms) {
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month} ${hours}:${minutes}`;
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}h ${minutes}min`;
}

function formatVehicle(code) {
  switch (code) {
    case "auto":
      return "Auto";
    case "camioneta":
      return "Camioneta";
    case "moto":
      return "Moto";
    default:
      return "-";
  }
}

// ========================
//   HISTORIAL (LOCAL)
// ========================
function saveHistoryRecord(pending, amount) {
  const end = pending.endTime;
  const start = pending.state.startTime || end;
  const dateKey = new Date(end).toISOString().slice(0, 10); // yyyy-mm-dd

  const openedByName =
    pending.state.openedByName || currentUser?.displayName || currentUser?.email || "";
  const closedByName =
    currentUser?.displayName || currentUser?.email || "";

  const record = {
    id: Date.now(),
    dateKey,
    spotLabel: pending.label,
    plate: pending.state.plate,
    vehicle: pending.state.vehicle,
    startTime: start,
    endTime: end,
    durationMs: pending.durationMs,
    amount: amount,
    openedByName,
    closedByName,
  };

  if (firebaseDb) {
    firebaseDb
      .collection("history")
      .add({
        ...record,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      .catch((err) => {
        console.error("Error guardando historial en Firestore:", err);
      });
  }

  const all = loadHistoryRecordsLocal();
  all.push(record);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
}

function loadHistoryRecordsLocal() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error leyendo historial local:", e);
    return [];
  }
}

async function fetchHistoryForDate(dateKey) {
  if (firebaseDb && dateKey) {
    try {
      const snapshot = await firebaseDb
        .collection("history")
        .where("dateKey", "==", dateKey)
        .get();

      const records = [];
        snapshot.forEach((doc) => {
        records.push({ ...doc.data(), _id: doc.id });
      });

      return records;
    } catch (err) {
      console.error("Error leyendo historial de Firestore:", err);
    }
  }

  const allLocal = loadHistoryRecordsLocal();
  return allLocal.filter((r) => r.dateKey === dateKey);
}


// ========================
//   PÁGINA HISTORY.HTML
// ========================
async function initHistory() {
  const listEl = document.getElementById("history-list");
  if (!listEl) return;

  historyListEl = listEl;
  historySummaryTotalEl = document.getElementById("history-total");
  historySummaryDateEl = document.getElementById("history-summary-date");

  const backBtn = document.getElementById("history-back");
  const dateInput = document.getElementById("history-date");

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "parking.html";
    });
  }

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  historyCurrentDateKey = todayKey;

  async function loadAndRender(dateKey) {
    historyCurrentDateKey = dateKey;
    const records = await fetchHistoryForDate(dateKey);
    renderHistoryForDate(dateKey, records, historyListEl, historySummaryTotalEl, historySummaryDateEl);
    initHistoryEditDeleteHandlers();
  }

  if (dateInput) {
    dateInput.value = todayKey;

    dateInput.addEventListener("change", () => {
      const selectedKey = dateInput.value;
      loadAndRender(selectedKey);
    });
  }

  loadAndRender(todayKey);
}
function renderHistoryForDate(dateKey, records, listEl, summaryTotal, summaryDate) {
  const filtered = records || [];
  historyRecordsIndex = {};

  // Resumen
  if (summaryTotal) summaryTotal.textContent = filtered.length;

  if (summaryDate) {
    if (dateKey) {
      const [y, m, d] = dateKey.split("-");
      summaryDate.textContent = `${d}/${m}/${y}`;
    } else {
      summaryDate.textContent = "--/--/----";
    }
  }

  listEl.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No hay registros para este día.";
    empty.style.fontSize = "14px";
    empty.style.color = "#555b88";
    listEl.appendChild(empty);
    return;
  }

  // Ordenar por hora de inicio
  filtered.sort((a, b) => a.startTime - b.startTime);

  filtered.forEach((r) => {
    if (r._id) {
      historyRecordsIndex[r._id] = r;
    }

    const item = document.createElement("article");
    item.classList.add("history-item");

    const start = new Date(r.startTime);
    const end = new Date(r.endTime);

    const startTimeStr = `${String(start.getHours()).padStart(2, "0")}:${String(
      start.getMinutes()
    ).padStart(2, "0")}`;
    const endTimeStr = `${String(end.getHours()).padStart(2, "0")}:${String(
      end.getMinutes()
    ).padStart(2, "0")}`;

    item.innerHTML = `
      <div class="history-item-header">
        Plaza <span class="history-item-plate">${r.spotLabel}</span> - ${r.plate || "-"}
      </div>

      <div class="history-row">
        <span class="icon">⏰</span>
        <span>${startTimeStr} → ${endTimeStr}</span>
      </div>

      <div class="history-row">
        <span class="icon">🕒</span>
        <span>Duración: ${formatDuration(r.durationMs)}</span>
      </div>

      <div class="history-row">
        <span class="icon">🚗</span>
        <span>Tipo: ${formatVehicle(r.vehicle)}</span>
      </div>

      <div class="history-row">
        <span class="icon">🧑</span>
        <span>Ocupó: ${r.openedByName || "—"}</span>
      </div>

      <div class="history-row">
        <span class="icon">🔒</span>
        <span>Cerró: ${r.closedByName || "—"}</span>
      </div>

      <div class="history-row">
        <span class="icon">💲</span>
        <span>Cobro: ${r.amount || 0}</span>
      </div>
    `;

    if (currentUserRole === "admin" && r._id) {
      const actions = document.createElement("div");
      actions.classList.add("history-item-actions");
      actions.innerHTML = `
        <button class="icon-button small history-edit-btn" data-id="${r._id}">✏️</button>
        <button class="icon-button small history-delete-btn" data-id="${r._id}">🗑️</button>
      `;
      item.appendChild(actions);
    }

    listEl.appendChild(item);
  });
}
function initHistoryEditDeleteHandlers() {

  const editButtons = document.querySelectorAll(".history-edit-btn");
  const deleteButtons = document.querySelectorAll(".history-delete-btn");

  editButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      openHistoryEditModal(id);
    });
  });

  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      openHistoryDeleteModal(id);
    });
  });

  // Botones de los modales
  const editCancel = document.getElementById("history-edit-cancel");
  const editSave = document.getElementById("history-edit-save");
  const deleteCancel = document.getElementById("history-delete-cancel");
  const deleteConfirm = document.getElementById("history-delete-confirm");

  if (editCancel) {
    editCancel.onclick = () => {
      currentHistoryRecordId = null;
      hideModal("history-edit-modal");
    };
  }

  if (editSave) {
    editSave.onclick = () => {
      handleHistoryEditSave();
    };
  }

  if (deleteCancel) {
    deleteCancel.onclick = () => {
      currentHistoryRecordId = null;
      hideModal("history-delete-modal");
    };
  }

  if (deleteConfirm) {
    deleteConfirm.onclick = () => {
      handleHistoryDeleteConfirm();
    };
  }
}
function openHistoryEditModal(id) {
  if (!firebaseDb || currentUserRole !== "admin") return;

  const record = historyRecordsIndex[id];
  if (!record) return;

  currentHistoryRecordId = id;

  const plateInput = document.getElementById("history-edit-plate");
  const vehicleSelect = document.getElementById("history-edit-vehicle");
  const amountInput = document.getElementById("history-edit-amount");

  if (plateInput) plateInput.value = record.plate || "";
  if (vehicleSelect) vehicleSelect.value = record.vehicle || "auto";
  if (amountInput) amountInput.value = record.amount || "";

  showModal("history-edit-modal");
}

function openHistoryDeleteModal(id) {
  if (!firebaseDb || currentUserRole !== "admin") return;

  const record = historyRecordsIndex[id];
  if (!record) return;

  currentHistoryRecordId = id;
  showModal("history-delete-modal");
}
function handleHistoryDeleteConfirm() {
  if (!firebaseDb) {
    alert("No se pudo conectar con la base de datos.");
    return;
  }
  if (!currentHistoryRecordId) {
    alert("No se encontró el registro a eliminar.");
    return;
  }

  firebaseDb
    .collection("history")
    .doc(currentHistoryRecordId)
    .delete()
    .then(async () => {
      hideModal("history-delete-modal");
      currentHistoryRecordId = null;

      if (historyCurrentDateKey && historyListEl) {
        const records = await fetchHistoryForDate(historyCurrentDateKey);
        renderHistoryForDate(
          historyCurrentDateKey,
          records,
          historyListEl,
          historySummaryTotalEl,
          historySummaryDateEl
        );
        initHistoryEditDeleteHandlers();
      }
    })
    .catch((err) => {
      console.error("Error eliminando registro:", err);
      alert("No se pudo eliminar el registro.");
    });
}

function handleHistoryEditSave() {
  if (!firebaseDb) {
    alert("No se pudo conectar con la base de datos.");
    return;
  }
  if (!currentHistoryRecordId) {
    alert("No se encontró el registro a editar.");
    return;
  }

  const plateInput = document.getElementById("history-edit-plate");
  const vehicleSelect = document.getElementById("history-edit-vehicle");
  const amountInput = document.getElementById("history-edit-amount");

  const newPlate = plateInput ? plateInput.value.trim() : "";
  const newVehicle = vehicleSelect ? vehicleSelect.value : "auto";
  const newAmount = amountInput ? amountInput.value.trim() : "";

  firebaseDb
    .collection("history")
    .doc(currentHistoryRecordId)
    .update({
      plate: newPlate,
      vehicle: newVehicle,
      amount: newAmount,
    })
    .then(async () => {
      hideModal("history-edit-modal");
      currentHistoryRecordId = null;

      if (historyCurrentDateKey && historyListEl) {
        const records = await fetchHistoryForDate(historyCurrentDateKey);
        renderHistoryForDate(
          historyCurrentDateKey,
          records,
          historyListEl,
          historySummaryTotalEl,
          historySummaryDateEl
        );
        initHistoryEditDeleteHandlers();
      }
    })
    .catch((err) => {
      console.error("Error actualizando registro:", err);
      alert("No se pudo guardar los cambios.");
    });
}
