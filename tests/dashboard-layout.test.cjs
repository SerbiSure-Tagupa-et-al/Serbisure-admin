const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const loader = require('./source-loader.cjs');
const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join('');

function activity(t, role, customBookings, customAuditLogs) {
  const exported = {};
  const state = {
    currentRole: role, selectedBarangay: 'Agusan', setActiveNav() {}, isLoadingDashboardActivity: false, isLoadingAuditLogs: false,
    bookings: Array.from({ length: 7 }, (_, index) => ({
      id: String(index + 1), homeownerName: `Homeowner ${index + 1}`, workerName: `Worker ${index + 1}`,
      homeownerAvatar: '', workerAvatar: '', offeredWage: 600, barangay: index === 6 ? 'Carmen' : 'Agusan',
      ratePeriod: index === 5 ? 'month' : 'day', contractType: index === 5 ? 'Formal Kasambahay (Long-Term)' : 'Short-Term On-Demand', bookingStatus: 'Accepted',
      createdAt: index === 0 ? '2026-11-15T17:00:00Z' : null,
    })),
    verifications: [{ id: 'doc', name: 'Document Applicant', role: 'KASAMBAHAY', documentType: 'Police Clearance', barangay: 'Agusan', submittedDate: 'Oct 20, 2026', status: 'VERIFIED', avatar: '' }],
    auditLogs: [{ log_id: 'log', actor_name: 'Reviewing Officer', actor_role: 'ADMIN', actor_barangay: 'Agusan', target_name: 'Document Applicant', target_barangay: 'Agusan', action: 'APPROVED', document_type: 'police_clearance', previous_status: 'PENDING', new_status: 'VERIFIED', created_at: '2026-10-20T08:00:00Z', reason: 'Reviewed submitted document' }],
  };
  if (customBookings) state.bookings = customBookings;
  if (customAuditLogs) state.auditLogs = customAuditLogs;
  const { DashboardActivityTable } = loader({
    'src/context/AdminContext.tsx': { useAdmin: () => state },
    jspdf: class {
      addImage() {}
      save(filename) { exported.filename = filename; }
    },
    html2canvas: async container => {
      exported.html = container.innerHTML;
      return { width: 1400, height: 800, toDataURL: () => 'data:image/png;base64,' };
    },
  })('src/components/dashboard/DashboardActivityTable.tsx');
  let view; act(() => { view = create(React.createElement(DashboardActivityTable), { createNodeMock: () => ({ innerHTML: '' }) }); });
  t.after(() => act(() => view.unmount()));
  return {
    view,
    exported,
    exportPdf: () => act(async () => {
      await view.root.findAllByType('button').find(node => text(node).startsWith('Export')).props.onClick();
    }),
    rows: () => view.root.findByType('tbody').findAllByType('tr'),
    click: name => act(() => view.root.findAllByType('button').find(node => node.props['aria-label'] === name || text(node).startsWith(name)).props.onClick()),
    search: value => act(() => view.root.findByProps({ 'aria-label': 'Search dashboard records' }).props.onChange({ target: { value } })),
  };
}

for (const role of ['ADMIN', 'SUPERADMIN']) test(`${role} availability rows hide legacy rates in the table and PDF`, async t => {
  const rows = [
    { id: 'legacy', homeownerName: 'Unassigned', workerName: 'Available Worker', offeredWage: 608, ratePeriod: 'day', contractType: 'Short-Term On-Demand', barangay: 'Agusan' },
    { id: 'null', homeownerName: 'Unassigned', workerName: 'New Worker', offeredWage: null, ratePeriod: 'month', contractType: 'Formal Kasambahay (Long-Term)', barangay: 'Agusan' },
    { id: 'budget', homeownerName: 'Employer', workerName: 'Unassigned', offeredWage: 650, ratePeriod: 'day', contractType: 'Short-Term On-Demand', barangay: 'Agusan' },
    { id: 'hired', homeownerName: 'Employer', workerName: 'Hired Worker', offeredWage: 8500, ratePeriod: 'month', contractType: 'Formal Kasambahay (Long-Term)', barangay: 'Agusan' },
  ];
  const f = activity(t, role, rows);
  const pay = row => text(row.findAllByType('td').find(cell => cell.props['data-label'] === 'Pay'));
  assert.equal(pay(f.rows()[0]), '-'); assert.equal(pay(f.rows()[1]), '-');
  assert.equal(pay(f.rows()[2]), '₱650.00 / day'); assert.equal(pay(f.rows()[3]), '₱8,500.00 / month');
  assert.match(text(f.view.toJSON()), /Wage \/ Rate/);
  await f.exportPdf();
  const pdfRows = f.exported.html.match(/<tbody>[\s\S]*?<\/tbody>/)[0].match(/<tr>[\s\S]*?<\/tr>/g);
  assert.doesNotMatch(pdfRows[0], /608|Wage Compliant|Below RA|\/ day/);
  assert.doesNotMatch(pdfRows[1], /Wage Compliant|Below RA|\/ month/);
  assert.match(pdfRows[2], /₱650.00 \/ day/); assert.match(pdfRows[3], /₱8,500.00 \/ month/);
  assert.match(f.exported.html, /Wage \/ Rate/);
  assert.equal(rows[0].offeredWage, 608);
});

for (const role of ['ADMIN', 'SUPERADMIN']) test(`responsive activity records preserve ${role} scope, pagination, search, pay and status`, t => {
  const f = activity(t, role);
  assert.equal(f.rows().length, 5);
  assert.deepEqual(f.rows()[0].findAllByType('td').map(node => node.props['data-label']), ['Employer', 'Kasambahay', 'Pay', 'Contract', 'Date Posted', 'Status']);
  assert.equal(text(f.rows()[0].findByProps({ 'data-label': 'Date Posted' })), 'Nov 16, 2026');
  assert.equal(text(f.rows()[1].findByProps({ 'data-label': 'Date Posted' })), '—');
  f.click('Next placements page');
  assert.equal(f.rows().length, role === 'ADMIN' ? 1 : 2);
  assert.match(text(f.rows()[0]), /Homeowner 6.*Worker 6.*600\.00 \/ month.*Full-time \/ Monthly.*Accepted/);
  f.search('Worker 1');
  assert.equal(f.rows().length, 1);
  assert.match(text(f.rows()[0]), /Worker 1/);
  assert.equal(f.view.root.findAllByProps({ 'aria-label': 'Previous placements page' }).length, 0);
  f.search('');
  assert.equal(f.rows().length, 5);
  assert.equal(f.view.root.findByProps({ 'aria-label': 'Previous placements page' }).props.disabled, true);
});

test('placement PDF exports the same Philippine date as the placement row', async t => {
  const f = activity(t, 'SUPERADMIN');
  await f.exportPdf();
  assert.match(f.exported.html, /<th[^>]*>Date Posted<\/th>/);
  assert.match(f.exported.html, /<td>Nov 16, 2026<\/td>/);
  assert.match(f.exported.filename, /^serbisure-report-placements-bookings-.*\.pdf$/);
});

test('clearance and audit cards retain all record details when switching tabs and searching', t => {
  const f = activity(t, 'SUPERADMIN');
  f.click('Recent Clearances');
  assert.match(text(f.rows()[0]), /Document Applicant.*Police Clearance.*Agusan.*Oct 20, 2026.*VERIFIED/);
  assert.deepEqual(f.rows()[0].findAllByType('td').map(node => node.props['data-label']), ['Applicant', 'Document', 'Barangay', 'Submitted', 'Status']);
  f.click('Audit Trail');
  assert.match(text(f.rows()[0]), /Reviewing Officer.*Approved.*Document Applicant.*Police Clearance.*VERIFIED.*Reviewed submitted document/);
  assert.deepEqual(f.rows()[0].findAllByType('td').map(node => node.props['data-label']), ['Official', 'Action', 'Resident', 'Change', 'Recorded']);
  f.search('no matching record');
  assert.match(text(f.view.root), /No audit logs matching/);
});

const retentionLogs = () => {
  const codes = ['retention_cron_run', 'retention_media_purged', 'retention_media_retired', 'retention_account_closed'];
  return Array.from({ length: 11 }, (_, index) => ({
    log_id: `retention-${index}`, actor_name: 'System / Automated', actor_role: 'System',
    target_name: index === 10 ? 'All Verification Media (RA 10173)' : `Resident ${index}`,
    target_barangay: index < 8 ? 'Brgy. Agusan' : index < 10 ? 'Carmen' : null,
    action: 'UPDATED', document_type: index === 10 ? 'Retention Policy' : 'nbi_clearance',
    previous_status: 'Scheduled', new_status: 'Completed', created_at: '2026-11-26T18:00:00Z',
    reason: `Retention record ${index}`, metadata: { reason_code: codes[index % codes.length], category: `category-${index}` },
  }));
};

for (const role of ['ADMIN', 'SUPERADMIN']) test(`${role} retention tab separates audit events, scopes residents and paginates exactly five rows`, t => {
  const logs = [...retentionLogs(), { log_id: 'review', actor_name: 'Review Officer', action: 'APPROVED',
    target_name: 'Reviewed Resident', target_barangay: 'Agusan', document_type: 'police_clearance', reason: 'Official approval' }];
  const f = activity(t, role, undefined, logs);
  assert.match(text(f.view.toJSON()), new RegExp(`RA 10173 Logs \\(${role === 'ADMIN' ? 8 : 11}\\)`));
  f.click('Audit Trail');
  assert.equal(f.rows().length, 1);
  assert.match(text(f.rows()[0]), /Review Officer.*Official approval/);
  assert.doesNotMatch(text(f.rows()[0]), /Retention record/);
  f.click('RA 10173 Logs');
  assert.equal(f.rows().length, 5);
  assert.match(text(f.rows()[0]), /System \/ Automated.*Cron Run.*Scheduled.*Completed.*Retention record 0/);
  assert.doesNotMatch(text(f.view.root.findByType('tbody')), /Official approval/);
  f.click('Next ra 10173 logs page');
  assert.equal(f.rows().length, role === 'ADMIN' ? 3 : 5);
  assert.match(text(f.rows()[0]), /Resident 5/);
  if (role === 'SUPERADMIN') {
    f.click('Next ra 10173 logs page');
    assert.equal(f.rows().length, 1);
  }
  // Search includes the metadata category and resets pagination.
  f.search('category-2');
  assert.equal(f.rows().length, 1);
  assert.match(text(f.rows()[0]), /Resident 2/);
  f.search('');
  assert.equal(f.rows().length, 5);
  assert.equal(f.view.root.findByProps({ 'aria-label': 'Previous ra 10173 logs page' }).props.disabled, true);
  f.click('Next ra 10173 logs page');
  f.click('Audit Trail'); f.click('RA 10173 Logs');
  assert.match(text(f.rows()[0]), /Resident 0/);
  for (const query of ['System / Automated', 'Resident 1', 'NBI Clearance', 'Retention record 1', 'Image Purged']) {
    f.search(query);
    assert.ok(f.rows().length > 0 && f.rows().length <= 5, query);
  }
});

test('retention PDF uses the audit report template, exports all filtered pages and excludes official reviews', async t => {
  const logs = [...retentionLogs(), { log_id: 'review', action: 'APPROVED', target_name: 'Official review only' }];
  logs[0].reason = '<script>unsafe</script>';
  const f = activity(t, 'SUPERADMIN', undefined, logs);
  f.click('RA 10173 Logs');
  await f.exportPdf();
  assert.match(f.exported.filename, /^serbisure-report-ra10173-disposal-logs-\d{4}-\d{2}-\d{2}\.pdf$/);
  assert.match(f.exported.html, /RA 10173 Verification Media Retention &amp; Disposal Log/);
  assert.match(f.exported.html, /Official Automated Schedule &amp; Cloud Media Purge Record \(Data Privacy Act Compliance\)/);
  assert.match(f.exported.html, /report-wrapper.*Official \/ Actor/s);
  for (const badge of ['Cron Run', 'Image Purged', 'Queued', 'Account Closed']) assert.ok(f.exported.html.includes(badge));
  assert.match(f.exported.html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.doesNotMatch(f.exported.html, /<script>|Official review only/);
  const body = f.exported.html.match(/<tbody>[\s\S]*?<\/tbody>/)[0];
  assert.equal((body.match(/<tr>/g) || []).length, 11);
  f.search('category-3');
  await f.exportPdf();
  assert.match(f.exported.html, /Resident 3/);
  assert.doesNotMatch(f.exported.html, /Resident 4/);
});
