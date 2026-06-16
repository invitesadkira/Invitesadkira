// ===================== DATA STORE =====================
const Store = {
  users: [], // ⚠️ NUNCA armazenar senhas no frontend!
  events: [],
  currentUser: null, // Apenas { id, phone, role } - SEM PASSWORD
  currentEventId: null,
  countdownInterval: null,
  adminModeActive: false,
  adminOriginalUser: null,
  guestResponses: {},
  currentGuestSession: null
};
