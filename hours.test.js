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
  formatHours,
  isPaidLeaveType,
  isWeekend,
  defaultRowModeForDate,
  rowModeForEntry,
  leaveTypesForSelect,
  leaveCreditHours,
  leaveDurationLabel,
  leaveTypeLabel,
  parseTimeToHours,
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
});

describe('isWeekend', () => {
  it('Saturday and Sunday are weekends', () => {
    assert.equal(isWeekend('2026-06-27'), true);
    assert.equal(isWeekend('2026-06-28'), true);
    assert.equal(isWeekend('2026-06-23'), false);
  });
});

describe('row mode defaults', () => {
  it('weekdays default to work and weekends to day off', () => {
    assert.equal(defaultRowModeForDate('2026-06-23'), 'work');
    assert.equal(defaultRowModeForDate('2026-06-27'), 'day_off');
    assert.equal(defaultRowModeForDate('2026-06-28'), 'day_off');
  });

  it('maps saved entries to the correct row mode', () => {
    assert.equal(rowModeForEntry(null, '2026-06-23'), 'work');
    assert.equal(rowModeForEntry(null, '2026-06-27'), 'day_off');
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
