/* ============================================================
   APP - OJeyT Tracker (Supabase Edition)
   ============================================================ */

let currentUser = null;
let allShifts = [];
let currentPage = 'login';
let editingShiftId = null;

const RING_CIRCUMFERENCE = 364.42;

// === NAVIGATION ===
function navTo(page) {
  // === CONFIRM BEFORE LEAVING IF FORM IS DIRTY ===
  if (shiftFormDirty && currentPage === 'dashboard' && page !== 'dashboard') {
    confirmLeave(() => navTo(page));
    return;
  }

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

  // ===== SET AVATAR INITIALS =====
  const avatarEl = document.getElementById('user-avatar');
  if (avatarEl) {
    const name = currentUser?.fullName || currentUser?.email || 'U';
    const initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('');
    avatarEl.textContent = initials.toUpperCase();
  }

  // ===== SHOW PROGRESS BAR =====
  const barWrap = document.getElementById('ojt-progress-bar-wrap');
  if (barWrap) barWrap.style.display = '';
  navTo('dashboard');
}

// === LOGOUT ===
async function logout() {
  await auth.logout();
  currentUser = null;
  allShifts = [];

  // ===== HIDE PROGRESS BAR ON LOGOUT =====
  const barWrap = document.getElementById('ojt-progress-bar-wrap');
  if (barWrap) barWrap.style.display = 'none';
  const barFill = document.getElementById('ojt-progress-bar-fill');
  if (barFill) barFill.style.width = '0%';

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

  // === DUPLICATE PROTECTION ===
  if (!editingShiftId) {
    const duplicate = allShifts.find(s => s.date === date);
    if (duplicate) {
      showToast(`❌ A shift already exists for ${new Date(date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}. Edit the existing shift instead.`);
      return;
    }
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
    total_hours: totalHours,
    notes: document.getElementById('shift-notes')?.value.trim() || null
  };

  let saveError;

  if (editingShiftId) {
    const { data, error } = await supabase
      .from('shifts')
      .update(shiftPayload)
      .eq('id', editingShiftId)
      .eq('user_id', currentUser.id)
      .select();

    saveError = error;
    editingShiftId = null;

  } else {

    const { data, error } = await supabase
      .from('shifts')
      .insert({ ...shiftPayload, user_id: currentUser.id })
      .select();

    saveError = error;
  }

  if (saveError) {
    showToast('Failed to save shift: ' + saveError.message);
    console.error('Save error:', saveError);
    return;
  }

  showToast(`✅ Shift saved — ${totalHours.toFixed(2)} hrs logged`);
  document.getElementById('shift-form')?.reset();
  markFormClean();

  const saveBtn = document.getElementById('save-shift-btn');
  if (saveBtn) saveBtn.textContent = 'Save Shift';

  setDefaultShiftDate();
  updateShiftDurations();

  // ===== LOAD SHIFTS THEN REFRESH DASHBOARD =====
  await loadAllShifts();
  updateDashboard();
}

// === CALCULATE ESTIMATED FINISH DATE ===
// Always uses the EARLIEST shift date as the start, and the hours
// logged on that earliest day as the daily rate. Recalculates any
// time shifts change, so editing/adding an earlier date updates it.
function calculateEstimatedFinish() {
  if (!currentUser || !allShifts.length) return null;

  // ===== FIND THE EARLIEST SHIFT DATE ACROSS ALL LOGGED SHIFTS =====
  const firstShiftDateStr = allShifts.reduce((earliest, shift) =>
    shift.date < earliest ? shift.date : earliest,
    allShifts[0].date
  );

  // ===== USE THE HOURS LOGGED ON THAT EARLIEST DAY AS DAILY RATE =====
  const firstShift = allShifts.find(s => s.date === firstShiftDateStr);
  const firstDayHours = firstShift?.total_hours || 8;

  const requiredHours = currentUser.requiredHours || 200;
  const workdaysNeeded = Math.ceil(requiredHours / firstDayHours);

  // ===== PH PUBLIC HOLIDAYS =====
  const allHolidays = new Set([
    // 2026 Regular Holidays
    '2026-01-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-09',
    '2026-05-01', '2026-05-28', '2026-06-12', '2026-08-31', '2026-11-30',
    '2026-12-25', '2026-12-30',
    // 2026 Special Non-Working Days
    '2026-02-17', '2026-03-20', '2026-08-21', '2026-11-01', '2026-11-02',
    '2026-12-08', '2026-12-24', '2026-12-31',
    // 2027 Regular Holidays
    '2027-01-01', '2027-03-25', '2027-03-26', '2027-03-27', '2027-04-09',
    '2027-05-01', '2027-05-17', '2027-06-12', '2027-08-30', '2027-11-29',
    '2027-12-25', '2027-12-30',
    // 2027 Special Non-Working Days
    '2027-03-09', '2027-08-21', '2027-11-01', '2027-11-02',
    '2027-12-08', '2027-12-24', '2027-12-31',
  ]);

  // ===== COUNT WORKDAYS FORWARD FROM THE EARLIEST SHIFT DATE =====
  const finishDate = new Date(firstShiftDateStr + 'T00:00:00');
  finishDate.setHours(0, 0, 0, 0);
  let daysAdded = 0;

  while (daysAdded < workdaysNeeded) {
    finishDate.setDate(finishDate.getDate() + 1);
    const dow = finishDate.getDay();
    const y = finishDate.getFullYear();
    const m = String(finishDate.getMonth() + 1).padStart(2, '0');
    const d = String(finishDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    if (dow !== 0 && dow !== 6 && !allHolidays.has(dateStr)) {
      daysAdded++;
    }
  }

  return finishDate;
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
        ${shift.notes ? `<div class="shift-note-display">📝 ${shift.notes}</div>` : ''}
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
  document.getElementById('shift-notes').value = shift.notes || '';
  

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

// === DAILY AVERAGE VS TARGET INDICATOR ===
function updateAvgTargetIndicator(totalHours, uniqueDays, requiredHours) {
  const row = document.getElementById('avg-target-row');
  if (!row) return;

  if (uniqueDays < 1 || totalHours <= 0) {
    row.style.display = 'none';
    return;
  }

  row.style.display = '';

  const avgDaily = totalHours / uniqueDays;

  // ===== CALCULATE TARGET DAILY HOURS NEEDED =====
  // Based on remaining hours and remaining workdays from today
  const now = new Date();
  const allHolidays = new Set([
    '2026-01-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-09',
    '2026-05-01', '2026-05-28', '2026-06-12', '2026-08-31', '2026-11-30',
    '2026-12-25', '2026-12-30', '2026-02-17', '2026-03-20', '2026-08-21',
    '2026-11-01', '2026-11-02', '2026-12-08', '2026-12-24', '2026-12-31',
    '2027-01-01', '2027-03-25', '2027-03-26', '2027-03-27', '2027-04-09',
    '2027-05-01', '2027-05-17', '2027-06-12', '2027-08-30', '2027-11-29',
    '2027-12-25', '2027-12-30', '2027-03-09', '2027-08-21', '2027-11-01',
    '2027-11-02', '2027-12-08', '2027-12-24', '2027-12-31',
  ]);

  // ===== COUNT REMAINING WORKDAYS FROM TODAY =====
  const finishDate = calculateEstimatedFinish();
  let remainingWorkdays = 0;
  if (finishDate) {
    let cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= finishDate) {
      cursor.setDate(cursor.getDate() + 1);
      const dow = cursor.getDay();
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      if (dow !== 0 && dow !== 6 && !allHolidays.has(dateStr)) {
        remainingWorkdays++;
      }
    }
  }

  const remainingHours = Math.max(0, requiredHours - totalHours);
  const targetDaily = remainingWorkdays > 0
    ? remainingHours / remainingWorkdays
    : avgDaily;

  // ===== UPDATE LABELS =====
  const avgDisplay = document.getElementById('avg-daily-display');
  const targetDisplay = document.getElementById('target-daily-display');
  const fill = document.getElementById('avg-target-fill');
  const marker = document.getElementById('avg-target-marker');
  const status = document.getElementById('avg-target-status');

  if (avgDisplay) avgDisplay.textContent = `${avgDaily.toFixed(1)}h`;
  if (targetDisplay) targetDisplay.textContent = `${targetDaily.toFixed(1)}h`;

  // ===== CALCULATE BAR WIDTH =====
  const maxVal = Math.max(avgDaily, targetDaily, 8);
  const avgPct = Math.min((avgDaily / maxVal) * 100, 100);
  const targetPct = Math.min((targetDaily / maxVal) * 100, 100);

  if (fill) fill.style.width = `${avgPct}%`;
  if (marker) marker.style.left = `${targetPct}%`;

  // ===== STATUS MESSAGE =====
  if (status) {
    if (avgDaily >= targetDaily) {
      fill.style.background = 'var(--teal)';
      status.textContent = `✅ On track — you're averaging ${avgDaily.toFixed(1)}h/day`;
      status.className = 'avg-target-status status-good';
    } else {
      const diff = (targetDaily - avgDaily).toFixed(1);
      fill.style.background = '#f59e0b';
      status.textContent = `⚠️ Need ${diff}h more per day to finish on time`;
      status.className = 'avg-target-status status-warn';
    }
  }
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

  // ===== UPDATE TOP PROGRESS BAR =====
  const barFill = document.getElementById('ojt-progress-bar-fill');
  if (barFill) barFill.style.width = `${percentage}%`;

  // ===== ESTIMATED FINISH — ALWAYS BASED ON EARLIEST SHIFT DATE =====
  if (estimateEl) {
    if (remainingHours <= 0) {
      estimateEl.textContent = 'Target reached — great work!';
    } else if (!allShifts.length) {
      estimateEl.textContent = 'Log your first shift to see your estimated finish date.';
    } else {
      const finishDate = calculateEstimatedFinish();
      if (finishDate) {
        estimateEl.textContent = finishDate.toLocaleDateString([], {
          month: 'short', day: 'numeric', year: 'numeric'
        });
      }
    }
  }

  // === UPDATE STREAK === / === DAILY AVG VS TARGET ===
  updateAvgTargetIndicator(totalHours, uniqueDays, requiredHours);
  const streak = calculateStreak();
  const streakEl = document.getElementById('streak-count');
  const streakBestEl = document.getElementById('streak-best');
  if (streakEl) streakEl.textContent = streak.current;
  if (streakBestEl) streakBestEl.textContent = streak.best;

  // ===== REFRESH WHICHEVER CHART IS ACTIVE =====
  const monthlyVisible = document.getElementById('monthly-hours-chart')?.style.display !== 'none';
  if (monthlyVisible) {
    renderMonthlyChart();
  } else {
    renderWeeklyChart();
  }
  renderShiftHistory();
}

// === STREAK COUNTER ===
function calculateStreak() {
  if (!allShifts.length) return { current: 0, best: 0 };

  // ===== GET ALL UNIQUE SHIFT DATES SORTED DESCENDING =====
  const sortedDates = [...new Set(allShifts.map(s => s.date))]
    .sort((a, b) => b.localeCompare(a));

  // ===== GET TODAY AND YESTERDAY AS STRINGS =====
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;

  // ===== CURRENT STREAK =====
  let current = 0;
  let checkDate = new Date(sortedDates[0] + 'T00:00:00');
  const mostRecent = sortedDates[0];

  // ===== STREAK ONLY COUNTS IF LAST SHIFT WAS TODAY OR YESTERDAY =====
  if (mostRecent !== todayStr && mostRecent !== yesterdayStr) {
    current = 0;
  } else {
    for (let i = 0; i < sortedDates.length; i++) {
      const expected = new Date(checkDate);
      expected.setDate(checkDate.getDate() - i);
      const expectedStr = `${expected.getFullYear()}-${String(expected.getMonth()+1).padStart(2,'0')}-${String(expected.getDate()).padStart(2,'0')}`;

      // ===== SKIP WEEKENDS IN STREAK =====
      if (expected.getDay() === 0 || expected.getDay() === 6) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }

      if (sortedDates.includes(expectedStr)) {
        current++;
      } else {
        break;
      }
    }
  }

  // ===== BEST STREAK =====
  let best = 0;
  let tempStreak = 1;
  const ascDates = [...sortedDates].sort((a, b) => a.localeCompare(b));

  for (let i = 1; i < ascDates.length; i++) {
    const prev = new Date(ascDates[i - 1] + 'T00:00:00');
    const curr = new Date(ascDates[i] + 'T00:00:00');
    const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);

    // ===== ALLOW 1 DAY GAP FOR WEEKENDS =====
    if (diffDays === 1 || (diffDays === 3 && prev.getDay() === 5)) {
      tempStreak++;
    } else {
      best = Math.max(best, tempStreak);
      tempStreak = 1;
    }
  }
  best = Math.max(best, tempStreak);

  return { current, best };
}

// === CHART TOGGLE ===
function switchChart(type) {
  const weeklyChart = document.getElementById('weekly-hours-chart');
  const monthlyChart = document.getElementById('monthly-hours-chart');
  const weeklyBtn = document.getElementById('btn-weekly-chart');
  const monthlyBtn = document.getElementById('btn-monthly-chart');

  if (type === 'weekly') {
    weeklyChart.style.display = '';
    monthlyChart.style.display = 'none';
    weeklyBtn.classList.add('active');
    monthlyBtn.classList.remove('active');
    renderWeeklyChart();
  } else {
    weeklyChart.style.display = 'none';
    monthlyChart.style.display = '';
    weeklyBtn.classList.remove('active');
    monthlyBtn.classList.add('active');
    renderMonthlyChart();
  }
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
    // ===== USE LOCAL DATE STRING TO AVOID TIMEZONE ISSUES =====
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return {
      label: date.toLocaleDateString([], { weekday: 'short' }),
      dateStr: `${y}-${m}-${d}`,
      hours: 0
    };
  });

  allShifts.forEach(shift => {
    const shiftDate = String(shift.date).slice(0, 10);
    const day = week.find(d => d.dateStr === shiftDate);
    if (day) day.hours += parseFloat(shift.total_hours) || 0;
  });

  const maxHours = Math.max(...week.map(d => d.hours), 1);

  container.innerHTML = week.map(day => `
    <div class="chart-row">
      <span class="chart-label">${day.label}</span>
      <div class="chart-bar">
        <div class="chart-fill" style="width:${Math.round((day.hours / maxHours) * 100)}%"></div>
      </div>
      <span class="chart-value">${day.hours.toFixed(1)}h</span>
    </div>
  `).join('');
}

// === MONTHLY HOURS BAR CHART ===
function renderMonthlyChart() {
  const container = document.getElementById('monthly-hours-chart');
  if (!container) return;

  // ===== GET CURRENT MONTH DAYS =====
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // ===== BUILD DAYS ARRAY =====
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { day: d, dateStr, hours: 0 };
  });

  // ===== MATCH SHIFTS TO DAYS =====
  allShifts.forEach(shift => {
    const shiftDate = String(shift.date).slice(0, 10);
    const day = days.find(d => d.dateStr === shiftDate);
    if (day) day.hours += parseFloat(shift.total_hours) || 0;
  });

  const maxHours = Math.max(...days.map(d => d.hours), 1);
  const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // ===== RENDER BARS =====
  container.innerHTML = `
    <div class="monthly-chart-wrap">
      <div class="monthly-bars">
        ${days.map(day => {
          const heightPct = Math.round((day.hours / maxHours) * 100);
          const isToday = day.dateStr === todayStr;
          const isWeekend = new Date(day.dateStr + 'T00:00:00').getDay() === 0 ||
                            new Date(day.dateStr + 'T00:00:00').getDay() === 6;
          return `
            <div class="monthly-bar-col ${isToday ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''}">
              <div class="monthly-bar-wrap">
                <div class="monthly-bar-fill" style="height:${heightPct}%;"
                  title="${day.dateStr}: ${day.hours.toFixed(1)}h"></div>
              </div>
              <span class="monthly-bar-label">${day.day}</span>
            </div>
          `;
        }).join('')}
      </div>
      <div class="monthly-chart-footer">
        <span>Total this month: <strong>${days.reduce((s, d) => s + d.hours, 0).toFixed(1)}h</strong></span>
        <span>Days logged: <strong>${days.filter(d => d.hours > 0).length}</strong></span>
      </div>
    </div>
  `;
}

// === LATE & ABSENCE TRACKER ===
function calculateShortDays(targetHoursPerDay = 8) {
  if (!allShifts.length) return 0;
  return allShifts.filter(s => (s.total_hours || 0) < targetHoursPerDay).length;
}

// === HISTORY VIEW TOGGLE ===
function switchHistoryView(type) {
  const dailyView = document.getElementById('all-sessions');
  const monthlyView = document.getElementById('monthly-summary');
  const dailyBtn = document.getElementById('btn-daily-view');
  const monthlyBtn = document.getElementById('btn-monthly-view');

  if (type === 'daily') {
    dailyView.style.display = '';
    monthlyView.style.display = 'none';
    dailyBtn.classList.add('active');
    monthlyBtn.classList.remove('active');
  } else {
    dailyView.style.display = 'none';
    monthlyView.style.display = '';
    dailyBtn.classList.remove('active');
    monthlyBtn.classList.add('active');
    renderMonthlySummary();
  }
}

// === MONTHLY SUMMARY RENDERER ===
function renderMonthlySummary() {
  const container = document.getElementById('monthly-summary');
  if (!container) return;

  if (!allShifts.length) {
    container.innerHTML = '<p class="empty-state">No shifts found.</p>';
    return;
  }

  // ===== GROUP SHIFTS BY MONTH =====
  const monthGroups = allShifts.reduce((acc, shift) => {
    const date = new Date(shift.date + 'T00:00:00');
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString([], { month: 'long', year: 'numeric' });
    if (!acc[key]) acc[key] = { label, shifts: [], totalHours: 0, days: 0 };
    acc[key].shifts.push(shift);
    acc[key].totalHours += parseFloat(shift.total_hours) || 0;
    acc[key].days++;
    return acc;
  }, {});

  // ===== SORT NEWEST FIRST =====
  const sorted = Object.entries(monthGroups).sort((a, b) => b[0].localeCompare(a[0]));

  const requiredHours = currentUser?.requiredHours || 200;

  container.innerHTML = sorted.map(([key, data]) => {
    const avgPerDay = data.days > 0 ? (data.totalHours / data.days).toFixed(1) : 0;
    const pct = Math.min(Math.round((data.totalHours / requiredHours) * 100), 100);
    const shortDays = data.shifts.filter(s => (s.total_hours || 0) < 8).length;

    return `
      <div class="monthly-summary-card">
        <div class="monthly-summary-header">
          <h3 class="monthly-summary-title">${data.label}</h3>
          <span class="monthly-summary-total">${data.totalHours.toFixed(1)}h</span>
        </div>
        <div class="monthly-summary-bar-track">
          <div class="monthly-summary-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="monthly-summary-stats">
          <span>📅 <strong>${data.days}</strong> days worked</span>
          <span>⏱ <strong>${avgPerDay}h</strong> avg/day</span>
          ${shortDays > 0 ? `<span class="short-days-badge">⚠️ ${shortDays} short day${shortDays > 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
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

  // === LATE & ABSENCE TRACKER ===
  const avgHoursPerDay = uniqueDays > 0 ? totalHours / uniqueDays : 8;
  const shortDays = calculateShortDays(avgHoursPerDay);
  const shortDaysEl = document.getElementById('history-short-days');
  if (shortDaysEl) shortDaysEl.textContent = shortDays;

  const container = document.getElementById('all-sessions');
  if (!container) return;

  if (!allShifts.length) {
    container.innerHTML = '<p class="empty-state">No shifts found.</p>';
    return;
  }

  // ===== HELPER: FORMAT TIME HH:MM:SS → H:MM AM/PM =====
  function fmtTime(t) {
    if (!t) return '--';
    const clean = String(t).slice(0, 5);
    const [h, m] = clean.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '--';
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
  }

  // ===== HELPER: CALCULATE DURATION =====
  function calcHrs(start, end) {
    if (!start || !end) return null;
    const s = new Date(`1970-01-01T${String(start).slice(0,5)}:00`);
    const e = new Date(`1970-01-01T${String(end).slice(0,5)}:00`);
    if (isNaN(s) || isNaN(e) || e <= s) return null;
    return ((e - s) / (1000 * 60 * 60)).toFixed(2);
  }

  // ===== GROUP BY DATE =====
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
      ${shifts.map(shift => {
        const morningHrs = calcHrs(shift.morning_in, shift.morning_out);
        const afternoonHrs = calcHrs(shift.afternoon_in, shift.afternoon_out);
        const overtimeHrs = calcHrs(shift.overtime_start, shift.overtime_end);

        return `
          <div class="history-shift-card">
            <div class="history-sessions-grid">

              ${shift.morning_in && shift.morning_out ? `
                <div class="history-session-block">
                  <div class="history-session-label">Morning</div>
                  <div class="history-session-time">
                    ${fmtTime(shift.morning_in)} - ${fmtTime(shift.morning_out)}
                  </div>
                  <div class="history-session-duration">(${morningHrs} hrs)</div>
                </div>
              ` : ''}

              ${shift.afternoon_in && shift.afternoon_out ? `
                <div class="history-session-block">
                  <div class="history-session-label">Afternoon</div>
                  <div class="history-session-time">
                    ${fmtTime(shift.afternoon_in)} - ${fmtTime(shift.afternoon_out)}
                  </div>
                  <div class="history-session-duration">(${afternoonHrs} hrs)</div>
                </div>
              ` : ''}

              ${shift.overtime_start && shift.overtime_end ? `
                <div class="history-session-block">
                  <div class="history-session-label">Overtime</div>
                  <div class="history-session-time">
                    ${fmtTime(shift.overtime_start)} - ${fmtTime(shift.overtime_end)}
                  </div>
                  <div class="history-session-duration">(${overtimeHrs} hrs)</div>
                </div>
              ` : ''}

            </div>
            ${shift.notes ? `<div class="history-shift-note">📝 ${shift.notes}</div>` : ''}
            <div class="history-shift-total ${(shift.total_hours || 0) < 8 ? 'is-short' : ''}">
              ${(shift.total_hours || 0).toFixed(2)}h
              ${(shift.total_hours || 0) < 8 ? '<span class="short-tag">Short</span>' : ''}
            </div>
          </div>
        `;
      }).join('')}
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
  // === DTR DATE RANGE ===
  const fromDate = document.getElementById('dtr-range-from')?.value || null;
  const toDate = document.getElementById('dtr-range-to')?.value || null;

  let filteredShifts = [...allShifts].sort((a, b) => a.date.localeCompare(b.date));
  if (fromDate) filteredShifts = filteredShifts.filter(s => s.date >= fromDate);
  if (toDate) filteredShifts = filteredShifts.filter(s => s.date <= toDate);

  return {
    fullName: document.getElementById('dtr-full-name')?.value.trim(),
    school: document.getElementById('dtr-school')?.value.trim(),
    department: document.getElementById('dtr-department')?.value.trim(),
    company: document.getElementById('dtr-company')?.value.trim(),
    position: document.getElementById('dtr-position')?.value.trim(),
    includeSignature: document.getElementById('dtr-include-signature')?.checked,
    supervisorName: document.getElementById('dtr-supervisor-name')?.value.trim(),
    supervisorTitle: document.getElementById('dtr-supervisor-title')?.value.trim(),
    shifts: filteredShifts
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
      <td>${String(shift.date).slice(0, 10)}</td>
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
  ws['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DTR');
  XLSX.writeFile(wb, `DTR_${data.fullName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
  closeDTRModal();
  showToast('DTR Excel exported');
}

// === CONFIRM BEFORE LEAVING ===
let shiftFormDirty = false;

function markFormDirty() {
  shiftFormDirty = true;
}

function markFormClean() {
  shiftFormDirty = false;
}

function confirmLeave(callback) {
  if (!shiftFormDirty) {
    callback();
    return;
  }
  const confirmed = confirm('You have unsaved changes in the shift form. Are you sure you want to leave?');
  if (confirmed) {
    markFormClean();
    callback();
  }
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
    document.getElementById(id)?.addEventListener('input', () => {
      markFormDirty();
      updateShiftDurations();
    });
  });
  
  // ===== MARK DIRTY ON DATE AND NOTES CHANGE =====
  document.getElementById('shift-date')?.addEventListener('change', markFormDirty);
  document.getElementById('shift-notes')?.addEventListener('input', markFormDirty);

  document.getElementById('shift-filter-date')?.addEventListener('input', renderShiftHistory);
}

// === INIT ===
async function initializeApp() {
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

// === WARN BEFORE CLOSING TAB ===
window.addEventListener('beforeunload', (e) => {
  if (shiftFormDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

document.addEventListener('DOMContentLoaded', initializeApp);