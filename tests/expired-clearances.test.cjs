const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { act, create } = require('react-test-renderer');
const loader = require('./source-loader.cjs');

const document = (id, kind, expired = false) => ({
  id, userId: 'worker', role: 'KASAMBAHAY', rawDocumentType: kind, documentType: kind,
  status: 'VERIFIED', applicantStatus: 'EXPIRED', isExpired: expired,
  submittedAt: '2026-10-29T00:00:00Z', submittedDate: 'Oct 29, 2026', validityDate: 'Oct 28, 2026',
  hasDocuments: true, name: 'Worker', barangay: 'Pagatpat', avatar: '', documentImage: '',
});

test('applicant eligibility comes from the backend while approvals remain individual decisions', () => {
  const { groupVerificationApplicants, preferredDocument } = loader()('src/data/verificationApplicants.ts');
  const nbi = document('nbi', 'nbi_clearance', true), police = document('police', 'police_clearance');
  const [applicant] = groupVerificationApplicants([police, nbi]);
  assert.equal(applicant.status, 'EXPIRED');
  assert.equal(preferredDocument(applicant).id, 'nbi');
  assert.equal(police.status, 'VERIFIED');
  assert.equal(nbi.status, 'VERIFIED');
});

test('the queue exposes an Expired pill and a manual process button', () => {
  const state = { verifications: [document('nbi', 'nbi_clearance', true)], currentRole: 'ADMIN',
    selectedBarangay: 'Brgy. Pagatpat', userBarangays: [], selectedVerificationId: '',
    setSelectedVerificationId() {}, refreshVerifications() {} };
  const { VerificationQueue } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state } })('src/components/verifications/VerificationQueue.tsx');
  const html = renderToStaticMarkup(React.createElement(VerificationQueue));
  assert.match(html, /<span>Expired<\/span><span[^>]*>1<\/span>/);
  assert.match(html, /Process expired clearances/);
});

test('an expired document clearly shows the date while its valid companion stays approved', () => {
  const { VerificationDocumentRow } = loader()('src/components/verifications/VerificationDocumentRow.tsx');
  const render = doc => renderToStaticMarkup(React.createElement(VerificationDocumentRow, {
    document: doc, selected: false, onReview() {}, onApprove() {}, onReject() {}, onReset() {},
  }));
  assert.match(render(document('nbi', 'nbi_clearance', true)), /Expired on Oct 28, 2026/);
  assert.match(render(document('police', 'police_clearance')), />Verified<\/span>/);
  assert.doesNotMatch(render(document('police', 'police_clearance')), /Expired on/);
});

async function buttonFlow(t, { count = 2, confirm = true, failure = false } = {}) {
  const calls = [];
  const originalWindow = global.window;
  global.window = { confirm: message => { calls.push(['confirm', message]); return confirm; } };
  t.after(() => { global.window = originalWindow; });
  const { ProcessExpirationsButton } = loader({ 'src/api/adminApi.ts': {
    previewExpiredClearances: async () => { calls.push(['preview']); return { scope: 'Pagatpat', document_count: count, worker_count: 1, confirmation_token: 'signed-preview' }; },
    processExpiredClearances: async token => {
      calls.push(['process', token]);
      if (failure) throw Error('The expired-document list changed. Preview and confirm again.');
      return { document_count: count, worker_count: 1 };
    },
  } })('src/components/verifications/ProcessExpirationsButton.tsx');
  let renderer;
  await act(async () => { renderer = create(React.createElement(ProcessExpirationsButton, {
    onProcessed: async () => { calls.push(['refresh']); },
  })); });
  await act(async () => { renderer.root.findByType('button').props.onClick(); });
  return { calls, renderer };
}

test('cancelled confirmation performs no mutation and explains count, scope and isolation', async t => {
  const { calls } = await buttonFlow(t, { confirm: false });
  assert.deepEqual(calls.map(call => call[0]), ['preview', 'confirm']);
  assert.match(calls[1][1], /2 expired clearances from 1 worker/);
  assert.match(calls[1][1], /Jurisdiction: Pagatpat/);
  assert.match(calls[1][1], /Valid clearances stay unchanged/);
});

test('confirmed action sends its signed preview then refreshes the affected views', async t => {
  const { calls, renderer } = await buttonFlow(t);
  assert.deepEqual(calls.map(call => call[0]), ['preview', 'confirm', 'process', 'refresh']);
  assert.equal(calls[2][1], 'signed-preview');
  assert.match(JSON.stringify(renderer.toJSON()), /Workers can now upload renewals/);
  assert.equal(renderer.root.findByType('button').props.disabled, false);
});

test('zero affected documents never shows a confirmation or sends a POST', async t => {
  const { calls, renderer } = await buttonFlow(t, { count: 0 });
  assert.deepEqual(calls.map(call => call[0]), ['preview']);
  assert.match(JSON.stringify(renderer.toJSON()), /No expired clearances need processing/);
});

test('a changed preview displays an error and never claims success or refreshes as if applied', async t => {
  const { calls, renderer } = await buttonFlow(t, { failure: true });
  assert.deepEqual(calls.map(call => call[0]), ['preview', 'confirm', 'process']);
  assert.match(renderer.root.findByProps({ role: 'alert' }).children.join(''), /Preview and confirm again/);
});

test('expiry mutation is never automatically retried by the API client', async () => {
  const requests = [];
  const api = loader({ 'src/api/apiClient.ts': { fetchApi: async (...args) => { requests.push(args); return {}; } } })('src/api/adminApi.ts');
  await api.processExpiredClearances('officer-confirmation');
  assert.equal(requests[0][1].method, 'POST');
  assert.equal(requests[0][1].maxRetries, 0);
  assert.deepEqual(JSON.parse(requests[0][1].body), { confirmation_token: 'officer-confirmation' });
});
