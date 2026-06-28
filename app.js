import { createClient } from '/sdk/index.js';
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
  formatDisplayDate,
  formatDateNz,
  formatDateRangeNz,
  formatHours,
  normalizeDate,
  normalizeTime,
  parseDateNz,
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

const client = createClient({
  url: DATA_URL,
  authUrl: AUTH_URL,
  accessToken: sessionStorage.getItem('sdb_access_token') ?? undefined,
});

const state = {
  user: null,
  weekStart: weekStartFor(new Date().toISOString().slice(0, 10)),
  entries: [],
  submissions: [],
  settings: null,
  locked: false,
  finishManuallyEdited: false,
};

const els = {
  status: document.getElementById('status'),
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
  totalPaid: document.getElementById('total-paid'),
  weekHoursHint: document.getElementById('week-hours-hint'),
  entryForm: document.getElementById('entry-form'),
  entryFormSection: document.getElementById('entry-form-section'),
  entryId: document.getElementById('entry-id'),
  entryDate: document.getElementById('entry-date'),
  entryStart: document.getElementById('entry-start'),
  entryEnd: document.getElementById('entry-end'),
  entryNotes: document.getElementById('entry-notes'),
  entryError: document.getElementById('entry-error'),
  submitWeek: document.getElementById('submit-week'),
  submitError: document.getElementById('submit-error'),
  submitSuccess: document.getElementById('submit-success'),
  employeeName: document.getElementById('employee-name'),
  bossEmail: document.getElementById('boss-email'),
  defaultStart: document.getElementById('default-start'),
  weeklyReminder: document.getElementById('weekly-reminder'),
  settingsError: document.getElementById('settings-error'),
  settingsSuccess: document.getElementById('settings-success'),
};

function showMsg(el, msg) {
  el.textContent = msg;
  el.hidden = !msg;
}

function persistSession(session) {
  sessionStorage.setItem('sdb_access_token', session.access_token);
  sessionStorage.setItem('sdb_refresh_token', session.refresh_token);
  client.setAccessToken(session.access_token);
}

function clearSession() {
  sessionStorage.removeItem('sdb_access_token');
  sessionStorage.removeItem('sdb_refresh_token');
  client.setAccessToken(null);
  state.user = null;
}

async function fetchMe() {
  const token = client.getAccessToken();
  if (!token) return { user: null, error: 'Not signed in' };

  let res;
  try {
    res = await fetch(`${AUTH_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    return { user: null, error: err.message ?? 'Network error' };
  }

  let body = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  if (!res.ok) {
    return { user: null, error: body.message ?? 'Session invalid' };
  }
  return { user: body.user ?? null, error: body.user ? null : 'User not found' };
}

function showAuthPanel() {
  els.authPanel.hidden = false;
  els.appPanel.hidden = true;
  els.settingsPanel.hidden = true;
}

function showAppPanel() {
  els.authPanel.hidden = true;
  els.settingsPanel.hidden = true;
  els.appPanel.hidden = false;
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

function updateWeekUI() {
  const weekEnd = addDays(state.weekStart, 6);
  els.weekLabel.textContent = formatDateRangeNz(state.weekStart, weekEnd);
  state.locked = state.submissions.some(
    (s) => normalizeDate(s.week_start) === state.weekStart,
  );
  els.lockedBanner.hidden = !state.locked;
  els.unlockWeek.hidden = !state.locked;
  els.entryFormSection.style.opacity = state.locked ? '0.5' : '1';
  els.entryForm.querySelectorAll('input, button').forEach((n) => {
    if (n.id !== 'clear-form') n.disabled = state.locked;
  });
  els.submitWeek.disabled = state.locked;

  const week = calcWeek(weekEntries(), state.weekStart);
  els.totalWorked.textContent = formatHours(week.totalWorked);
  els.totalRegular.textContent = formatHours(week.totalRegular);
  els.totalOt.textContent = formatHours(week.totalOt);
  els.totalPaid.textContent = formatHours(week.totalPaid);

  const defaultStart = normalizeTime(state.settings?.default_start_time) || DEFAULT_START_TIME;
  const { end: shiftEnd } = defaultShiftTimes(state.settings);
  if (els.weekHoursHint) {
    els.weekHoursHint.textContent =
      `Mon–Fri auto-fill: ${defaultStart}–${shiftEnd} (${formatHours(STANDARD_WEEK_HOURS)} h week). Edit any day and Save to keep your changes.`;
  }

  els.daysList.innerHTML = '';
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(state.weekStart, i);
    const entry = state.entries.find((e) => normalizeDate(e.work_date) === date);
    const row = document.createElement('div');
    row.className = 'day-row';

    if (entry) {
      const day = calcDay(date, entry.start_time, entry.end_time);
      row.innerHTML = `
        <div class="day-info">
          <strong>${formatDisplayDate(date)}</strong>
          <span class="muted">${normalizeTime(entry.start_time)} – ${normalizeTime(entry.end_time)}</span>
        </div>
        <div class="day-stats">
          <span>${formatHours(day.worked)}h</span>
          <span class="muted">OT ${formatHours(day.dailyOt)}</span>
          <span class="paid">${formatHours(day.totalPaid)} paid</span>
        </div>
        <button type="button" class="ghost sm edit-day" data-date="${date}" ${state.locked ? 'disabled' : ''}>Edit</button>
      `;
    } else {
      row.innerHTML = `
        <div class="day-info"><strong>${formatDisplayDate(date)}</strong><span class="muted">No entry</span></div>
        <div></div>
        <button type="button" class="ghost sm edit-day" data-date="${date}" ${state.locked ? 'disabled' : ''}>Add</button>
      `;
    }
    els.daysList.appendChild(row);
  }

  els.daysList.querySelectorAll('.edit-day').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.locked || btn.disabled) return;
      loadEntryForm(btn.dataset.date);
    });
  });
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

  state.entries = (entriesRes.data ?? [])
    .map((e) => ({ ...e, work_date: normalizeDate(e.work_date) }))
    .sort((a, b) => a.work_date.localeCompare(b.work_date));
  state.submissions = (submissionsRes.data ?? []).map((s) => ({
    ...s,
    week_start: normalizeDate(s.week_start),
  }));
  applySettingsToState(settingsRes.data?.[0] ?? null);

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

async function enterApp() {
  showMsg(els.authError, '');
  showMsg(els.entryError, '');

  const me = await fetchMe();
  if (!me.user) {
    clearSession();
    showAuthPanel();
    showMsg(els.authError, me.error ?? 'Could not verify your session. Sign in again.');
    return;
  }

  state.user = me.user;
  els.status.textContent = me.user.email;

  try {
    await loadData();
  } catch (err) {
    clearSession();
    showAuthPanel();
    showMsg(els.authError, err.message ?? 'Signed in but could not load your timesheet.');
    return;
  }

  showAppPanel();
  maybeShowLocalWeeklyReminder(
    Boolean(state.settings?.weekly_reminder_enabled),
    weekStartFor,
  );
}

function applyDefaultShiftToForm() {
  const { start, end } = defaultShiftTimes(state.settings, els.defaultStart.value);
  els.entryStart.value = start;
  els.entryEnd.value = end;
  state.finishManuallyEdited = false;
}

function loadEntryForm(date) {
  showMsg(els.entryError, '');
  const entry = state.entries.find((e) => normalizeDate(e.work_date) === date);
  els.entryId.value = entry?.id ?? '';
  els.entryDate.value = formatDateNz(date);
  if (entry) {
    els.entryStart.value = normalizeTime(entry.start_time);
    els.entryEnd.value = normalizeTime(entry.end_time);
    state.finishManuallyEdited = true;
  } else {
    applyDefaultShiftToForm();
  }
  els.entryNotes.value = entry?.notes ?? '';
  els.entryFormSection.scrollIntoView({ behavior: 'smooth' });
}

function clearEntryForm() {
  els.entryId.value = '';
  els.entryDate.value = formatDateNz(addDays(state.weekStart, 0));
  applyDefaultShiftToForm();
  els.entryNotes.value = '';
  showMsg(els.entryError, '');
}

document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg(els.authError, '');
  try {
    const res = await fetch(`${AUTH_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('su-email').value,
        password: document.getElementById('su-password').value,
      }),
    });
    let body = {};
    try {
      body = await res.json();
    } catch {
      body = {};
    }
    if (!res.ok) {
      const msg =
        body.error === 'email_exists'
          ? 'An account with this email already exists — use Sign in below.'
          : body.message ?? 'Sign up failed';
      return showMsg(els.authError, msg);
    }
    persistSession(body);
    await enterApp();
  } catch (err) {
    showMsg(els.authError, err.message ?? 'Sign up failed — check your connection');
  }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg(els.authError, '');
  const email = document.getElementById('li-email').value.trim();
  const password = document.getElementById('li-password').value;

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
      return showMsg(els.authError, body.message ?? 'Invalid email or password');
    }
    if (!body.access_token) {
      return showMsg(els.authError, 'Sign in failed — no session received from server');
    }
    persistSession(body);
    await enterApp();
  } catch (err) {
    showMsg(els.authError, err.message ?? 'Sign in failed — check your connection');
  }
});

document.getElementById('google-btn').addEventListener('click', () => {
  window.location.href = `${AUTH_URL}/auth/signin/google?redirect_to=${encodeURIComponent(window.location.origin)}`;
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await client.auth.signOut(sessionStorage.getItem('sdb_refresh_token') ?? undefined);
  clearSession();
  els.authPanel.hidden = false;
  els.appPanel.hidden = true;
  els.settingsPanel.hidden = true;
  els.status.textContent = 'Signed out';
});

document.getElementById('prev-week').addEventListener('click', async () => {
  state.weekStart = addDays(state.weekStart, -7);
  try {
    await refreshWeekView();
  } catch (err) {
    showMsg(els.entryError, err.message ?? 'Failed to load week');
  }
});

document.getElementById('next-week').addEventListener('click', async () => {
  state.weekStart = addDays(state.weekStart, 7);
  try {
    await refreshWeekView();
  } catch (err) {
    showMsg(els.entryError, err.message ?? 'Failed to load week');
  }
});

els.entryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (state.locked) return;
  showMsg(els.entryError, '');

  const workDate = parseDateNz(els.entryDate.value);
  if (!workDate) {
    return showMsg(els.entryError, 'Enter date as DD/MM/YYYY');
  }

  const startTime = toApiTime(els.entryStart.value);
  const endTime = toApiTime(els.entryEnd.value);
  if (!startTime || !endTime) {
    return showMsg(els.entryError, 'Enter valid start and finish times');
  }

  const payload = {
    work_date: workDate,
    start_time: startTime,
    end_time: endTime,
    notes: els.entryNotes.value || null,
    user_id: state.user.id,
  };

  const existing = state.entries.find(
    (e) => normalizeDate(e.work_date) === workDate,
  );
  const id = els.entryId.value || existing?.id;
  let result;
  if (id) {
    result = await client.from('time_entries').eq('id', id).update(payload);
  } else {
    result = await client.from('time_entries').insert(payload);
  }

  if (result.error) return showMsg(els.entryError, result.error.message);
  clearEntryForm();
  await loadData();
});

document.getElementById('delete-entry').addEventListener('click', async () => {
  const id = els.entryId.value;
  if (!id || state.locked) return;
  if (!confirm('Delete this day entry?')) return;
  const { error } = await client.from('time_entries').eq('id', id).delete();
  if (error) return showMsg(els.entryError, error.message);
  clearEntryForm();
  await loadData();
});

document.getElementById('clear-form').addEventListener('click', clearEntryForm);

els.entryEnd.addEventListener('input', () => {
  state.finishManuallyEdited = true;
});

els.entryStart.addEventListener('input', () => {
  if (state.finishManuallyEdited || els.entryId.value) return;
  els.entryEnd.value = defaultFinishTime(els.entryStart.value);
});

document.getElementById('settings-btn').addEventListener('click', async () => {
  els.appPanel.hidden = true;
  els.settingsPanel.hidden = false;
  showMsg(els.settingsError, '');
  showMsg(els.settingsSuccess, '');
  try {
    const settingsRes = await client.from('user_settings').select('*');
    if (settingsRes.error) throw new Error(settingsRes.error.message);
    applySettingsToState(settingsRes.data?.[0] ?? null);
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

  const defaultStartTime = toApiTime(els.defaultStart.value);
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
if (params.get('access_token')) {
  persistSession({
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
  });
  window.history.replaceState({}, '', window.location.pathname);
  enterApp();
} else if (client.getAccessToken()) {
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
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
