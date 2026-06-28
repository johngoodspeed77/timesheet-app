export function parseTimeToHours(time) {
  const [h, m, s] = time.split(':').map(Number);
  return h + (m || 0) / 60 + (s || 0) / 3600;
}

/** API DATE columns may arrive as ISO timestamps — normalize to YYYY-MM-DD. */
export function normalizeDate(value) {
  if (!value) return '';
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** Display date in New Zealand format (DD/MM/YYYY). */
export function formatDateNz(isoDate) {
  const iso = normalizeDate(isoDate);
  if (!iso || iso.length < 10) return iso || '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Parse DD/MM/YYYY to ISO YYYY-MM-DD for API storage. */
export function parseDateNz(nzDate) {
  const m = String(nzDate ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const iso = `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const d = new Date(`${iso}T12:00:00`);
  if (d.getFullYear() !== yyyy || d.getMonth() + 1 !== mm || d.getDate() !== dd) return null;
  return iso;
}

export function formatDateRangeNz(startIso, endIso) {
  return `${formatDateNz(startIso)} — ${formatDateNz(endIso)}`;
}

/** Clock time from API or input — normalize to HH:MM. */
export function normalizeTime(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }
  const s = String(value);
  if (s.includes('T')) {
    const timePart = s.split('T')[1] ?? '';
    return timePart.slice(0, 5);
  }
  return s.length >= 5 ? s.slice(0, 5) : s;
}

/** Send TIME columns to the API as HH:MM:SS. */
export function toApiTime(value) {
  const t = normalizeTime(value);
  if (!t) return '07:00:00';
  return t.length === 5 ? `${t}:00` : t;
}

/** Hours on the clock for a default shift (finish = start + this). */
export const SHIFT_HOURS = 8;

export function addHoursToTime(timeStr, hours) {
  const total = parseTimeToHours(timeStr) + hours;
  const wrapped = ((total % 24) + 24) % 24;
  const h = Math.floor(wrapped);
  const m = Math.round((wrapped - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function defaultShiftTimes(settings, fallbackStart) {
  const start =
    normalizeTime(settings?.default_start_time) ||
    normalizeTime(fallbackStart) ||
    '07:00';
  return { start, end: addHoursToTime(start, SHIFT_HOURS) };
}

export function formatHours(n) {
  return n.toFixed(2);
}

export function dayRate(workDate) {
  const d = new Date(`${workDate}T12:00:00`);
  const dow = d.getDay();
  if (dow === 0) return 2.0;
  if (dow === 6) return 1.5;
  return 1.0;
}

export function weekStartFor(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function calcDay(workDate, startTime, endTime) {
  const gross = parseTimeToHours(endTime) - parseTimeToHours(startTime);
  const worked = Math.max(0, gross - 0.5);
  const rate = dayRate(workDate);
  const regular = Math.min(worked, 8);
  const dailyOt = Math.max(0, worked - 8);
  const paidRegular = regular * rate;
  const paidOt = dailyOt * rate * 1.5;
  return {
    workDate,
    worked,
    regular,
    dailyOt,
    rate,
    paidRegular,
    paidOt,
    totalPaid: paidRegular + paidOt,
  };
}

export function calcWeek(entries, weekStart) {
  const byDate = new Map(entries.map((e) => [normalizeDate(e.work_date), e]));
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(weekStart, i);
    const entry = byDate.get(date);
    if (entry) {
      days.push(calcDay(date, entry.start_time, entry.end_time));
    }
  }
  return {
    days,
    totalWorked: days.reduce((s, d) => s + d.worked, 0),
    totalRegular: days.reduce((s, d) => s + d.regular, 0),
    totalOt: days.reduce((s, d) => s + d.dailyOt, 0),
    totalPaid: days.reduce((s, d) => s + d.totalPaid, 0),
  };
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDisplayDate(dateStr) {
  const d = new Date(`${normalizeDate(dateStr)}T12:00:00`);
  return `${DAY_NAMES[d.getDay()]} ${formatDateNz(dateStr)}`;
}
