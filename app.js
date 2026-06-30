import { createClient } from '/sdk/index.js';
import {
  loadTokens,
  saveTokens,
  clearTokens,
  restoreAuthSession,
} from '/lib/session.js';
import {
  maybeShowLocalWeeklyReminder,
  subscribeWeeklyReminder,
  unsubscribeWeeklyReminder,
} from '/reminders.js';
import {
  addDays,
  calcDay,
  calcWeek,
  defaultFinishTime,
  defaultShiftTimes,
  DEFAULT_START_TIME,
  entryTypeFor,
  formatDateRangeNz,
  formatHours,
  formatWeekday,
  isPaidLeaveType,
  LEAVE_DURATIONS,
  LEAVE_TYPES,
  leaveCreditHours,
  leaveDurationLabel,
  leaveTypeLabel,
  LUNCH_HOURS,
  normalizeDate,
  normalizeTime,
  parseTimeToHours,
  snapTimeToQuarterHour,
  STANDARD_WEEK_HOURS,
  toApiTime,
  weekdayDatesInWeek,
  weekStartFor,
} from '/hours.js';

function apiBase(configured) {
  const value = (configured ?? '').trim();
  return value ? value.replace(/\/$/, '') : window.location.origin;
}

const AUTH_URL = apiBase(window.__SDB_AUTH_URL);
const DATA_URL = apiBase(window.__SDB_DATA_URL);
const MAIL_URL = apiBase(window.__SDB_MAIL_URL);

const initialTokens = loadTokens();
const client = createClient({
  url: DATA_URL,
  authUrl: AUTH_URL,
  accessToken: initialTokens.accessToken ?? undefined,
});

const state = {
  user: null,
  weekStart: weekStartFor(new Date().toISOString().slice(0, 10)),
  entries: [],
  submissions: [],
  settings: null,
  locked: false,
};

const els = {
  status: document.getElementById('status'),
  invitePanel: document.getElementById('invite-panel'),
  inviteEmailLabel: document.getElementById('invite-email-label'),
  inviteForm: document.getElementById('invite-form'),
  inviteError: document.getElementById('invite-error'),
  authPanel: document.getElementById('auth-panel'),
  appPanel: document.getElementById('app-panel'),
  settingsPanel: document.getElementById('settings-panel'),
  authError: document.getElementById('auth-error'),
  weekLabel: document.getElementById('week-label'),
  daysList: document.getElementById('days-list'),
  lockedBanner: document.getElementById('locked-banner'),
  unlockWeek: document.getElementById('unlock-week'),
  totalWorked: document.getElementById('total-worked'),
  totalRegular: document.getElementById('total-regular'),
  totalOt: document.getElementById('total-ot'),
  totalLeave: document.getElementById('total-leave'),
  weekHoursHint: document.getElementById('week-hours-hint'),
  submitWeek: document.getElementById('submit-week'),
  submitError: document.getElementById('submit-error'),
  submitSuccess: document.getElementById('submit-success'),
  employeeName: document.getElementById('employee-name'),
  bossEmail: document.getElementById('boss-email'),
  defaultStart: document.getElementById('default-start'),
  weeklyReminder: document.getElementById('weekly-reminder'),
  settingsError: document.getElementById('settings-error'),
  settingsSuccess: document.getElementById('settings-success'),
  hardRefreshBtn: document.getElementById('hard-refresh-btn'),
};

let enterAppGeneration = 0;

function showMsg(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.hidden = !msg;
}

function persistSession(session) {
  saveTokens(session.access_token, session.refresh_token);
  client.setAccessToken(session.access_token);
}

function clearSession() {
  clearTokens();
  client.setAccessToken(null);
  state.user = null;
}

function setHardRefreshVisible(visible) {
  if (els.hardRefreshBtn) els.hardRefreshBtn.hidden = !visible;
}

async function hardRefresh() {
  const btn = els.hardRefreshBtn;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Refreshing…';
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch {
    /* still reload */
  }

  const url = new URL(window.location.href);
  url.searchParams.delete('access_token');
  url.searchParams.delete('refresh_token');
  url.searchParams.delete('invite_token');
  url.searchParams.set('_', String(Date.now()));
  window.location.replace(url.pathname + url.search + url.hash);
}

function showAuthPanel() {
  if (els.invitePanel) els.invitePanel.hidden = true;
  els.authPanel.hidden = false;
  els.appPanel.hidden = true;
  els.settingsPanel.hidden = true;
  setHardRefreshVisible(true);
}

function showInvitePanel() {
  if (els.invitePanel) els.invitePanel.hidden = false;
  els.authPanel.hidden = true;
  els.appPanel.hidden = true;
  els.settingsPanel.hidden = true;
  setHardRefreshVisible(true);
}

function showAppPanel() {
  if (els.invitePanel) els.invitePanel.hidden = true;
  els.authPanel.hidden = true;
  els.settingsPanel.hidden = true;
  els.appPanel.hidden = false;
  setHardRefreshVisible(false);
}

function weekEntries() {
  const end = addDays(state.weekStart, 6);
  return state.entries.filter((e) => {
    const d = normalizeDate(e.work_date);
    return d >= state.weekStart && d <= end;
  });
}

function isCurrentWeekLocked() {
  return state.submissions.some(
    (s) => normalizeDate(s.week_start) === state.weekStart,
  );
}

/** Create Mon–Fri entries from default shift times when missing (Sat/Sun stay blank). */
async function ensureDefaultWeekdayEntries() {
  if (isCurrentWeekLocked() || !state.user) return;

  const { start, end } = defaultShiftTimes(state.settings);
  const startTime = toApiTime(start);
  const endTime = toApiTime(end);
  if (!startTime || !endTime) return;

  const toCreate = weekdayDatesInWeek(state.weekStart)
    .filter((date) => !state.entries.some((e) => normalizeDate(e.work_date) === date))
    .map((work_date) => ({
      user_id: state.user.id,
      work_date,
      entry_type: 'work',
      start_time: startTime,
      end_time: endTime,
      notes: null,
    }));

  if (!toCreate.length) return;

  const result = await client.from('time_entries').insert(toCreate);
  if (result.error) throw new Error(result.error.message);

  for (const row of result.data ?? []) {
    state.entries.push({ ...row, work_date: normalizeDate(row.work_date) });
  }
  state.entries.sort((a, b) => a.work_date.localeCompare(b.work_date));
}

async function refreshWeekView() {
  await ensureDefaultWeekdayEntries();
  updateWeekUI();
}

function defaultTimesForDate(workDate) {
  const entry = state.entries.find((e) => normalizeDate(e.work_date) === workDate);
  if (entry && entryTypeFor(entry) === 'leave') {
    return { start: '', end: '' };
  }
  if (entry) {
    return {
      start: normalizeTime(entry.start_time),
      end: normalizeTime(entry.end_time),
    };
  }
  return defaultShiftTimes(state.settings);
}

function leaveTypeOptionsHtml(selected = 'annual_leave') {
  return Object.entries(LEAVE_TYPES)
    .map(([value, { label }]) => {
      const sel = value === selected ? ' selected' : '';
      return `<option value="${value}"${sel}>${label}</option>`;
    })
    .join('');
}

function leaveDurationOptionsHtml(selected = 'full') {
  return Object.entries(LEAVE_DURATIONS)
    .map(([value, { label }]) => {
      const sel = value === selected ? ' selected' : '';
      return `<option value="${value}"${sel}>${label}</option>`;
    })
    .join('');
}

function leaveStatsHtml(leaveType, leaveDuration) {
  const hours = leaveCreditHours(leaveType, leaveDuration);
  const label = leaveTypeLabel(leaveType);
  if (hours === 0) return `<span>${label}</span>`;
  return `<span>${label} · ${leaveDurationLabel(leaveDuration)} · ${formatHours(hours)}h leave</span>`;
}

function syncLeaveDurationVisibility(row) {
  const leaveType = row.querySelector('.day-leave-type')?.value ?? '';
  const durEl = row.querySelector('.day-leave-duration');
  if (!durEl) return;
  const show = isPaidLeaveType(leaveType);
  durEl.hidden = !show;
  durEl.disabled = !show || state.locked;
}

function setRowMode(row, mode) {
  const isLeave = mode === 'leave';
  const workFields = row.querySelector('.day-work-fields');
  const leaveFields = row.querySelector('.day-leave-fields');
  if (workFields) workFields.hidden = isLeave;
  if (leaveFields) leaveFields.hidden = !isLeave;
  const modeSelect = row.querySelector('.day-mode');
  if (modeSelect) modeSelect.value = mode;
  syncLeaveDurationVisibility(row);
}

function statsHtml(workDate, start, end) {
  if (!start || !end) {
    return '<span class="muted">Enter start and finish times</span>';
  }
  const day = calcDay(workDate, start, end);
  const gross = parseTimeToHours(end) - parseTimeToHours(start);
  const otPart =
    day.dailyOt > 0 ? `<span class="muted">· OT ${formatHours(day.dailyOt)}</span>` : '';
  const lunchHint =
    gross > day.worked
      ? `<span class="muted day-lunch-hint">${formatHours(gross)}h − ${formatHours(LUNCH_HOURS)} lunch</span>`
      : '';
  return `
    <span>${formatHours(day.worked)}h</span>
    ${otPart}
    ${lunchHint}
  `;
}

function showRowError(row, msg) {
  const el = row.querySelector('.day-row-error');
  if (!el) return;
  showMsg(el, msg);
}

function updateRowStats(row) {
  const mode = row.querySelector('.day-mode')?.value ?? 'work';
  const stats = row.querySelector('.day-line-stats');
  if (!stats) return;

  if (mode === 'leave') {
    const leaveType = row.querySelector('.day-leave-type')?.value ?? 'day_off';
    const leaveDuration = row.querySelector('.day-leave-duration')?.value ?? 'full';
    stats.innerHTML = leaveStatsHtml(
      leaveType,
      isPaidLeaveType(leaveType) ? leaveDuration : null,
    );
    const emptyHint = row.querySelector('.day-empty-hint');
    if (emptyHint) emptyHint.hidden = true;
    return;
  }

  const workDate = row.dataset.date;
  const start = row.querySelector('.day-start')?.value ?? '';
  const end = row.querySelector('.day-end')?.value ?? '';
  stats.innerHTML = statsHtml(workDate, start, end);
  const emptyHint = row.querySelector('.day-empty-hint');
  if (emptyHint) emptyHint.hidden = Boolean(start && end);
}

async function saveLeaveEntry(row) {
  if (state.locked) return;
  showRowError(row, '');

  const leaveType = row.querySelector('.day-leave-type')?.value;
  if (!leaveType) return showRowError(row, 'Choose a leave type');

  const leaveDuration = isPaidLeaveType(leaveType)
    ? row.querySelector('.day-leave-duration')?.value
    : null;
  if (isPaidLeaveType(leaveType) && !leaveDuration) {
    return showRowError(row, 'Choose full day, AM, or PM');
  }

  const payload = {
    work_date: row.dataset.date,
    user_id: state.user.id,
    entry_type: 'leave',
    leave_type: leaveType,
    leave_duration: leaveDuration,
    start_time: null,
    end_time: null,
  };

  const id = row.dataset.entryId;
  let result;
  if (id) {
    result = await client.from('time_entries').eq('id', id).update(payload);
  } else {
    result = await client.from('time_entries').insert({ ...payload, notes: null });
  }

  if (result.error) return showRowError(row, result.error.message);
  await loadData();
}

async function saveDayEntry(row) {
  if (state.locked) return;
  const mode = row.querySelector('.day-mode')?.value ?? 'work';
  if (mode === 'leave') return saveLeaveEntry(row);

  showRowError(row, '');

  const workDate = row.dataset.date;
  const startTime = toApiTime(snapTimeToQuarterHour(row.querySelector('.day-start').value));
  const endTime = toApiTime(snapTimeToQuarterHour(row.querySelector('.day-end').value));
  if (!startTime || !endTime) {
    return showRowError(row, 'Enter valid start and finish times');
  }

  const payload = {
    work_date: workDate,
    entry_type: 'work',
    start_time: startTime,
    end_time: endTime,
    leave_type: null,
    leave_duration: null,
    user_id: state.user.id,
  };

  const id = row.dataset.entryId;
  let result;
  if (id) {
    result = await client.from('time_entries').eq('id', id).update(payload);
  } else {
    result = await client.from('time_entries').insert({ ...payload, notes: null });
  }

  if (result.error) return showRowError(row, result.error.message);
  await loadData();
}

async function deleteDayEntry(row) {
  const id = row.dataset.entryId;
  if (!id || state.locked) return;
  if (!confirm('Delete this day entry?')) return;
  showRowError(row, '');
  const { error } = await client.from('time_entries').eq('id', id).delete();
  if (error) return showRowError(row, error.message);
  await loadData();
}

function updateWeekUI() {
  const weekEnd = addDays(state.weekStart, 6);
  els.weekLabel.textContent = formatDateRangeNz(state.weekStart, weekEnd);
  state.locked = state.submissions.some(
    (s) => normalizeDate(s.week_start) === state.weekStart,
  );
  els.lockedBanner.hidden = !state.locked;
  els.unlockWeek.hidden = !state.locked;
  els.submitWeek.disabled = state.locked;

  const week = calcWeek(weekEntries(), state.weekStart);
  els.totalWorked.textContent = formatHours(week.totalWorked);
  els.totalRegular.textContent = formatHours(week.totalRegular);
  els.totalOt.textContent = formatHours(week.totalOt);
  if (els.totalLeave) els.totalLeave.textContent = formatHours(week.totalLeaveHours);

  const defaultStart = normalizeTime(state.settings?.default_start_time) || DEFAULT_START_TIME;
  const { end: shiftEnd } = defaultShiftTimes(state.settings);
  if (els.weekHoursHint) {
    els.weekHoursHint.textContent =
      `Mon–Fri auto-fill: ${defaultStart}–${shiftEnd} (${formatHours(STANDARD_WEEK_HOURS)} h week). Use Work or Leave per row; paid leave credits 8h full / 4h AM or PM.`;
  }

  els.daysList.innerHTML = '';
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(state.weekStart, i);
    const entry = state.entries.find((e) => normalizeDate(e.work_date) === date);
    const mode = entry && entryTypeFor(entry) === 'leave' ? 'leave' : 'work';
    const leaveType = entry?.leave_type ?? 'annual_leave';
    const leaveDuration = entry?.leave_duration ?? 'full';
    const { start, end } = defaultTimesForDate(date);
    const row = document.createElement('div');
    row.className = `day-row${state.locked ? ' is-locked' : ''}`;
    row.dataset.date = date;
    row.dataset.entryId = entry?.id ?? '';
    row.dataset.hasEntry = entry ? '1' : '0';

    const disabled = state.locked ? 'disabled' : '';
    const deleteBtn = entry
      ? `<button type="button" class="ghost sm delete-day" ${disabled}>Delete</button>`
      : '';
    const workHidden = mode === 'leave' ? ' hidden' : '';
    const leaveHidden = mode === 'leave' ? '' : ' hidden';
    const durationHidden =
      mode === 'leave' && isPaidLeaveType(leaveType) ? '' : ' hidden';

    row.innerHTML = `
      <div class="day-line-primary">
        <span class="day-weekday">${formatWeekday(date)}</span>
        <select class="day-mode sm" ${disabled} aria-label="Work or leave">
          <option value="work"${mode === 'work' ? ' selected' : ''}>Work</option>
          <option value="leave"${mode === 'leave' ? ' selected' : ''}>Leave</option>
        </select>
        <div class="day-work-fields${workHidden}">
          <input type="time" class="day-start" step="900" value="${start}" ${disabled} />
          <span class="day-time-sep" aria-hidden="true">–</span>
          <input type="time" class="day-end" step="900" value="${end}" ${disabled} />
        </div>
        <div class="day-leave-fields${leaveHidden}">
          <select class="day-leave-type" ${disabled} aria-label="Leave type">
            ${leaveTypeOptionsHtml(leaveType)}
          </select>
          <select class="day-leave-duration${durationHidden}" ${disabled} aria-label="Leave duration">
            ${leaveDurationOptionsHtml(leaveDuration)}
          </select>
        </div>
      </div>
      <div class="day-line-secondary">
        <div class="day-line-stats">${
          mode === 'leave'
            ? leaveStatsHtml(leaveType, isPaidLeaveType(leaveType) ? leaveDuration : null)
            : statsHtml(date, start, end)
        }</div>
        <div class="day-row-actions">
          <button type="button" class="sm save-day" ${disabled}>Save</button>
          ${deleteBtn}
        </div>
      </div>
      <span class="muted day-empty-hint"${entry ? ' hidden' : ''}>No entry yet</span>
      <div class="day-row-error error" hidden></div>
    `;
    els.daysList.appendChild(row);
  }
}

async function loadData() {
  const [entriesRes, submissionsRes, settingsRes] = await Promise.all([
    client.from('time_entries').select('*'),
    client.from('week_submissions').select('*'),
    client.from('user_settings').select('*'),
  ]);

  if (entriesRes.error) throw new Error(entriesRes.error.message);
  if (submissionsRes.error) throw new Error(submissionsRes.error.message);
  if (settingsRes.error) throw new Error(settingsRes.error.message);

  const uid = state.user?.id;
  state.entries = (entriesRes.data ?? [])
    .filter((e) => !uid || e.user_id === uid)
    .map((e) => ({ ...e, work_date: normalizeDate(e.work_date) }))
    .sort((a, b) => a.work_date.localeCompare(b.work_date));
  state.submissions = (submissionsRes.data ?? [])
    .filter((s) => !uid || s.user_id === uid)
    .map((s) => ({
    ...s,
    week_start: normalizeDate(s.week_start),
  }));
  applySettingsToState(
    (settingsRes.data ?? []).find((s) => !uid || s.user_id === uid) ?? null,
  );

  await ensureDefaultWeekdayEntries();
  updateWeekUI();
}

function applySettingsToState(row) {
  state.settings = row;
  if (!row) return;
  els.employeeName.value = row.employee_name ?? '';
  els.bossEmail.value = row.boss_email ?? '';
  els.defaultStart.value = normalizeTime(row.default_start_time) || DEFAULT_START_TIME;
  els.weeklyReminder.checked = Boolean(row.weekly_reminder_enabled);
}

async function enterApp(freshSession = null) {
  const gen = ++enterAppGeneration;
  showMsg(els.authError, '');

  let accessToken;
  let user;

  if (freshSession?.access_token) {
    persistSession(freshSession);
    accessToken = freshSession.access_token;
    user = freshSession.user ?? null;
  } else {
    const restored = await restoreAuthSession(AUTH_URL);
    if (gen !== enterAppGeneration) return;
    if (!restored) {
      clearSession();
      showAuthPanel();
      showMsg(els.authError, 'Session expired. Sign in again.');
      return;
    }
    accessToken = restored.accessToken;
    user = restored.user;
  }

  if (!user) {
    const meRes = await fetch(`${AUTH_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (gen !== enterAppGeneration) return;
    if (!meRes.ok) {
      clearSession();
      showAuthPanel();
      showMsg(els.authError, 'Signed in but could not verify your account. Try again.');
      return;
    }
    const meBody = await meRes.json();
    user = meBody.user;
  }

  if (gen !== enterAppGeneration) return;

  client.setAccessToken(accessToken);
  state.user = user;
  els.status.textContent = user.email;

  try {
    await loadData();
  } catch (err) {
    if (gen !== enterAppGeneration) return;
    clearSession();
    showAuthPanel();
    showMsg(els.authError, err.message ?? 'Signed in but could not load your timesheet.');
    return;
  }

  if (gen !== enterAppGeneration) return;

  showAppPanel();
  maybeShowLocalWeeklyReminder(
    Boolean(state.settings?.weekly_reminder_enabled),
    weekStartFor,
  );
}

if (els.hardRefreshBtn) {
  els.hardRefreshBtn.addEventListener('click', () => {
    hardRefresh();
  });
}

document.getElementById('prev-week').addEventListener('click', async () => {
  state.weekStart = addDays(state.weekStart, -7);
  try {
    await refreshWeekView();
  } catch (err) {
    showMsg(els.submitError, err.message ?? 'Failed to load week');
  }
});

document.getElementById('next-week').addEventListener('click', async () => {
  state.weekStart = addDays(state.weekStart, 7);
  try {
    await refreshWeekView();
  } catch (err) {
    showMsg(els.submitError, err.message ?? 'Failed to load week');
  }
});

els.daysList.addEventListener('click', async (e) => {
  if (state.locked) return;
  const row = e.target.closest('.day-row');
  if (!row) return;

  if (e.target.closest('.save-day')) {
    const btn = e.target.closest('.save-day');
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      await saveDayEntry(row);
    } finally {
      btn.disabled = state.locked;
    }
    return;
  }

  if (e.target.closest('.delete-day')) {
    const btn = e.target.closest('.delete-day');
    if (btn.disabled) return;
    await deleteDayEntry(row);
  }
});

els.daysList.addEventListener('change', (e) => {
  if (state.locked) return;
  const row = e.target.closest('.day-row');
  if (!row) return;

  if (e.target.classList.contains('day-mode')) {
    setRowMode(row, e.target.value);
    updateRowStats(row);
    return;
  }
  if (e.target.classList.contains('day-leave-type')) {
    syncLeaveDurationVisibility(row);
    updateRowStats(row);
    return;
  }
  if (e.target.classList.contains('day-leave-duration')) {
    updateRowStats(row);
  }
});

els.daysList.addEventListener('input', (e) => {
  if (state.locked) return;
  const row = e.target.closest('.day-row');
  if (!row) return;

  if (e.target.classList.contains('day-start')) {
    if (row.dataset.hasEntry !== '1' && row.dataset.finishEdited !== '1') {
      const endInput = row.querySelector('.day-end');
      if (endInput) endInput.value = defaultFinishTime(e.target.value);
    }
    updateRowStats(row);
  } else if (e.target.classList.contains('day-end')) {
    row.dataset.finishEdited = '1';
    updateRowStats(row);
  }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg(els.authError, '');
  const email = document.getElementById('li-email').value.trim();
  const password = document.getElementById('li-password').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const btnLabel = submitBtn?.textContent ?? 'Sign in';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';
  }

  try {
    const res = await fetch(`${AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    let body = {};
    try {
      body = await res.json();
    } catch {
      body = {};
    }
    if (!res.ok) {
      const msg =
        body.error === 'invalid_credentials'
          ? 'Invalid email or password.'
          : body.message ?? 'Invalid email or password';
      return showMsg(els.authError, msg);
    }
    if (!body.access_token) {
      return showMsg(els.authError, 'Sign in failed — no session received from server');
    }
    await enterApp(body);
  } catch (err) {
    showMsg(els.authError, err.message ?? 'Sign in failed — check your connection');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = btnLabel;
    }
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  const { refreshToken } = loadTokens();
  await client.auth.signOut(refreshToken ?? undefined);
  clearSession();
  showAuthPanel();
  els.status.textContent = 'Signed out';
});

document.getElementById('settings-btn').addEventListener('click', async () => {
  els.appPanel.hidden = true;
  els.settingsPanel.hidden = false;
  showMsg(els.settingsError, '');
  showMsg(els.settingsSuccess, '');
  try {
    const settingsRes = await client.from('user_settings').select('*');
    if (settingsRes.error) throw new Error(settingsRes.error.message);
    const uid = state.user?.id;
    applySettingsToState(
      (settingsRes.data ?? []).find((s) => !uid || s.user_id === uid) ?? null,
    );
  } catch (err) {
    showMsg(els.settingsError, err.message ?? 'Failed to load settings');
  }
});

document.getElementById('back-from-settings').addEventListener('click', () => {
  els.settingsPanel.hidden = true;
  els.appPanel.hidden = false;
});

document.getElementById('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg(els.settingsError, '');
  showMsg(els.settingsSuccess, '');

  const defaultStartTime = toApiTime(snapTimeToQuarterHour(els.defaultStart.value));
  if (!defaultStartTime) {
    return showMsg(els.settingsError, 'Choose a default start time');
  }

  const payload = {
    user_id: state.user.id,
    boss_email: els.bossEmail.value.trim(),
    employee_name: els.employeeName.value.trim() || null,
    default_start_time: defaultStartTime,
    weekly_reminder_enabled: els.weeklyReminder.checked,
  };

  let result;
  if (state.settings) {
    result = await client.from('user_settings').eq('user_id', state.user.id).update(payload);
  } else {
    result = await client.from('user_settings').insert(payload);
  }

  if (result.error) return showMsg(els.settingsError, result.error.message);

  const savedRow = Array.isArray(result.data) ? result.data[0] : result.data;
  if (savedRow) {
    applySettingsToState(savedRow);
  } else {
    state.settings = { ...payload };
    els.defaultStart.value = normalizeTime(payload.default_start_time);
    els.weeklyReminder.checked = payload.weekly_reminder_enabled;
  }

  try {
    if (payload.weekly_reminder_enabled) {
      await subscribeWeeklyReminder(client.getAccessToken());
    } else {
      await unsubscribeWeeklyReminder(client.getAccessToken());
    }
  } catch (err) {
    showMsg(
      els.settingsError,
      err.message ?? 'Settings saved but reminders could not be enabled',
    );
    await loadData();
    return;
  }

  showMsg(els.settingsSuccess, 'Settings saved');
});

function currentSubmission() {
  return state.submissions.find(
    (s) => normalizeDate(s.week_start) === state.weekStart,
  );
}

els.unlockWeek.addEventListener('click', async () => {
  showMsg(els.submitError, '');
  showMsg(els.submitSuccess, '');
  if (!state.locked) return;

  if (!confirm(`Unlock week ${formatDateRangeNz(state.weekStart, addDays(state.weekStart, 6))} for editing? You can submit again later.`)) return;

  const submission = currentSubmission();
  let result;
  if (submission?.id) {
    result = await client.from('week_submissions').eq('id', submission.id).delete();
  } else {
    result = await client.from('week_submissions').eq('week_start', state.weekStart).delete();
  }

  if (result.error) return showMsg(els.submitError, result.error.message);
  showMsg(els.submitSuccess, 'Week unlocked — you can edit again');
  await loadData();
});

els.submitWeek.addEventListener('click', async () => {
  showMsg(els.submitError, '');
  showMsg(els.submitSuccess, '');

  if (!state.settings?.boss_email) {
    return showMsg(els.submitError, 'Set your boss email in Settings first');
  }

  if (!confirm(`Send timesheet for week ${formatDateRangeNz(state.weekStart, addDays(state.weekStart, 6))}? This will lock the week.`)) return;

  const res = await fetch(`${MAIL_URL}/mail/timesheet/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${client.getAccessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ week_start: state.weekStart }),
  });
  const body = await res.json();
  if (!res.ok) return showMsg(els.submitError, body.message ?? 'Submit failed');

  showMsg(els.submitSuccess, `Sent to ${body.email_sent_to}`);
  await loadData();
});

const params = new URLSearchParams(window.location.search);
const inviteToken = params.get('invite_token');

async function loadInvitePanel(token) {
  showInvitePanel();
  showMsg(els.inviteError, '');
  try {
    const res = await fetch(`${AUTH_URL}/auth/invite/${encodeURIComponent(token)}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.message ?? 'Invalid invite');
    const project = body.project_name ? ` for ${body.project_name}` : '';
    els.inviteEmailLabel.textContent = `Create your account (${body.email})${project}.`;
    els.inviteForm.dataset.token = token;
  } catch (err) {
    els.inviteEmailLabel.textContent = err.message ?? 'Invite not found';
    els.inviteForm.querySelector('button').disabled = true;
  }
}

if (els.inviteForm) {
  els.inviteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMsg(els.inviteError, '');
    const token = els.inviteForm.dataset.token;
    const password = document.getElementById('invite-password').value;
    try {
      const res = await fetch(`${AUTH_URL}/auth/invite/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? 'Could not accept invite');
      window.history.replaceState({}, '', window.location.pathname);
      await enterApp(body);
    } catch (err) {
      showMsg(els.inviteError, err.message ?? 'Could not accept invite');
    }
  });
}

if (inviteToken) {
  loadInvitePanel(inviteToken);
} else if (params.get('access_token')) {
  const oauthSession = {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
  };
  window.history.replaceState({}, '', window.location.pathname);
  enterApp(oauthSession);
} else if (initialTokens.accessToken || initialTokens.refreshToken) {
  enterApp().catch((err) => {
    clearSession();
    showAuthPanel();
    showMsg(els.authError, err.message ?? 'Could not restore your session. Sign in again.');
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !state.user) return;
  maybeShowLocalWeeklyReminder(
    Boolean(state.settings?.weekly_reminder_enabled),
    weekStartFor,
  );
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js?v=22').catch(() => {});
}
