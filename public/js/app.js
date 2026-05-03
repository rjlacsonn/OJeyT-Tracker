/* ============================================================
   APP - OJeyT Tracker (Supabase Edition)
   ============================================================ */

let currentUser = null;
let allShifts = [];
let currentPage = 'login';
let editingShiftId = null;

const RING_CIRCUMFERENCE = 364.42;
const THEME_KEY = 'ojeyt-theme';
let currentTheme = 'light';

// === THEME ===
function applyTheme(theme) {
  currentTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = currentTheme;
  localStorage.setItem(THEME_KEY, currentTheme);
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) toggleBtn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
}

function loadThemePreference() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  applyTheme(savedTheme === 'dark' ? 'dark' : 'light');
}

function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

// === NAVIGATION ===
function navTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) targetPage.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  currentPage = page;
  if (page === 'dashboard') {
    updateDashboard();
    setDefaultShiftDate();
  }
  if (page === 'history') renderHistoryPage();
  if (page === 'settings') renderSettingsPage();
}

// === TOAST ===
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// === AUTH UI HELPERS ===
function showAuthHelp() {
  showToast('Create an account with your email and password. Confirm your email before signing in if required.');
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

// === SHOW/HIDE APP ===
function showAuthUI(target = 'login') {
  document.getElementById('topbar-container').style.display = 'none';
  document.getElementById('main-content-container').style.display = 'none';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const targetPage = document.getElementById(`page-${target}`);
  if (targetPage) targetPage.classList.add('active');
  currentPage = target;
}

function showAppUI() {
  document.getElementById('topbar-container').style.display = '';
  document.getElementById('main-content-container').style.display = '';
  const emailEl = document.getElementById('user-email-short');
  if (emailEl) emailEl.textContent = truncateEmail(currentUser?.email || '');
  navTo('dashboard');
}

// === LOGOUT ===
async function logout() {
  await auth.logout();
  currentUser = null;
  allShifts = [];
  showAuthUI('login');
  showToast('Logged out');
}

// === LOAD DATA ===
async function loadUserData() {
  const user = await auth.refreshUser();
  if (!user) {
    currentUser = null;
    return;
  }
  currentUser = user;

  // ===== LOAD PROFILE FROM SUPABASE =====
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profile) {
    currentUser.fullName = profile.full_name;
    currentUser.requiredHours = profile.required_hours || 200;
  } else {
    currentUser.fullName = user.user_metadata?.full_name || '';
    currentUser.requiredHours = user.user_metadata?.required_hours || 200;
  }

  await loadAllShifts();
  updateDashboard();
}

// === SHIFTS (SUPABASE) ===
async function loadAllShifts() {
  if (!currentUser) return;
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('date', { ascending: false });

  if (error) {
    console.error('Load shifts error:', error);
    allShifts = [];
  } else {
    allShifts = data || [];
  }
}

// === SHIFT FORM ===
function setDefaultShiftDate() {
  const dateInput = document.getElementById('shift-date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
}

function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const cleanStart = String(startTime).slice(0, 5);
  const cleanEnd = String(endTime).slice(0, 5);
  const start = new Date(`1970-01-01T${cleanStart}:00`);
  const end = new Date(`1970-01-01T${cleanEnd}:00`);
  if (isNaN(start) || isNaN(end) || end <= start) return 0;
  return (end - start) / (1000 * 60 * 60);
}

function updateShiftDurations() {
  const morningIn = String(document.getElementById('morning-in')?.value || '').slice(0, 5);
  const morningOut = String(document.getElementById('morning-out')?.value || '').slice(0, 5);
  const afternoonIn = String(document.getElementById('afternoon-in')?.value || '').slice(0, 5);
  const afternoonOut = String(document.getElementById('afternoon-out')?.value || '').slice(0, 5);
  const overtimeStart = String(document.getElementById('overtime-start')?.value || '').slice(0, 5);
  const overtimeEnd = String(document.getElementById('overtime-end')?.value || '').slice(0, 5);

  const morningDuration = calculateDuration(morningIn, morningOut);
  const afternoonDuration = calculateDuration(afternoonIn, afternoonOut);
  const overtimeDuration = calculateDuration(overtimeStart, overtimeEnd);
  const totalDuration = morningDuration + afternoonDuration + overtimeDuration;

  const morningEl = document.getElementById('morning-duration');
  const afternoonEl = document.getElementById('afternoon-duration');
  const overtimeEl = document.getElementById('overtime-duration');
  const totalEl = document.getElementById('total-duration');

  if (morningEl) morningEl.textContent = `${morningDuration.toFixed(2)} hrs`;
  if (afternoonEl) afternoonEl.textContent = `${afternoonDuration.toFixed(2)} hrs`;
  if (overtimeEl) overtimeEl.textContent = `${overtimeDuration.toFixed(2)} hrs`;
  if (totalEl) totalEl.textContent = `${totalDuration.toFixed(2)} hours`;
}

async function saveShift() {
  const date = document.getElementById('shift-date')?.value;
  const morningIn = String(document.getElementById('morning-in')?.value || '').slice(0, 5);
  const morningOut = String(document.getElementById('morning-out')?.value || '').slice(0, 5);

  if (!date || !morningIn || !morningOut) {
    showToast('Please fill in date, morning clock-in, and clock-out times');
    return;
  }

  const afternoonIn = String(document.getElementById('afternoon-in')?.value || '').slice(0, 5) || null;
  const afternoonOut = String(document.getElementById('afternoon-out')?.value || '').slice(0, 5) || null;
  const overtimeStart = String(document.getElementById('overtime-start')?.value || '').slice(0, 5) || null;
  const overtimeEnd = String(document.getElementById('overtime-end')?.value || '').slice(0, 5) || null;

  const morningHours = calculateDuration(morningIn, morningOut);
  const afternoonHours = calculateDuration(afternoonIn, afternoonOut);
  const overtimeHours = calculateDuration(overtimeStart, overtimeEnd);
  const totalHours = morningHours + afternoonHours + overtimeHours;

  const shiftPayload = {
    date: date,
    morning_in: morningIn,
    morning_out: morningOut,
    afternoon_in: afternoonIn || null,
    afternoon_out: afternoonOut || null,
    overtime_start: overtimeStart || null,
    overtime_end: overtimeEnd || null,
    total_hours: totalHours
  };

  let saveError;

  if (editingShiftId) {
    console.log('=== UPDATING shift:', editingShiftId, shiftPayload);

    const { data, error } = await supabase
      .from('shifts')
      .update(shiftPayload)
      .eq('id', editingShiftId)
      .eq('user_id', currentUser.id)
      .select();

    console.log('=== UPDATE result data:', data, 'error:', error);
    saveError = error;
    editingShiftId = null;

  } else {
    console.log('=== INSERTING new shift:', shiftPayload);

    const { data, error } = await supabase
      .from('shifts')
      .insert({ ...shiftPayload, user_id: currentUser.id })
      .select();

    console.log('=== INSERT result data:', data, 'error:', error);
    saveError = error;
  }

  if (saveError) {
    showToast('Failed to save shift: ' + saveError.message);
    console.error('Save error:', saveError);
    return;
  }

  showToast(`✅ Shift saved — ${totalHours.toFixed(2)} hrs logged`);
  document.getElementById('shift-form')?.reset();

  const saveBtn = document.getElementById('save-shift-btn');
  if (saveBtn) saveBtn.textContent = 'Save Shift';

  setDefaultShiftDate();
  updateShiftDurations();
  await loadAllShifts();
  updateDashboard();
}

// === SHIFT HISTORY TABLE ===
function renderShiftHistory() {
  const container = document.getElementById('shift-history-body');
  if (!container) return;

  const filterDate = document.getElementById('shift-filter-date')?.value;
  let shiftsToShow = [...allShifts];

  if (filterDate) {
    shiftsToShow = shiftsToShow.filter(shift => shift.date === filterDate);
  }

  shiftsToShow.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!shiftsToShow.length) {
    container.innerHTML = '<p class="empty-state">No shifts found. Log your first shift above.</p>';
    return;
  }

  // ===== HELPER: FORMAT TIME FROM HH:MM:SS TO HH:MM AM/PM =====
  function formatTime(t) {
    if (!t) return null;
    const clean = String(t).slice(0, 5);
    const [h, m] = clean.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
  }

  // ===== HELPER: CALCULATE DURATION FROM SUPABASE TIME =====
  function calcHrs(start, end) {
    if (!start || !end) return null;
    const s = String(start).slice(0, 5);
    const e = String(end).slice(0, 5);
    const startD = new Date(`1970-01-01T${s}:00`);
    const endD = new Date(`1970-01-01T${e}:00`);
    if (isNaN(startD) || isNaN(endD) || endD <= startD) return null;
    return ((endD - startD) / (1000 * 60 * 60)).toFixed(2);
  }

  container.innerHTML = shiftsToShow.map(shift => {
    const morningHrs = calcHrs(shift.morning_in, shift.morning_out);
    const afternoonHrs = calcHrs(shift.afternoon_in, shift.afternoon_out);
    const overtimeHrs = calcHrs(shift.overtime_start, shift.overtime_end);

    const morningDisplay = morningHrs
      ? `${formatTime(shift.morning_in)} - ${formatTime(shift.morning_out)}<br><small>(${morningHrs} hrs)</small>`
      : '—';

    const afternoonDisplay = afternoonHrs
      ? `${formatTime(shift.afternoon_in)} - ${formatTime(shift.afternoon_out)}<br><small>(${afternoonHrs} hrs)</small>`
      : '—';

    const overtimeDisplay = overtimeHrs
      ? `${formatTime(shift.overtime_start)} - ${formatTime(shift.overtime_end)}<br><small>(${overtimeHrs} hrs)</small>`
      : '—';

    return `
      <div class="shift-row">
        <div class="shift-date">${new Date(shift.date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        <div class="time-range">${morningDisplay}</div>
        <div class="time-range">${afternoonDisplay}</div>
        <div class="time-range">${overtimeDisplay}</div>
        <div class="total-hours"><strong>${(shift.total_hours || 0).toFixed(2)} hrs</strong></div>
        <div class="shift-actions">
          <button class="secondary-btn small-btn" onclick="editShift('${shift.id}')">Edit</button>
          <button class="secondary-btn small-btn danger-btn" onclick="deleteShift('${shift.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

async function editShift(shiftId) {
  const shift = allShifts.find(s => s.id === shiftId);
  if (!shift) return;

  editingShiftId = shiftId;

  // ===== STRIP SECONDS FROM SUPABASE TIME FORMAT =====
  document.getElementById('shift-date').value = shift.date || '';
  document.getElementById('morning-in').value = String(shift.morning_in || '').slice(0, 5);
  document.getElementById('morning-out').value = String(shift.morning_out || '').slice(0, 5);
  document.getElementById('afternoon-in').value = String(shift.afternoon_in || '').slice(0, 5);
  document.getElementById('afternoon-out').value = String(shift.afternoon_out || '').slice(0, 5);
  document.getElementById('overtime-start').value = String(shift.overtime_start || '').slice(0, 5);
  document.getElementById('overtime-end').value = String(shift.overtime_end || '').slice(0, 5);

  // ===== WAIT FOR DOM THEN RECALCULATE =====
  setTimeout(() => updateShiftDurations(), 100);

  const saveBtn = document.getElementById('save-shift-btn');
  if (saveBtn) saveBtn.textContent = 'Update Shift';

  document.getElementById('shift-form')?.scrollIntoView({ behavior: 'smooth' });
  showToast('Shift loaded — make your changes and click Update Shift');
}

async function deleteShift(shiftId) {
  if (!confirm('Delete this shift record? This cannot be undone.')) return;

  const { error } = await supabase
    .from('shifts')
    .delete()
    .eq('id', shiftId);

  if (error) {
    showToast('Failed to delete shift: ' + error.message);
    return;
  }

  showToast('Shift deleted');
  await loadAllShifts();
  updateDashboard();
}

// === DASHBOARD ===
function updateDashboard() {
  if (!currentUser) return;

  const totalHours = allShifts.reduce((sum, shift) => sum + (shift.total_hours || 0), 0);
  const requiredHours = currentUser.requiredHours || 200;
  const remainingHours = Math.max(0, requiredHours - totalHours);
  const percentage = requiredHours > 0
    ? Math.min(Math.round((totalHours / requiredHours) * 100), 100)
    : 0;
  const uniqueDays = new Set(allShifts.map(s => s.date)).size;

  const greetingEl = document.getElementById('greeting-msg');
  const percentEl = document.getElementById('progress-percent');
  const hoursRenderedEl = document.getElementById('hours-rendered');
  const remainingEl = document.getElementById('hours-remaining');
  const daysEl = document.getElementById('stat-total-days');
  const totalHoursEl = document.getElementById('stat-total-hours');
  const ringEl = document.getElementById('progress-circle-fill');
  const estimateEl = document.getElementById('estimated-finish');

  if (greetingEl) greetingEl.textContent = `Hello, ${getFirstName(currentUser.fullName)}`;
  if (percentEl) percentEl.textContent = `${percentage}%`;
  if (hoursRenderedEl) hoursRenderedEl.textContent = `${totalHours.toFixed(1)} / ${requiredHours} hrs`;
  if (remainingEl) remainingEl.textContent = `${remainingHours.toFixed(0)}h`;
  if (daysEl) daysEl.textContent = uniqueDays;
  if (totalHoursEl) totalHoursEl.textContent = `${totalHours.toFixed(0)}h`;

  if (ringEl) {
    const offset = RING_CIRCUMFERENCE - (percentage / 100) * RING_CIRCUMFERENCE;
    ringEl.style.strokeDashoffset = offset;
  }

  if (estimateEl) {
    if (remainingHours <= 0) {
      estimateEl.textContent = 'Target reached — great work!';
    } else if (uniqueDays < 2 || totalHours <= 0) {
      estimateEl.textContent = 'Log more shifts to see your estimated finish date.';
    } else {
      const avgDaily = totalHours / uniqueDays;
      const daysLeft = Math.ceil(remainingHours / avgDaily);
      const finishDate = new Date();
      finishDate.setDate(finishDate.getDate() + daysLeft);
      estimateEl.textContent = finishDate.toLocaleDateString([], {
        month: 'short', day: 'numeric', year: 'numeric'
      });
    }
  }

  renderWeeklyChart();
  renderShiftHistory();
}

// === WEEKLY CHART ===
function renderWeeklyChart() {
  const container = document.getElementById('weekly-hours-chart');
  if (!container) return;

  const today = new Date();
  const dayIndex = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayIndex);
  monday.setHours(0, 0, 0, 0);

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return {
      label: date.toLocaleDateString([], { weekday: 'short' }),
      dateStr: date.toISOString().split('T')[0],
      hours: 0
    };
  });

  allShifts.forEach(shift => {
    const day = week.find(d => d.dateStr === shift.date);
    if (day) day.hours += shift.total_hours || 0;
  });

  const maxHours = Math.max(...week.map(d => d.hours), 8);

  container.innerHTML = week.map(day => `
    <div class="chart-row">
      <span class="chart-label">${day.label}</span>
      <div class="chart-bar">
        <div class="chart-fill" style="width:${maxHours > 0 ? Math.round((day.hours / maxHours) * 100) : 0}%"></div>
      </div>
      <span class="chart-value">${day.hours.toFixed(1)}h</span>
    </div>
  `).join('');
}

// === HISTORY PAGE ===
function renderHistoryPage() {
  const totalHours = allShifts.reduce((sum, s) => sum + (s.total_hours || 0), 0);
  const uniqueDays = new Set(allShifts.map(s => s.date)).size;
  const avgHours = uniqueDays ? totalHours / uniqueDays : 0;

  const daysEl = document.getElementById('history-days');
  const hoursEl = document.getElementById('history-hours');
  const avgEl = document.getElementById('history-average');
  const activeEl = document.getElementById('history-active');

  if (daysEl) daysEl.textContent = uniqueDays;
  if (hoursEl) hoursEl.textContent = `${totalHours.toFixed(1)}h`;
  if (avgEl) avgEl.textContent = `${avgHours.toFixed(1)}h`;
  if (activeEl) activeEl.textContent = '0';

  const container = document.getElementById('all-sessions');
  if (!container) return;

  if (!allShifts.length) {
    container.innerHTML = '<p class="empty-state">No shifts found.</p>';
    return;
  }

  // Group by date
  const groups = allShifts.reduce((acc, shift) => {
    const dateKey = new Date(shift.date + 'T00:00:00').toLocaleDateString([], {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(shift);
    return acc;
  }, {});

  container.innerHTML = Object.entries(groups).map(([day, shifts]) => `
    <section class="history-day">
      <h2 class="history-day-title">${day}</h2>
      ${shifts.map(shift => `
        <div class="session-item">
          <div class="session-icon">▣</div>
          <div class="session-meta">
            <strong>${shift.morning_in || '--'} - ${shift.morning_out || '--'}</strong>
            ${shift.afternoon_in ? `<span>Afternoon: ${shift.afternoon_in} - ${shift.afternoon_out}</span>` : ''}
            ${shift.overtime_start ? `<span>Overtime: ${shift.overtime_start} - ${shift.overtime_end}</span>` : ''}
          </div>
          <div class="session-duration">${(shift.total_hours || 0).toFixed(2)}h</div>
        </div>
      `).join('')}
    </section>
  `).join('');
}

// === SETTINGS PAGE ===
function renderSettingsPage() {
  if (!currentUser) return;
  const nameInput = document.getElementById('settings-name-input');
  const hoursInput = document.getElementById('required-hours');
  if (nameInput) nameInput.value = currentUser.fullName || '';
  if (hoursInput) hoursInput.value = currentUser.requiredHours || 200;
}

async function saveSettings() {
  const saveBtn = document.getElementById('save-settings-btn');
  setButtonLoading(saveBtn, true, 'Saving...');

  const fullName = document.getElementById('settings-name-input')?.value.trim() || currentUser.fullName;
  const requiredHours = parseInt(document.getElementById('required-hours')?.value, 10) || 200;

  try {
    const { error } = await supabase.from('profiles').upsert({
      id: currentUser.id,
      full_name: fullName,
      email: currentUser.email,
      required_hours: requiredHours
    });

    if (error) {
      showToast('Error saving settings: ' + error.message);
      return;
    }

    currentUser.fullName = fullName;
    currentUser.requiredHours = requiredHours;
    updateDashboard();
    showToast('Settings saved');
    navTo('dashboard');
  } finally {
    setButtonLoading(saveBtn, false);
  }
}

// === DTR MODAL ===
function openDTRModal() {
  const modal = document.getElementById('dtr-modal');
  if (modal) modal.style.display = 'grid';
  const nameInput = document.getElementById('dtr-full-name');
  if (nameInput && currentUser?.fullName) nameInput.value = currentUser.fullName;
}

function closeDTRModal() {
  const modal = document.getElementById('dtr-modal');
  if (modal) modal.style.display = 'none';
  document.getElementById('dtr-form')?.reset();
  toggleSignatureSection(false);
}

function toggleSignatureSection(show) {
  const section = document.getElementById('signature-section');
  if (!section) return;
  if (show) {
    section.style.display = 'grid';
  } else {
    section.style.display = 'none';
  }
}

function validateDTRForm() {
  const requiredFields = ['dtr-full-name', 'dtr-school', 'dtr-department', 'dtr-company', 'dtr-position'];
  let valid = true;
  requiredFields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!el.value.trim()) {
      el.style.borderColor = '#c0392b';
      valid = false;
    } else {
      el.style.borderColor = '';
    }
  });
  return valid;
}

function getDTRData() {
  return {
    fullName: document.getElementById('dtr-full-name')?.value.trim(),
    school: document.getElementById('dtr-school')?.value.trim(),
    department: document.getElementById('dtr-department')?.value.trim(),
    company: document.getElementById('dtr-company')?.value.trim(),
    position: document.getElementById('dtr-position')?.value.trim(),
    includeSignature: document.getElementById('dtr-include-signature')?.checked,
    supervisorName: document.getElementById('dtr-supervisor-name')?.value.trim(),
    supervisorTitle: document.getElementById('dtr-supervisor-title')?.value.trim(),
    shifts: allShifts
  };
}

function exportDTR(type) {
  if (!validateDTRForm()) {
    showToast('Please fill in all required fields');
    return;
  }
  const data = getDTRData();
  if (type === 'print') generateDTRPrint(data);
  else if (type === 'csv') generateDTRCSV(data);
  else if (type === 'excel') generateDTRExcel(data);
}

// === PDF PRINT ===
function generateDTRPrint(data) {
  const printWindow = window.open('', '_blank');
  const rows = data.shifts.map(shift => `
    <tr>
      <td>${new Date(shift.date + 'T00:00:00').toISOString().slice(0,10)}</td>
      <td>
        ${shift.morning_in && shift.morning_out ? `${shift.morning_in} - ${shift.morning_out}` : ''}
        ${shift.afternoon_in && shift.afternoon_out ? `, ${shift.afternoon_in} - ${shift.afternoon_out}` : ''}
        ${shift.overtime_start && shift.overtime_end ? `, ${shift.overtime_start} - ${shift.overtime_end} (OT)` : ''}
      </td>
      <td>${(shift.total_hours || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  const totalHours = data.shifts.reduce((sum, s) => sum + (s.total_hours || 0), 0);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>DTR - ${data.fullName}</title>
      <style>
        body { font-family: serif; margin: 20px; color: #000; }
        .doc-header { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 16px; }
        h1 { text-align: center; font-size: 18px; margin: 0; }
        .subtitle { text-align: center; font-size: 13px; margin-bottom: 20px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 20px; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #f0f0f0; padding: 8px; border: 1px solid #000; text-align: left; }
        td { padding: 8px; border: 1px solid #000; }
        .total-row td { font-weight: bold; text-align: right; }
        .signature-block { margin-top: 40px; display: flex; gap: 40px; font-size: 13px; }
        .sig-line { border-top: 1px solid #000; padding-top: 6px; margin-top: 30px; width: 220px; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <div class="doc-header">
        <span>${new Date().toLocaleString()}</span>
        <span>DTR - ${data.fullName}</span>
      </div>
      <h1>DAILY TIME RECORD</h1>
      <p class="subtitle">On-the-Job Training</p>
      <div class="info-grid">
        <div><strong>Name:</strong> ${data.fullName}</div>
        <div><strong>Company:</strong> ${data.company}</div>
        <div><strong>School:</strong> ${data.school}</div>
        <div><strong>Position:</strong> ${data.position}</div>
        <div><strong>Department / Course:</strong> ${data.department}</div>
      </div>
      <table>
        <thead>
          <tr><th>Date</th><th>Time In - Out</th><th>Hours</th></tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="2">Total Hours:</td>
            <td>${totalHours.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      ${data.includeSignature ? `
        <div class="signature-block">
          <div>
            <p>Certified Correct:</p>
            <div class="sig-line">${data.supervisorName}<br>${data.supervisorTitle}</div>
          </div>
          <div>
            <p>&nbsp;</p>
            <div class="sig-line">Intern Signature<br>Date: _______________</div>
          </div>
        </div>
      ` : ''}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// === CSV EXPORT ===
function generateDTRCSV(data) {
  const totalHours = data.shifts.reduce((sum, s) => sum + (s.total_hours || 0), 0);
  const rows = [
    ['DAILY TIME RECORD - OJT'],
    ['Name:', data.fullName],
    ['School:', data.school],
    ['Department/Course:', data.department],
    ['Company:', data.company],
    ['Position:', data.position],
    [''],
    ['Date', 'Time In', 'Time Out', 'Hours'],
    ...data.shifts.map(s => [
      s.date,
      s.morning_in || '',
      s.morning_out || '',
      (s.total_hours || 0).toFixed(2)
    ]),
    ['', '', '', ''],
    ['Total Hours:', '', '', totalHours.toFixed(2)]
  ];

  const csv = rows.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

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
  const totalHours = data.shifts.reduce((sum, s) => sum + (s.total_hours || 0), 0);
  const wsData = [
    ['DAILY TIME RECORD - OJT'],
    ['Name:', data.fullName],
    ['School:', data.school],
    ['Department/Course:', data.department],
    ['Company:', data.company],
    ['Position:', data.position],
    [''],
    ['Date', 'Time In', 'Time Out', 'Hours'],
    ...data.shifts.map(s => [
      s.date,
      s.morning_in || '',
      s.morning_out || '',
      (s.total_hours || 0).toFixed(2)
    ]),
    ['', '', '', ''],
    ['Total Hours:', '', '', totalHours.toFixed(2)]
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DTR');
  XLSX.writeFile(wb, `DTR_${data.fullName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
  closeDTRModal();
  showToast('DTR Excel exported');
}

// === EVENT LISTENERS ===
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
    const requiredHours = parseInt(document.getElementById('signup-required-hours').value, 10) || 200;
    try {
      const result = await auth.signup(fullName, email, password, confirmPassword, requiredHours);
      if (!result.success) {
        setFormError('signup-error', result.message || 'Signup failed');
        return;
      }
      await loadUserData();
      showAppUI();
      e.target.reset();
      showToast('Account created successfully');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  document.getElementById('dtr-include-signature')?.addEventListener('change', (e) => {
    toggleSignatureSection(e.target.checked);
  });

  document.getElementById('shift-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveShift();
  });

  ['morning-in', 'morning-out', 'afternoon-in', 'afternoon-out', 'overtime-start', 'overtime-end'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateShiftDurations);
  });

  document.getElementById('shift-filter-date')?.addEventListener('input', renderShiftHistory);
}

// === INIT ===
async function initializeApp() {
  loadThemePreference();
  setupEventListeners();
  setDefaultShiftDate();
  updateShiftDurations();

  await auth.init();

  if (auth.isAuthenticated) {
    await loadUserData();
    if (currentUser) {
      showAppUI();
      return;
    }
  }

  showAuthUI('login');
}

document.addEventListener('DOMContentLoaded', initializeApp);