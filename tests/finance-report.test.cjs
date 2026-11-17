const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { revenuePeriod, revenueReport } = load('src/components/admin/financeReport.ts');

test('revenue period uses Lagos calendar dates without shifting month start into the previous month', () => {
  assert.deepEqual(revenuePeriod(new Date('2026-11-17T13:00:00Z')), { startDate: '2026-11-01', endDate: '2026-11-17' });
  assert.deepEqual(revenuePeriod(new Date('2026-10-31T23:30:00Z')), { startDate: '2026-11-01', endDate: '2026-11-01' });
  assert.deepEqual(revenuePeriod(new Date('2026-12-31T23:30:00Z')), { startDate: '2027-01-01', endDate: '2027-01-01' });
});

test('revenue report reads actual nested totals and the backend period', () => {
  const period = { startDate: '2026-11-01', endDate: '2026-11-17' };
  const report = revenueReport({ success: true, data: { start_date: '2026-11-01T00:00:00Z', end_date: '2026-11-17T00:00:00Z', total_revenue: '12000.50', total_commission: '600', total_orders: 3 } }, period);
  assert.deepEqual(report.map(row => row.value), ['2026-11-01 to 2026-11-17', '12000.50', '600', '3']);
  const zeros = revenueReport({ success: true, data: { total_revenue: '0', total_commission: '0', total_orders: 0 } }, period);
  assert.deepEqual(zeros.slice(1).map(row => row.value), ['0', '0', '0']);
});

test('missing totals never become zero and failed reports remain errors', () => {
  const period = revenuePeriod();
  for (const value of [null, '', ' ', true, 'invalid', Infinity]) {
    assert.equal(revenueReport({ data: { total_revenue: value } }, period)[1].value, 'Not reported');
  }
  assert.throws(() => revenueReport({ success: false, error: 'Unavailable' }, period), /Unavailable/);
  assert.throws(() => revenueReport({ data: { success: false } }, period));
});
