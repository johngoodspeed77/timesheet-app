import { createClient } from '/sdk/index.js';
import {
  addDays,
  calcDay,
  calcWeek,
  formatDisplayDate,
  formatHours,
  normalizeDate,
  weekStartFor,
} from '/hours.js';

const AUTH_URL = (window.__SDB_AUTH_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const DATA_URL = (window.__SDB_DATA_URL ?? 'http://localhost:3002').replace(/\/$/, '');
const MAIL_URL = (window.__SDB_MAIL_URL ?? 'http://localhost:3004').replace(/\/$/, '');

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
  totalWorked: document.getElementById('total-worked'),
  totalRegular: document.getElementById('total-regular'),
  totalOt: document.getElementById('total-ot'),
  totalPaid: document.getElementById('total-paid'),
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
  const res = await fetch(`${AUTH_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${client.getAccessToken()}` },
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body.user ?? null;
}

function weekEntries() {
  const end = addDays(state.weekStart, 6);
  return state.entries.filter((e) => {
    const d = normalizeDate(e.work_date);
    return d >= state.weekStart && d <= end;
  });
}

function updateWeekUI() {
  const end = addDays(state.weekStart, 6);
  els.weekLabel.textContent = `${state.weekStart} — ${end}`;
  state.locked = state.submissions.some(
    (s) => normalizeDate(s.week_start) === state.weekStart,
  );
  els.lockedBanner.hidden = !state.locked;
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
          <span class="muted">${entry.start_time.slice(0, 5)} – ${entry.end_time.slice(0, 5)}</span>
        </div>
        <div class="day-stats">
          <span>${formatHours(day.worked)}h</span>
          <span class="muted">OT ${formatHours(day.dailyOt)}</span>
          <span class="paid">${formatHours(day.totalPaid)} paid</span>
        </div>
        <button type="button" class="ghost sm edit-day" data-date="${date}">Edit</button>
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
    btn.addEventListener('click', () => loadEntryForm(btn.dataset.date));
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

  state.entries = (entriesRes.data ?? [])
    .map((e) => ({ ...e, work_date: normalizeDate(e.work_date) }))
    .sort((a, b) => a.work_date.localeCompare(b.work_date));
  state.submissions = (submissionsRes.data ?? []).map((s) => ({
    ...s,
    week_start: normalizeDate(s.week_start),
  }));
  state.settings = settingsRes.data?.[0] ?? null;

  if (state.settings) {
    els.employeeName.value = state.settings.employee_name ?? '';
    els.bossEmail.value = state.settings.boss_email ?? '';
  }

  updateWeekUI();
}

async function enterApp() {
  state.user = await fetchMe();
  if (!state.user) {
    clearSession();
    return;
  }

  els.status.textContent = state.user.email;
  els.authPanel.hidden = true;
  els.settingsPanel.hidden = true;
  els.appPanel.hidden = false;

  try {
    await loadData();
  } catch (err) {
    showMsg(els.entryError, err.message ?? 'Failed to load data');
  }
}

function loadEntryForm(date) {
  showMsg(els.entryError, '');
  const entry = state.entries.find((e) => normalizeDate(e.work_date) === date);
  els.entryId.value = entry?.id ?? '';
  els.entryDate.value = date;
  els.entryStart.value = entry?.start_time?.slice(0, 5) ?? '07:00';
  els.entryEnd.value = entry?.end_time?.slice(0, 5) ?? '15:30';
  els.entryNotes.value = entry?.notes ?? '';
  els.entryFormSection.scrollIntoView({ behavior: 'smooth' });
}

function clearEntryForm() {
  els.entryId.value = '';
  els.entryDate.value = addDays(state.weekStart, 0);
  els.entryStart.value = '07:00';
  els.entryEnd.value = '15:30';
  els.entryNotes.value = '';
  showMsg(els.entryError, '');
}

document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg(els.authError, '');
  const res = await fetch(`${AUTH_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: document.getElementById('su-email').value,
      password: document.getElementById('su-password').value,
    }),
  });
  const body = await res.json();
  if (!res.ok) return showMsg(els.authError, body.message ?? 'Sign up failed');
  persistSession(body);
  await enterApp();
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg(els.authError, '');
  const { data, error } = await client.auth.signInWithPassword({
    email: document.getElementById('li-email').value,
    password: document.getElementById('li-password').value,
  });
  if (error) return showMsg(els.authError, error.message);
  persistSession(data);
  await enterApp();
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

document.getElementById('prev-week').addEventListener('click', () => {
  state.weekStart = addDays(state.weekStart, -7);
  updateWeekUI();
});

document.getElementById('next-week').addEventListener('click', () => {
  state.weekStart = addDays(state.weekStart, 7);
  updateWeekUI();
});

els.entryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (state.locked) return;
  showMsg(els.entryError, '');

  const payload = {
    work_date: els.entryDate.value,
    start_time: els.entryStart.value,
    end_time: els.entryEnd.value,
    notes: els.entryNotes.value || null,
    user_id: state.user.id,
  };

  const existing = state.entries.find(
    (e) => normalizeDate(e.work_date) === els.entryDate.value,
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

document.getElementById('settings-btn').addEventListener('click', () => {
  els.appPanel.hidden = true;
  els.settingsPanel.hidden = false;
});

document.getElementById('back-from-settings').addEventListener('click', () => {
  els.settingsPanel.hidden = true;
  els.appPanel.hidden = false;
});

document.getElementById('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg(els.settingsError, '');
  showMsg(els.settingsSuccess, '');

  const payload = {
    user_id: state.user.id,
    boss_email: els.bossEmail.value.trim(),
    employee_name: els.employeeName.value.trim() || null,
  };

  let result;
  if (state.settings) {
    result = await client.from('user_settings').eq('user_id', state.user.id).update(payload);
  } else {
    result = await client.from('user_settings').insert(payload);
  }

  if (result.error) return showMsg(els.settingsError, result.error.message);
  showMsg(els.settingsSuccess, 'Settings saved');
  await loadData();
});

els.submitWeek.addEventListener('click', async () => {
  showMsg(els.submitError, '');
  showMsg(els.submitSuccess, '');

  if (!state.settings?.boss_email) {
    return showMsg(els.submitError, 'Set your boss email in Settings first');
  }

  if (!confirm(`Send timesheet for week ${state.weekStart}? This will lock the week.`)) return;

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
  enterApp();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
