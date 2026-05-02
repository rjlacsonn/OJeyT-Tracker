/* ============================================================
   APP - OJeyT Tracker
   ============================================================ */

let currentUser = null;
let allSessions = [];
let currentPage = 'login';

const RING_CIRCUMFERENCE = 364.42;
const THEME_KEY = 'ojeyt-theme';
let currentTheme = 'light';

function applyTheme(theme) {
  currentTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = currentTheme;
  localStorage.setItem(THEME_KEY, currentTheme);
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) toggleBtn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
}

function loadThemePreference() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const theme = savedTheme === 'dark' ? 'dark' : 'light';
  applyTheme(theme);
}

function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

function navTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) targetPage.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  currentPage = page;
  if (page === 'dashboard') updateDashboard();
  if (page === 'history') renderHistoryPage();
  if (page === 'settings') renderSettingsPage();
}

function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function showAuthHelp() {
  showToast('Create an account with your email and password. If Supabase email confirmation is on, confirm your email before signing in.');
}

function setFormError(id, message = '') {
  const errorEl = document.getElementById(id);
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.toggle('is-visible', Boolean(message));
}

function clearAuthErrors() {
  setFormError('login-error');
  setFormError('signup-error');
}

function setButtonLoading(button, isLoading, loadingText) {
  if (!button) return;

  button.disabled = isLoading;
  button.classList.toggle('is-loading', isLoading);
  if (isLoading) {
    button.dataset.loadingHtml = button.innerHTML;
    button.textContent = loadingText;
  } else {
    button.innerHTML = button.dataset.loadingHtml || button.innerHTML;
    delete button.dataset.loadingHtml;
  }
}

function truncateEmail(email) {
  if (!email) return '';
  return email.length > 18 ? `${email.slice(0, 14)}...` : email;
}

function getFirstName(fullName) {
  return (fullName || 'User').trim().split(/\s+/)[0];
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, seconds || 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.round((safeSeconds % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatTimeRange(session) {
  const start = new Date(session.startTime);
  const end = session.endTime ? new Date(session.endTime) : null;
  const timeOptions = { hour: '2-digit', minute: '2-digit' };
  const startText = start.toLocaleTimeString([], timeOptions);
  const endText = end ? end.toLocaleTimeString([], timeOptions) : 'Active';
  return `${startText} — ${endText}`;
}

function completedSessions() {
  return allSessions.filter(session => !session.isActive);
}

function groupedSessions(sessions) {
  return sessions.reduce((groups, session) => {
    const date = new Date(session.startTime);
    const key = date.toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    if (!groups[key]) groups[key] = [];
    groups[key].push(session);
    return groups;
  }, {});
}

function showAuthUI(target = 'login') {
  document.getElementById('topbar-container').style.display = 'none';
  document.getElementById('main-content-container').style.display = 'none';
  navTo(target);
}

function showAppUI() {
  document.getElementById('topbar-container').style.display = '';
  document.getElementById('main-content-container').style.display = '';
  document.getElementById('user-email-short').textContent = truncateEmail(currentUser.email);
  navTo('dashboard');
}

function resetSessionUI() {
  Timer.stop();
  document.getElementById('status-badge').textContent = 'Ready to start';
  document.getElementById('btn-label').textContent = 'Check In';
  document.getElementById('timer-display').textContent = '00:00:00';
  document.getElementById('main-btn').classList.remove('is-active');
  document.getElementById('main-btn').setAttribute('aria-label', 'Check in');
  const icon = document.querySelector('#main-btn .btn-icon');
  if (icon) icon.textContent = '↪';
  document.getElementById('location-status').style.display = 'none';
  document.getElementById('timer-controls').style.display = 'none';
  document.getElementById('session-note-row').style.display = 'none';
  resetSessionNote();
}

function showResetConfirmation() {
  document.getElementById('reset-confirmation-modal').style.display = 'grid';
}

function closeResetConfirmation() {
  document.getElementById('reset-confirmation-modal').style.display = 'none';
}

async function confirmReset() {
  closeResetConfirmation();
  const result = await API.resetSession(auth.getToken());
  if (!result.success) {
    showToast(result.message || 'Unable to reset timer');
    return;
  }
  startTimer(result.session.startTime);
  document.getElementById('timer-display').textContent = '00:00:00';
  document.getElementById('status-badge').textContent = 'Session in progress';
  document.getElementById('timer-display').classList.remove('is-paused');
  showToast('Session timer reset');
}

function togglePause(forcePause = false) {
  const pauseBtn = document.getElementById('pause-resume-btn');
  if (!pauseBtn) return;
  if (Timer.getIsPaused() || forcePause) {
    Timer.resume(formatted => {
      document.getElementById('timer-display').textContent = formatted;
    });
    pauseBtn.textContent = '⏸ Pause';
    document.getElementById('status-badge').textContent = 'Session in progress';
    document.getElementById('timer-display').classList.remove('is-paused');
    return;
  }

  Timer.pause();
  pauseBtn.textContent = '▶ Resume';
  document.getElementById('status-badge').textContent = 'Paused';
  document.getElementById('timer-display').classList.add('is-paused');
}

function updateTimerControlState() {
  document.getElementById('timer-controls').style.display = 'grid';
  document.getElementById('session-note-row').style.display = 'grid';
  const pauseBtn = document.getElementById('pause-resume-btn');
  if (Timer.getIsPaused()) {
    pauseBtn.textContent = '▶ Resume';
    document.getElementById('status-badge').textContent = 'Paused';
    document.getElementById('timer-display').classList.add('is-paused');
  } else {
    pauseBtn.textContent = '⏸ Pause';
    document.getElementById('status-badge').textContent = 'Session in progress';
    document.getElementById('timer-display').classList.remove('is-paused');
  }
}

function resetSessionNote() {
  const noteInput = document.getElementById('session-note');
  if (noteInput) noteInput.value = '';
}

async function initializeApp() {
  loadThemePreference();
  setupEventListeners();

  if (auth.isAuthenticated) {
    await loadUserData();
    if (currentUser) {
      await resumeActiveSession();
      showAppUI();
      return;
    }
  }

  showAuthUI('login');
}

async function loadUserData() {
  const user = await auth.refreshUser();
  if (!user) {
    currentUser = null;
    return;
  }

  currentUser = user;
  await loadAllSessions();
  updateDashboard();
}

async function loadAllSessions() {
  const result = await API.getSessions(auth.getToken());
  allSessions = result.success ? (result.sessions || []) : [];
}

function setupEventListeners() {
  document.getElementById('show-signup')?.addEventListener('click', (e) => {
    e.preventDefault();
    clearAuthErrors();
    showAuthUI('signup');
  });

  document.getElementById('show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    clearAuthErrors();
    showAuthUI('login');
  });

  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthErrors();
    const submitBtn = document.getElementById('login-submit');
    setButtonLoading(submitBtn, true, 'Signing in...');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const result = await auth.login(email, password);

      if (!result.success) {
        setFormError('login-error', result.message || 'Login failed');
        return;
      }

      await loadUserData();
      await resumeActiveSession();
      showAppUI();
      showToast('Logged in successfully');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthErrors();
    const submitBtn = document.getElementById('signup-submit');
    setButtonLoading(submitBtn, true, 'Creating account...');
    const fullName = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm').value;
    const requiredHours = parseInt(document.getElementById('signup-required-hours').value, 10);

    try {
      const result = await auth.signup(fullName, email, password, confirmPassword, requiredHours);

      if (!result.success) {
        setFormError('signup-error', result.message || 'Signup failed');
        return;
      }

      await loadUserData();
      await resumeActiveSession();
      showAppUI();
      e.target.reset();
      showToast('Account created');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  document.getElementById('dtr-include-signature')?.addEventListener('change', (e) => {
    toggleSignatureSection(e.target.checked);
  });
}

function exportHistory() {
  const sessions = completedSessions();
  if (!sessions.length) {
    showToast('No session history to export');
    return;
  }

  const headers = ['Date', 'Check-in Time', 'Check-out Time', 'Duration', 'Session Note'];
  const rows = sessions.map(session => {
    const start = new Date(session.startTime);
    const end = session.endTime ? new Date(session.endTime) : null;
    const date = start.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    const timeIn = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timeOut = end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active';
    return [date, timeIn, timeOut, formatDuration(session.duration), session.notes || ''];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ojeyt_history_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Session history exported');
}

// === DTR MODAL ===
function openDTRModal() {
  document.getElementById('dtr-modal').style.display = 'grid';
  // Pre-fill with user data if available
  const user = currentUser;
  if (user) {
    document.getElementById('dtr-full-name').value = user.fullName || '';
  }
}

function closeDTRModal() {
  document.getElementById('dtr-modal').style.display = 'none';
  document.getElementById('dtr-form').reset();
  toggleSignatureSection(false);
}

function toggleSignatureSection(show) {
  const section = document.getElementById('signature-section');
  if (show) {
    section.style.display = 'grid';
    section.classList.remove('hidden');
  } else {
    section.classList.add('hidden');
    setTimeout(() => section.style.display = 'none', 300);
  }
}

// === VALIDATION ===
function validateDTRForm() {
  const requiredFields = [
    'dtr-full-name', 'dtr-school', 'dtr-department', 'dtr-company', 'dtr-position'
  ];
  let valid = true;
  requiredFields.forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.style.borderColor = '#c0392b';
      valid = false;
    } else {
      el.style.borderColor = '#e5eaf2';
    }
  });
  if (document.getElementById('dtr-include-signature').checked) {
    const sigFields = ['dtr-supervisor-name', 'dtr-supervisor-title'];
    sigFields.forEach(id => {
      const el = document.getElementById(id);
      if (!el.value.trim()) {
        el.style.borderColor = '#c0392b';
        valid = false;
      } else {
        el.style.borderColor = '#e5eaf2';
      }
    });
  }
  return valid;
}

// === PDF PRINT ===
function exportDTR(type) {
  if (!validateDTRForm()) {
    showToast('Please fill in all required fields');
    return;
  }

  const data = getDTRData();
  if (type === 'print') {
    generateDTRPrint(data);
  } else if (type === 'csv') {
    generateDTRCSV(data);
  } else if (type === 'excel') {
    generateDTRExcel(data);
  }
}

function getDTRData() {
  return {
    fullName: document.getElementById('dtr-full-name').value.trim(),
    school: document.getElementById('dtr-school').value.trim(),
    department: document.getElementById('dtr-department').value.trim(),
    company: document.getElementById('dtr-company').value.trim(),
    position: document.getElementById('dtr-position').value.trim(),
    includeSignature: document.getElementById('dtr-include-signature').checked,
    supervisorName: document.getElementById('dtr-supervisor-name').value.trim(),
    supervisorTitle: document.getElementById('dtr-supervisor-title').value.trim(),
    sessions: completedSessions()
  };
}

function generateDTRPrint(data) {
  const printWindow = window.open('', '_blank');
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>DTR - ${data.fullName}</title>
      <style>
        body { font-family: serif; margin: 20px; }
        .header { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 20px; }
        h1 { text-align: center; margin: 20px 0; }
        .info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 8px; text-align: center; }
        .total { font-weight: bold; }
        .signature { margin-top: 40px; }
        .signature div { display: inline-block; width: 45%; margin-right: 10%; vertical-align: top; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <span>${new Date().toLocaleString()}</span>
        <span>DTR - ${data.fullName}</span>
      </div>
      <h1>DAILY TIME RECORD<br>On-the-Job Training</h1>
      <div class="info">
        <div>Name: ${data.fullName}</div>
        <div>Company: ${data.company}</div>
        <div>School: ${data.school}</div>
        <div>Position: ${data.position}</div>
        <div>Department / Course: ${data.department}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Time In - Out</th>
            <th>Hours</th>
          </tr>
        </thead>
        <tbody>
          ${data.sessions.map(s => {
            const start = new Date(s.startTime);
            const end = new Date(s.endTime);
            const date = start.toISOString().slice(0,10);
            const timeIn = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const timeOut = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const hours = (s.duration / 3600).toFixed(2);
            return `<tr><td>${date}</td><td>${timeIn} - ${timeOut}</td><td>${hours}</td></tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" class="total">Total Hours:</td>
            <td class="total">${data.sessions.reduce((sum, s) => sum + s.duration / 3600, 0).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      ${data.includeSignature ? `
        <div class="signature">
          <p>Certified Correct:</p>
          <div>
            _______________________________<br>
            ${data.supervisorName}<br>
            ${data.supervisorTitle}
          </div>
          <div>
            _______________________________<br>
            Intern Signature<br>
            Date: _______________
          </div>
        </div>
      ` : ''}
    </body>
    </html>
  `;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
}

// === CSV EXPORT ===
function generateDTRCSV(data) {
  const rows = [
    ['DAILY TIME RECORD - OJT'],
    ['Name:', data.fullName],
    ['School:', data.school],
    ['Department/Course:', data.department],
    ['Company:', data.company],
    ['Position:', data.position],
    [''],
    ['Date', 'Time In', 'Time Out', 'Hours'],
    ...data.sessions.map(s => {
      const start = new Date(s.startTime);
      const end = new Date(s.endTime);
      const date = start.toISOString().slice(0,10);
      const timeIn = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const timeOut = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const hours = (s.duration / 3600).toFixed(2);
      return [date, timeIn, timeOut, hours];
    }),
    ['', '', '', ''],
    ['Total Hours:', '', '', data.sessions.reduce((sum, s) => sum + s.duration / 3600, 0).toFixed(2)]
  ];

  const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `DTR_${data.fullName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  closeDTRModal();
  showToast('DTR CSV exported');
}

// === EXCEL EXPORT ===
function generateDTRExcel(data) {
  const wsData = [
    ['DAILY TIME RECORD - OJT'],
    ['Name:', data.fullName],
    ['School:', data.school],
    ['Department/Course:', data.department],
    ['Company:', data.company],
    ['Position:', data.position],
    [''],
    ['Date', 'Time In', 'Time Out', 'Hours'],
    ...data.sessions.map(s => {
      const start = new Date(s.startTime);
      const end = new Date(s.endTime);
      const date = start.toISOString().slice(0,10);
      const timeIn = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const timeOut = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const hours = (s.duration / 3600).toFixed(2);
      return [date, timeIn, timeOut, hours];
    }),
    ['', '', '', ''],
    ['Total Hours:', '', '', data.sessions.reduce((sum, s) => sum + s.duration / 3600, 0).toFixed(2)]
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  // Apply bold
  const boldCells = ['A1', 'A8', 'D' + (wsData.length)];
  boldCells.forEach(cell => {
    if (ws[cell]) ws[cell].s = { font: { bold: true } };
  });
  // Column widths
  ws['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DTR');
  XLSX.writeFile(wb, `DTR_${data.fullName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
  closeDTRModal();
  showToast('DTR Excel exported');
}

function logout() {
  auth.logout();
  currentUser = null;
  allSessions = [];
  resetSessionUI();
  showAuthUI('login');
  showToast('Logged out');
}

async function saveSettings() {
  const saveBtn = document.getElementById('save-settings-btn');
  setButtonLoading(saveBtn, true, 'Saving...');
  const fullName = document.getElementById('settings-name-input').value.trim() || currentUser.fullName;
  const requiredHours = parseInt(document.getElementById('required-hours').value, 10) || 200;
  const latitude = parseFloat(document.getElementById('office-lat').value);
  const longitude = parseFloat(document.getElementById('office-lon').value);
  const radius = parseInt(document.getElementById('office-radius').value, 10) || 100;
  const autoCheckIn = document.getElementById('auto-checkin').checked;

  try {
    const result = await API.updateSettings(auth.getToken(), {
      fullName,
      requiredHours,
      officeLocation: {
        latitude: Number.isFinite(latitude) ? latitude : 14.5995,
        longitude: Number.isFinite(longitude) ? longitude : 120.9842,
        radius,
      },
      autoCheckIn,
    });

    if (!result.success) {
      showToast(result.message || 'Error saving settings');
      return;
    }

    currentUser = result.user;
    auth.setUser(result.user);
    updateDashboard();
    showToast('Settings saved');
    navTo('dashboard');
  } finally {
    setButtonLoading(saveBtn, false);
  }
}

function toggleSession() {
  if (Timer.isRunning()) {
    checkOut();
  } else {
    getLocationForCheckin();
  }
}

function getLocationForCheckin() {
  if (!navigator.geolocation) {
    checkIn(0, 0);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => checkIn(position.coords.latitude, position.coords.longitude),
    () => checkIn(0, 0),
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

async function checkIn(latitude, longitude) {
  const mainBtn = document.getElementById('main-btn');
  let result = null;
  setButtonLoading(mainBtn, true, '...');
  try {
    result = await API.checkIn(auth.getToken(), latitude, longitude);
  } finally {
    setButtonLoading(mainBtn, false);
  }

  if (!result?.success) {
    showToast(result?.message || 'Check-in failed');
    return;
  }

  startTimer(result.session.startTime);
  showToast(result.message || 'Checked in');
}

function checkOut() {
  if (!navigator.geolocation) {
    completeCheckout(0, 0);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => completeCheckout(position.coords.latitude, position.coords.longitude),
    () => completeCheckout(0, 0),
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

async function completeCheckout(latitude, longitude) {
  const mainBtn = document.getElementById('main-btn');
  const note = document.getElementById('session-note')?.value.trim() || undefined;
  let result = null;
  setButtonLoading(mainBtn, true, '...');
  try {
    result = await API.checkOut(auth.getToken(), latitude, longitude, note);
  } finally {
    setButtonLoading(mainBtn, false);
  }

  if (!result?.success) {
    showToast(result?.message || 'Check-out failed');
    return;
  }

  resetSessionUI();
  await loadAllSessions();
  updateDashboard();
  if (currentPage === 'history') renderHistoryPage();
  showToast('Checked out successfully');
}

async function resumeActiveSession() {
  const result = await API.getCurrentSession(auth.getToken());
  if (!result.success || !result.session) {
    resetSessionUI();
    return;
  }
  startTimer(result.session.startTime);
}

function startTimer(startTime) {
  Timer.start(startTime, formatted => {
    document.getElementById('timer-display').textContent = formatted;
  });
  document.getElementById('status-badge').textContent = 'Session in progress';
  document.getElementById('btn-label').textContent = 'Check Out';
  document.getElementById('main-btn').classList.add('is-active');
  document.getElementById('main-btn').setAttribute('aria-label', 'Check out');
  const icon = document.querySelector('#main-btn .btn-icon');
  if (icon) icon.textContent = '⇥';
  updateTimerControlState();
}

function renderBackendStatus() {
  const card = document.getElementById('backend-status-card');
  const title = document.getElementById('backend-status-title');
  const detail = document.getElementById('backend-status-detail');
  if (!card || !title || !detail) return;

  const connected = API.isSupabaseConfigured();
  card.classList.toggle('is-connected', connected);
  card.classList.toggle('is-fallback', !connected);
  title.textContent = connected ? 'Supabase connected' : 'Local fallback active';
  detail.textContent = connected
    ? 'The app is sending auth, profile, and session data to your Supabase project.'
    : 'Supabase URL/key are not set yet, so the app is using the local Express fallback.';
}

function updateDashboard() {
  if (!currentUser) return;

  const sessions = completedSessions();
  const totalSeconds = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
  const totalHours = totalSeconds / 3600;
  const requiredHours = currentUser.requiredHours || 200;
  const remainingHours = Math.max(0, requiredHours - totalHours);
  const percentage = requiredHours > 0 ? Math.min(Math.round((totalHours / requiredHours) * 100), 100) : 0;
  const uniqueDays = new Set(sessions.map(session => new Date(session.startTime).toDateString())).size;

  document.getElementById('greeting-msg').textContent = `Hello, ${getFirstName(currentUser.fullName)}`;
  document.getElementById('progress-percent').textContent = `${percentage}%`;
  document.getElementById('hours-rendered').textContent = `${totalHours.toFixed(1)} / ${requiredHours} hrs`;
  document.getElementById('hours-remaining').textContent = `${remainingHours.toFixed(0)}h`;
  document.getElementById('stat-total-days').textContent = uniqueDays;
  document.getElementById('stat-total-hours').textContent = `${totalHours.toFixed(0)}h`;

  const offset = RING_CIRCUMFERENCE - (percentage / 100) * RING_CIRCUMFERENCE;
  document.getElementById('progress-circle-fill').style.strokeDashoffset = offset;

  const estimateText = () => {
    if (remainingHours <= 0) return 'Target reached — great work!';
    if (uniqueDays < 2 || totalHours <= 0) return 'Log more sessions to see your estimated finish date.';
    const averageDaily = totalHours / uniqueDays;
    if (averageDaily <= 0) return 'Log more sessions to see your estimated finish date.';
    const daysLeft = Math.ceil(remainingHours / averageDaily);
    const finishDate = new Date();
    finishDate.setDate(finishDate.getDate() + daysLeft);
    return finishDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  document.getElementById('estimated-finish').textContent = estimateText();
  renderWeeklyChart();
  renderRecentSessions();
}

function renderWeeklyChart() {
  const container = document.getElementById('weekly-hours-chart');
  const week = [];
  const today = new Date();
  const dayIndex = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayIndex);
  monday.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i += 1) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    week.push({
      label: date.toLocaleDateString([], { weekday: 'short' }),
      date,
      seconds: 0,
    });
  }

  completedSessions().forEach(session => {
    const start = new Date(session.startTime);
    week.forEach(day => {
      if (start.toDateString() === day.date.toDateString()) {
        day.seconds += session.duration || 0;
      }
    });
  });

  const maxSeconds = Math.max(...week.map(day => day.seconds), 3600);
  container.innerHTML = week.map(day => {
    const hours = (day.seconds / 3600).toFixed(1);
    const width = maxSeconds > 0 ? Math.round((day.seconds / maxSeconds) * 100) : 0;
    return `
      <div class="chart-row">
        <span class="chart-label">${day.label}</span>
        <div class="chart-bar">
          <div class="chart-fill" style="width:${width}%"></div>
        </div>
        <span class="chart-value">${hours}h</span>
      </div>
    `;
  }).join('');
}

function renderRecentSessions() {
  const container = document.getElementById('recent-sessions');
  const sessions = completedSessions().slice(0, 3);

  if (!sessions.length) {
    container.innerHTML = '<p class="empty-state">No sessions yet. Check in to start tracking.</p>';
    return;
  }

  container.innerHTML = sessions.map(renderSessionItem).join('');
}

function renderSessionItem(session) {
  const start = new Date(session.startTime);
  const dateText = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `
    <div class="session-item">
      <div class="session-icon">▣</div>
      <div class="session-meta">
        <strong>${dateText}</strong>
        <span>${formatTimeRange(session)}</span>
        ${session.notes ? `<span class="session-note">${session.notes}</span>` : ''}
      </div>
      <div class="session-duration">${formatDuration(session.duration)}</div>
    </div>
  `;
}

function renderHistoryPage() {
  const sessions = completedSessions();
  const totalSeconds = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
  const uniqueDays = new Set(sessions.map(session => new Date(session.startTime).toDateString())).size;
  const averageHours = uniqueDays ? (totalSeconds / 3600 / uniqueDays) : 0;
  const activeCount = allSessions.filter(session => session.isActive).length;

  document.getElementById('history-days').textContent = uniqueDays;
  document.getElementById('history-hours').textContent = `${(totalSeconds / 3600).toFixed(0)}h`;
  document.getElementById('history-average').textContent = `${averageHours.toFixed(1)}h`;
  document.getElementById('history-active').textContent = activeCount;

  const container = document.getElementById('all-sessions');
  if (!sessions.length) {
    container.innerHTML = '<p class="empty-state">No sessions found.</p>';
    return;
  }

  const groups = groupedSessions(sessions);
  container.innerHTML = Object.entries(groups).map(([day, daySessions]) => `
    <section class="history-day">
      <h2 class="history-day-title">${day}</h2>
      ${daySessions.map(renderSessionItem).join('')}
    </section>
  `).join('');
}

function renderSettingsPage() {
  if (!currentUser) return;
  const office = currentUser.officeLocation || {};

  // Backend status UI removed - Supabase details hidden from user view
  document.getElementById('settings-name-input').value = currentUser.fullName || '';
  document.getElementById('required-hours').value = currentUser.requiredHours || 200;
  document.getElementById('office-lat').value = office.latitude ?? 14.5995;
  document.getElementById('office-lon').value = office.longitude ?? 120.9842;
  document.getElementById('office-radius').value = office.radius ?? 100;
  document.getElementById('auto-checkin').checked = !!currentUser.autoCheckIn;
}

document.addEventListener('DOMContentLoaded', initializeApp);
