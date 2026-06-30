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

/** Clock time from API or input — normalize to HH:MM (no timezone shift). */
export function normalizeTime(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
  }
  const s = String(value).trim();
  const iso = s.match(/T(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}`;
  const plain = s.match(/^(\d{1,2}):(\d{2})/);
  if (plain) return `${plain[1].padStart(2, '0')}:${plain[2]}`;
  return '';
}

/** Send TIME columns to the API as HH:MM:SS. */
export function toApiTime(value) {
  const t = normalizeTime(value);
  if (!t) return null;
  return `${t}:00`;
}

/** Snap clock time to nearest 15 minutes (quarter-hour picker). */
export function snapTimeToQuarterHour(value) {
  const t = normalizeTime(value);
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const totalMins = h * 60 + (m || 0);
  const snapped = Math.round(totalMins / 15) * 15;
  const wrapped = ((snapped % (24 * 60)) + 24 * 60) % (24 * 60);
  const nh = Math.floor(wrapped / 60);
  const nm = wrapped % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

/** Paid/worked hours for a default shift. */
export const SHIFT_HOURS = 8;

/** Standard Mon–Fri week: 5 × 8 h worked. */
export const STANDARD_WEEK_HOURS = 40;

/** Default clock-on time for auto-filled weekdays (Mon 8:00 → 40 h week). */
export const DEFAULT_START_TIME = '08:00';

/** Lunch break deducted from gross time (see calcDay). */
export const LUNCH_HOURS = 0.5;

export function addHoursToTime(timeStr, hours) {
  const total = parseTimeToHours(timeStr) + hours;
  const wrapped = ((total % 24) + 24) % 24;
  const h = Math.floor(wrapped);
  const m = Math.round((wrapped - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Default finish on the clock: start + shift + lunch (8h worked after 30 min lunch). */
export function defaultFinishTime(startStr) {
  return addHoursToTime(startStr, SHIFT_HOURS + LUNCH_HOURS);
}

export function defaultShiftTimes(settings, fallbackStart) {
  const start =
    normalizeTime(settings?.default_start_time) ||
    normalizeTime(fallbackStart) ||
    DEFAULT_START_TIME;
  return { start, end: defaultFinishTime(start) };
}

export function weekdayDatesInWeek(weekStart) {
  const dates = [];
  for (let i = 0; i < 5; i += 1) {
    dates.push(addDays(weekStart, i));
  }
  return dates;
}

export function formatHours(n) {
  return n.toFixed(2);
}

export function isWeekend(workDate) {
  const dow = new Date(`${normalizeDate(workDate)}T12:00:00`).getDay();
  return dow === 0 || dow === 6;
}

/** Default row mode when there is no saved entry for this date. */
export function defaultRowModeForDate(workDate) {
  return isWeekend(workDate) ? 'day_off' : 'work';
}

/** Map a saved entry (or lack of one) to the Work / Day off / Leave dropdown. */
export function rowModeForEntry(entry, workDate) {
  if (!entry) return defaultRowModeForDate(workDate);
  if (entryTypeFor(entry) === 'work') return 'work';
  if (entry.leave_type === 'day_off') return 'day_off';
  return 'leave';
}

/** Leave types shown when the row mode is Leave (day off has its own mode). */
export function leaveTypesForSelect() {
  return Object.entries(LEAVE_TYPES).filter(([key]) => key !== 'day_off');
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

export const LEAVE_TYPES = {
  day_off: { label: 'Day off', paid: false },
  non_paid_leave: { label: 'Non-paid leave', paid: false },
  annual_leave: { label: 'Annual leave', paid: true },
  sick_leave: { label: 'Sick leave', paid: true },
  medical_leave: { label: 'Medical leave', paid: true },
  bereavement_leave: { label: 'Bereavement leave', paid: true },
};

export const LEAVE_DURATIONS = {
  full: { label: 'Full day', hours: 8 },
  am: { label: 'AM', hours: 4 },
  pm: { label: 'PM', hours: 4 },
};

export function isPaidLeaveType(leaveType) {
  return Boolean(LEAVE_TYPES[leaveType]?.paid);
}

export function leaveTypeLabel(leaveType) {
  return LEAVE_TYPES[leaveType]?.label ?? leaveType;
}

export function leaveDurationLabel(leaveDuration) {
  return LEAVE_DURATIONS[leaveDuration]?.label ?? leaveDuration;
}

export function leaveCreditHours(leaveType, leaveDuration) {
  if (!isPaidLeaveType(leaveType)) return 0;
  return LEAVE_DURATIONS[leaveDuration]?.hours ?? 0;
}

export function entryTypeFor(entry) {
  return entry?.entry_type === 'leave' ? 'leave' : 'work';
}

export function calcLeaveDay(entry) {
  const workDate = normalizeDate(entry.work_date);
  const leaveType = entry.leave_type;
  const leaveDuration = entry.leave_duration ?? null;
  const leaveHours = leaveCreditHours(leaveType, leaveDuration);
  const label = leaveTypeLabel(leaveType);
  const durationPart =
    leaveHours > 0 && leaveDuration ? leaveDurationLabel(leaveDuration) : null;

  return {
    kind: 'leave',
    workDate,
    leaveType,
    leaveDuration,
    leaveHours,
    label,
    durationPart,
  };
}

export function calcDay(workDate, startTime, endTime) {
  const gross = parseTimeToHours(endTime) - parseTimeToHours(startTime);
  const worked = Math.max(0, gross - LUNCH_HOURS);
  const rate = dayRate(workDate);
  const regular = Math.min(worked, 8);
  const dailyOt = Math.max(0, worked - 8);
  const paidRegular = regular * rate;
  const paidOt = dailyOt * rate * 1.5;
  return {
    kind: 'work',
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
    if (!entry) continue;
    if (entryTypeFor(entry) === 'leave') {
      days.push(calcLeaveDay(entry));
    } else {
      days.push(calcDay(date, entry.start_time, entry.end_time));
    }
  }
  const workDays = days.filter((d) => d.kind === 'work');
  const leaveDays = days.filter((d) => d.kind === 'leave');
  return {
    days,
    totalWorked: workDays.reduce((s, d) => s + d.worked, 0),
    totalLeaveHours: leaveDays.reduce((s, d) => s + d.leaveHours, 0),
    totalRegular: workDays.reduce((s, d) => s + d.regular, 0),
    totalOt: workDays.reduce((s, d) => s + d.dailyOt, 0),
    totalPaid: workDays.reduce((s, d) => s + d.totalPaid, 0),
  };
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDisplayDate(dateStr) {
  const d = new Date(`${normalizeDate(dateStr)}T12:00:00`);
  return `${DAY_NAMES[d.getDay()]} ${formatDateNz(dateStr)}`;
}

export function formatWeekday(dateStr) {
  const d = new Date(`${normalizeDate(dateStr)}T12:00:00`);
  return DAY_NAMES[d.getDay()];
}
