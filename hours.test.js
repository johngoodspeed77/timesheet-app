import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LUNCH_HOURS,
  LEAVE_DURATIONS,
  LEAVE_TYPES,
  calcDay,
  calcLeaveDay,
  calcWeek,
  defaultFinishTime,
  defaultRowModeForDate,
  defaultShiftTimes,
  expectedWeeklyHours,
  formatHours,
  isPaidLeaveType,
  isWeekend,
  isWorkDay,
  listShiftHourOptions,
  rowModeForEntry,
  leaveTypesForSelect,
  leaveCreditHours,
  leaveDurationLabel,
  leaveTypeLabel,
  listQuarterHourTimes,
  parseTimeToHours,
  quarterHourSelectHtml,
  shiftHoursFromSettings,
  snapTimeToQuarterHour,
  typicalWeekSummary,
  workDatesInWeek,
  workDaysFromSettings,
} from './hours.js';

describe('calcDay', () => {
  it('default shift 08:00–16:30 → 8.00h worked', () => {
    const day = calcDay('2026-06-24', '08:00', '16:30');
    assert.equal(day.worked, 8);
    assert.equal(day.dailyOt, 0);
    assert.equal(day.totalPaid, 8);
  });

  it('screenshot week grid Mon–Fri', () => {
    const cases = [
      { date: '2026-06-22', start: '07:30', end: '16:00', worked: 8, ot: 0, paid: 8 },
      { date: '2026-06-23', start: '07:00', end: '15:30', worked: 8, ot: 0, paid: 8 },
      { date: '2026-06-24', start: '08:00', end: '16:30', worked: 8, ot: 0, paid: 8 },
      { date: '2026-06-25', start: '07:30', end: '17:30', worked: 9.5, ot: 1.5, paid: 10.25 },
      { date: '2026-06-26', start: '08:00', end: '16:30', worked: 8, ot: 0, paid: 8 },
    ];
    for (const { date, start, end, worked, ot, paid } of cases) {
      const day = calcDay(date, start, end);
      assert.equal(day.worked, worked, `${date} worked`);
      assert.equal(day.dailyOt, ot, `${date} OT`);
      assert.equal(day.totalPaid, paid, `${date} paid`);
    }
  });

  it('deducts lunch from gross time', () => {
    const gross = parseTimeToHours('16:00') - parseTimeToHours('07:30');
    assert.equal(gross, 8.5);
    const day = calcDay('2026-06-22', '07:30', '16:00');
    assert.equal(day.worked, gross - LUNCH_HOURS);
  });

  it('clamps negative gross to zero worked', () => {
    const day = calcDay('2026-06-22', '16:00', '08:00');
    assert.equal(day.worked, 0);
    assert.equal(day.dailyOt, 0);
  });

  it('Saturday rate applies 1.5×', () => {
    const day = calcDay('2026-06-27', '08:00', '16:30');
    assert.equal(day.rate, 1.5);
    assert.equal(day.worked, 8);
    assert.equal(day.totalPaid, 12);
  });
});

describe('calcWeek', () => {
  it('rolls up screenshot week totals', () => {
    const weekStart = '2026-06-22';
    const entries = [
      { work_date: '2026-06-22', start_time: '07:30:00', end_time: '16:00:00' },
      { work_date: '2026-06-23', start_time: '07:00:00', end_time: '15:30:00' },
      { work_date: '2026-06-24', start_time: '08:00:00', end_time: '16:30:00' },
      { work_date: '2026-06-25', start_time: '07:30:00', end_time: '17:30:00' },
      { work_date: '2026-06-26', start_time: '08:00:00', end_time: '16:30:00' },
    ];
    const week = calcWeek(entries, weekStart);
    assert.equal(formatHours(week.totalWorked), '41.50');
    assert.equal(formatHours(week.totalRegular), '40.00');
    assert.equal(formatHours(week.totalOt), '1.50');
    assert.equal(formatHours(week.totalLeaveHours), '0.00');
  });

  it('credits paid leave and zero-hour non-paid leave', () => {
    const weekStart = '2026-06-22';
    const entries = [
      { work_date: '2026-06-22', entry_type: 'leave', leave_type: 'annual_leave', leave_duration: 'full' },
      { work_date: '2026-06-23', entry_type: 'leave', leave_type: 'sick_leave', leave_duration: 'am' },
      { work_date: '2026-06-24', entry_type: 'leave', leave_type: 'day_off' },
      { work_date: '2026-06-25', entry_type: 'leave', leave_type: 'non_paid_leave' },
    ];
    const week = calcWeek(entries, weekStart);
    assert.equal(week.totalLeaveHours, 12);
    assert.equal(leaveCreditHours('annual_leave', 'full'), 8);
    assert.equal(leaveCreditHours('sick_leave', 'am'), 4);
    assert.equal(leaveCreditHours('day_off', null), 0);
    assert.equal(leaveCreditHours('non_paid_leave', null), 0);
    assert.equal(calcLeaveDay(entries[0]).label, 'Annual leave');
  });
});

describe('defaultFinishTime', () => {
  it('08:00 start → 16:30 finish on clock', () => {
    assert.equal(defaultFinishTime('08:00'), '16:30');
  });

  it('6 h shift from 09:00 → 15:30 finish', () => {
    assert.equal(defaultFinishTime('09:00', 6), '15:30');
  });
});

describe('work schedule', () => {
  it('null settings defaults to full-time Mon–Fri 40 h week at 08:00', () => {
    assert.deepEqual(workDaysFromSettings(null), [1, 2, 3, 4, 5]);
    assert.equal(expectedWeeklyHours(null), 40);
    const summary = typicalWeekSummary(null);
    assert.match(summary, /40\.00 h worked/);
    assert.match(summary, /Mon, Tue, Wed, Thu, Fri/);
    assert.match(summary, /08:00–16:30/);
  });

  const partTime = { work_days: [1, 3, 5], shift_hours: 8, default_start_time: '08:00:00' };

  it('Mon/Wed/Fri yields 3 work dates and 24 h week', () => {
    const dates = workDatesInWeek('2026-06-22', partTime);
    assert.equal(dates.length, 3);
    assert.deepEqual(dates, ['2026-06-22', '2026-06-24', '2026-06-26']);
    assert.equal(expectedWeeklyHours(partTime), 24);
  });

  it('Saturday in work_days defaults row to work', () => {
    const satWorker = { work_days: [6], shift_hours: 8 };
    assert.equal(defaultRowModeForDate('2026-06-27', satWorker), 'work');
    assert.equal(isWorkDay('2026-06-27', satWorker), true);
  });

  it('non-work day defaults to day off', () => {
    assert.equal(defaultRowModeForDate('2026-06-23', partTime), 'day_off');
  });

  it('typicalWeekSummary describes part-time pattern', () => {
    const summary = typicalWeekSummary(partTime);
    assert.match(summary, /24\.00 h worked/);
    assert.match(summary, /Mon, Wed, Fri/);
  });

  it('listShiftHourOptions spans 4–12 h in half-hour steps', () => {
    const opts = listShiftHourOptions();
    assert.equal(opts[0], 4);
    assert.equal(opts[opts.length - 1], 12);
    assert.equal(opts.length, 17);
  });
});

describe('isWeekend', () => {
  it('Saturday and Sunday are weekends', () => {
    assert.equal(isWeekend('2026-06-27'), true);
    assert.equal(isWeekend('2026-06-28'), true);
    assert.equal(isWeekend('2026-06-23'), false);
  });
});

describe('quarter-hour times', () => {
  it('lists 96 quarter-hour values from 00:00 to 23:45', () => {
    const times = listQuarterHourTimes();
    assert.equal(times.length, 96);
    assert.equal(times[0], '00:00');
    assert.equal(times[1], '00:15');
    assert.equal(times[times.length - 1], '23:45');
  });

  it('select HTML snaps invalid values to nearest quarter hour', () => {
    assert.equal(snapTimeToQuarterHour('08:07'), '08:00');
    assert.equal(snapTimeToQuarterHour('08:08'), '08:15');
    const html = quarterHourSelectHtml('day-start', '08:07');
    assert.match(html, /<select[^>]*class="quarter-hour-time day-start"/);
    assert.match(html, /<option value="08:00" selected>08:00<\/option>/);
    assert.doesNotMatch(html, /selected>08:07</);
  });
});

describe('row mode defaults', () => {
  it('weekdays default to work and weekends to day off', () => {
    assert.equal(defaultRowModeForDate('2026-06-23'), 'work');
    assert.equal(defaultRowModeForDate('2026-06-27'), 'day_off');
    assert.equal(defaultRowModeForDate('2026-06-28'), 'day_off');
  });

  it('maps saved entries to the correct row mode', () => {
    const fullTime = { work_days: [1, 2, 3, 4, 5], shift_hours: 8 };
    assert.equal(rowModeForEntry(null, '2026-06-23', fullTime), 'work');
    assert.equal(rowModeForEntry(null, '2026-06-27', fullTime), 'day_off');
    assert.equal(
      rowModeForEntry({ entry_type: 'leave', leave_type: 'day_off' }, '2026-06-23'),
      'day_off',
    );
    assert.equal(
      rowModeForEntry({ entry_type: 'leave', leave_type: 'annual_leave' }, '2026-06-23'),
      'leave',
    );
  });

  it('omits day off from leave type select options', () => {
    const keys = leaveTypesForSelect().map(([key]) => key);
    assert.ok(!keys.includes('day_off'));
    assert.ok(keys.includes('annual_leave'));
  });
});
