import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LUNCH_HOURS,
  calcDay,
  calcWeek,
  defaultFinishTime,
  formatHours,
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
    assert.equal(formatHours(week.totalPaid), '42.25');
  });
});

describe('defaultFinishTime', () => {
  it('08:00 start → 16:30 finish on clock', () => {
    assert.equal(defaultFinishTime('08:00'), '16:30');
  });
});
