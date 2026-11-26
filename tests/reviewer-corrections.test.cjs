const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { act, create } = require('react-test-renderer');
const { renderToStaticMarkup } = require('react-dom/server');
const loader = require('./source-loader.cjs');
const data = loader()('src/data/reviewerCorrections.ts');

const retainedDocument = overrides => ({
  id: 'retained-doc', userId: 'resident', name: 'Resident', role: 'HOMEOWNER', avatar: '',
  barangay: 'Agusan', documentType: 'National ID (Front)', rawDocumentType: 'national_id_front',
  documentNumber: '12345', issuedDate: 'N/A (PhilSys National ID)', validityDate: 'Permanent',
  status: 'VERIFIED', primaryStatus: 'VERIFIED', recordStatus: 'Clear Record',
  documentImage: null, mediaPurgedAt: '2026-12-25T00:00:00+08:00', ...overrides,
});

for (const role of ['ADMIN', 'SUPERADMIN']) test(`${role} purged-document preview preserves status and dates without image-review or edit actions`, () => {
  const doc = retainedDocument();
  const state = { currentRole: role, verifications: [doc], selectedVerificationId: doc.id, isComparisonModalOpen: false };
  const { DocumentPreview } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state } })('src/components/verifications/DocumentPreview.tsx');
  const html = renderToStaticMarkup(React.createElement(DocumentPreview));
  assert.match(html, /Image Removed Under RA 10173/);
  assert.match(html, /Dec 25, 2026.*PHT/);
  assert.match(html, /verification status, reviewer, issue\/expiry dates, and audit trail remain preserved/);
  assert.match(html, /Validity.*Permanent.*Status.*VERIFIED/);
  assert.doesNotMatch(html, /Click to Zoom Scan|No scan image available|Edit details|Move to Pending Review|Reset to Review|APPROVE|REJECT|OVERRIDE/);
  doc.mediaPurgedAt = null;
  const oldRecord = renderToStaticMarkup(React.createElement(DocumentPreview));
  assert.doesNotMatch(oldRecord, /Image Removed Under RA 10173/);
  assert.match(oldRecord, /No scan image available|Edit details/);
});

test('a purged companion stays selectable and never displays the primary image or offers review actions', t => {
  const doc = retainedDocument({ documentImage: 'https://example.test/front.jpg', mediaPurgedAt: null,
    secondaryDocumentId: 'back-doc', secondaryMediaPurgedAt: '2026-12-25T00:00:00+08:00',
    secondaryDocumentImage: null, secondaryDocumentType: 'National ID (Back)', secondaryStatus: 'VERIFIED' });
  const state = { verifications: [doc], selectedVerificationId: doc.id, isComparisonModalOpen: false };
  const { DocumentPreview } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state } })('src/components/verifications/DocumentPreview.tsx');
  let view; act(() => { view = create(React.createElement(DocumentPreview)); });
  t.after(() => act(() => view.unmount()));
  const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join('');
  assert.ok(view.root.findAllByType('img').some(node => node.props.src === doc.documentImage));
  act(() => view.root.findAllByType('button').find(node => text(node) === 'Back').props.onClick());
  assert.match(text(view.toJSON()), /Image Removed Under RA 10173/);
  assert.equal(view.root.findAllByType('img').some(node => node.props.src === doc.documentImage), false);
  assert.equal(view.root.findAllByType('button').some(node => /Move to Pending Review|Reset|APPROVE|REJECT|Edit details/.test(text(node))), false);
  act(() => view.root.findAllByType('button').find(node => text(node) === 'Front').props.onClick());
  assert.doesNotMatch(text(view.toJSON()), /Image Removed Under RA 10173/);
  assert.ok(view.root.findAllByType('button').some(node => text(node) === 'Edit details'));
});

test('identity comparison, queue shortcuts and closed-account profile photos show retention removal without review actions', () => {
  const doc = retainedDocument({ status: 'PENDING / REVIEW', primaryStatus: 'PENDING / REVIEW' });
  const { IdentityComparisonContent } = loader()('src/components/verifications/IdentityComparisonModal.tsx');
  const html = renderToStaticMarkup(React.createElement(IdentityComparisonContent, {
    isOpen: true, onClose() {}, user: { name: 'Resident', role: 'HOMEOWNER', avatar: '' }, document: doc,
    onApprove() {}, onReject() {}, onReset() {},
  }));
  assert.match(html, /Image Removed Under RA 10173/);
  assert.doesNotMatch(html, /Approve document|Reject document|Re-open document|Both images must load/);
  const { VerificationDocumentRow } = loader()('src/components/verifications/VerificationDocumentRow.tsx');
  const row = renderToStaticMarkup(React.createElement(VerificationDocumentRow, {
    document: doc, selected: true, onReview() {}, onApprove() {}, onReject() {}, onReset() {},
  }));
  assert.match(row, /Image Removed Under RA 10173/);
  assert.doesNotMatch(row, />Approve|>Reject|>Re-open/);
  const photo = retainedDocument({ documentType: 'Profile Photo', rawDocumentType: 'profile_photo' });
  const state = { verifications: [photo], selectedVerificationId: photo.id, isComparisonModalOpen: false };
  const { DocumentPreview } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state } })('src/components/verifications/DocumentPreview.tsx');
  const photoHtml = renderToStaticMarkup(React.createElement(DocumentPreview));
  assert.match(photoHtml, /Image Removed Under RA 10173.*Photo status: Verified/);
  assert.doesNotMatch(photoHtml, /Photo unavailable|Approve Photo|Reject Photo|Reason if rejected/);
});

const snapshot = () => ({
  version: 'a'.repeat(64), document_type: 'police_clearance',
  profile: { first_name: 'Jameszzz', middle_name: null, last_name: 'Santos', date_of_birth: '1998-01-01' },
  document: { first_name: 'James', middle_name: null, last_name: 'Santos', date_of_birth: '1998-01-01',
    document_number: 'WR0NG', date_issued: '2026-04-28', valid_until: '2028-10-20' },
});

test('correction patch keeps account and document edits separate and sends only changed fields', () => {
  const original = snapshot(), draft = structuredClone(original);
  draft.profile.first_name = 'James'; draft.document.valid_until = '2026-10-28';
  assert.deepEqual(data.buildCorrectionPatch(original, draft), {
    version: original.version, profile: { first_name: 'James' }, document: { valid_until: '2026-10-28' },
  });
  assert.equal(original.profile.first_name, 'Jameszzz');
});

test('unchanged whitespace and optional empty values do not create fake edits; clearing a date does', () => {
  const original = snapshot(), draft = structuredClone(original);
  draft.profile.middle_name = ''; draft.profile.first_name = ' Jameszzz ';
  assert.equal(data.buildCorrectionPatch(original, draft), null);
  draft.profile.date_of_birth = '';
  assert.deepEqual(data.buildCorrectionPatch(original, draft).profile, { date_of_birth: null });
});

test('validation errors show the backend guidance instead of a generic API 400', () => {
  const error = Object.assign(new Error('API Error: 400'), { data: { document: { date_issued: ['Issue date cannot be in the future. Check the year on the document.'] } } });
  assert.match(data.correctionErrorMessage(error), /Check the year/);
});

async function form(t, { fail = false, kind = 'police_clearance' } = {}) {
  const calls = [];
  const details = { ...snapshot(), document_type: kind };
  const { ReviewerCorrectionsForm } = loader({ 'src/api/adminApi.ts': {
    fetchReviewerCorrections: async id => { calls.push(['get', id]); return structuredClone(details); },
    saveReviewerCorrections: async (id, patch) => {
      calls.push(['save', id, patch]);
      if (fail) throw Error('These details changed. Close and reopen the form.');
      return { ...details, changed: true };
    },
  } })('src/components/verifications/ReviewerCorrectionsForm.tsx');
  let view;
  await act(async () => { view = create(React.createElement(ReviewerCorrectionsForm, { documentId: 'doc-1', onSaved: async () => { calls.push(['refresh']); } })); });
  t.after(() => act(() => view.unmount()));
  const click = async text => act(async () => { view.root.findAllByType('button').find(button => button.children.includes(text)).props.onClick(); });
  await click('Edit details');
  const change = (label, value) => act(() => view.root.findByProps({ 'aria-label': label }).props.onChange({ target: { value } }));
  const save = async () => act(async () => { view.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  return { view, calls, click, change, save };
}

test('inline editor offers identity fields while login, contact and jurisdiction inputs stay locked', async t => {
  const f = await form(t);
  const labels = f.view.root.findAllByType('input').map(input => input.props['aria-label']);
  assert.ok(labels.includes('Account first name'));
  assert.ok(labels.includes('Document expiry date'));
  assert.ok(labels.includes('Document document number'));
  assert.equal(labels.some(label => /email|username|password|contact|barangay|role/i.test(label)), false);
});

test('save corrects one field without approving or leaving preview and refreshes the review data', async t => {
  const f = await form(t);
  f.change('Account first name', 'James');
  await f.save();
  assert.deepEqual(f.calls.map(call => call[0]), ['get', 'save', 'refresh']);
  assert.deepEqual(f.calls[1][2], { version: snapshot().version, profile: { first_name: 'James' } });
  assert.equal(f.view.root.findAllByType('form').length, 0);
  assert.match(f.view.root.findByProps({ role: 'status' }).children.join(''), /continue reviewing/);
});

test('cancel and no-op saves never send corrections or create an audit event', async t => {
  const f = await form(t);
  await f.save();
  assert.deepEqual(f.calls.map(call => call[0]), ['get']);
  f.change('Account first name', 'Discard this');
  await f.click('Cancel');
  assert.deepEqual(f.calls.map(call => call[0]), ['get']);
});

test('stale-save error keeps the draft visible and does not claim success', async t => {
  const f = await form(t, { fail: true });
  f.change('Document document number', 'HUMAN-123');
  await f.save();
  assert.match(f.view.root.findByProps({ role: 'alert' }).children.join(''), /Close and reopen/);
  assert.equal(f.view.root.findByProps({ 'aria-label': 'Document document number' }).props.value, 'HUMAN-123');
  assert.deepEqual(f.calls.map(call => call[0]), ['get', 'save']);
});

test('permanent National IDs do not offer clearance issue or expiry dates', async t => {
  const f = await form(t, { kind: 'national_id_front' });
  const labels = f.view.root.findAllByType('input').map(input => input.props['aria-label']);
  assert.equal(labels.includes('Document issue date'), false);
  assert.equal(labels.includes('Document expiry date'), false);
});

test('TESDA editor omits only document birthdate and still saves certificate corrections', async t => {
  const f = await form(t, { kind: 'tesda_nc2' });
  const labels = f.view.root.findAllByType('input').map(input => input.props['aria-label']);
  assert.ok(labels.includes('Account birthdate'));
  assert.equal(labels.includes('Document birthdate'), false);
  for (const label of ['first name', 'middle name', 'last name', 'issue date', 'expiry date']) {
    assert.ok(labels.includes(`Document ${label}`));
  }
  f.change('Document document number', '21140302025983');
  await f.save();
  assert.deepEqual(f.calls[1][2], { version: snapshot().version, document: { document_number: '21140302025983' } });
});

test('TESDA preview compares names only and uses certificate number and RWAC portal for both reviewers', () => {
  const doc = {
    id: 'tesda-doc', userId: 'worker', name: 'Maria Clara Dela Cruz', role: 'KASAMBAHAY',
    barangay: 'Agusan', documentType: 'TESDA NC II', rawDocumentType: 'tesda_nc2',
    status: 'PENDING / REVIEW', recordStatus: 'Flagged', documentImage: '',
    accountRegistration: { first_name: 'Maria Clara', middle_name: 'Santos', last_name: 'Dela Cruz',
      date_of_birth: '1990-01-01', address: 'Account address' },
    ocrExtractedData: { first_name: 'MARIA CLARA', middle_name: 'S', last_name: 'DELA CRUZ',
      certificate_number: '21140302025983', date_issued: '2018-09-20', valid_until: '2023-09-19' },
    ocrDiscrepancies: [{ field: 'valid_until', message: 'Document is EXPIRED' }],
  };
  const state = { verifications: [doc], selectedVerificationId: doc.id, isComparisonModalOpen: false };
  const { DocumentPreview } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state } })('src/components/verifications/DocumentPreview.tsx');
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    state.currentRole = role;
    for (const [raw, label] of [['tesda_nc2', 'TESDA NC II'], ['tesda_nc2', ''],
      ['', 'TESDA Certificate'], ['', 'NC II Certificate'], ['', 'Equivalent Skill Certification']]) {
      doc.rawDocumentType = raw;
      doc.documentType = label;
      const html = renderToStaticMarkup(React.createElement(DocumentPreview));
      const fields = html.match(/<tbody[^>]*>.*?<\/tbody>/g);
      assert.equal(fields.length, 3);
      assert.match(fields[0], /First Name.*MARIA CLARA.*Maria Clara/);
      assert.match(fields[1], /Middle Name.*S.*Santos/);
      assert.match(fields[2], /Last Name.*DELA CRUZ.*Dela Cruz/);
      assert.doesNotMatch(fields.join(''), /Birthdate|Address/);
      assert.match(html, /ID Type.*(?:TESDA|NC II|Skill Certification)/);
      assert.doesNotMatch(html, /NBI Clearance/);
      assert.match(html, /Certificate Number.*21140302025983.*Copy to clipboard/);
      assert.match(html, /href="https:\/\/www.tesda.gov.ph\/RWAC".*title="Open official TESDA RWAC verification portal"/);
      assert.match(html, /Verify on TESDA Portal/);
      assert.match(html, /Date Issued.*Sep 20, 2018.*Validity.*Sep 19, 2023/);
      assert.match(html, /Flagged Discrepancies \(1\).*Document is EXPIRED/);
    }
  }
});

test('non-TESDA clearances keep five comparison rows and their existing portal and number labels', () => {
  const doc = { id: 'clearance', userId: 'worker', name: 'Worker', role: 'KASAMBAHAY',
    status: 'PENDING / REVIEW', documentImage: '', ocrExtractedData: {} };
  const state = { verifications: [doc], selectedVerificationId: doc.id, isComparisonModalOpen: false };
  const { DocumentPreview } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state } })('src/components/verifications/DocumentPreview.tsx');
  for (const [kind, label, number, portal] of [
    ['nbi_clearance', 'NBI Clearance', 'Transaction Number', 'https://verification.nbi-clearance.io'],
    ['police_clearance', 'Police Clearance', 'ID Number', 'https://pnpclearance.ph/#call-to-action'],
  ]) {
    doc.rawDocumentType = kind;
    doc.documentType = label;
    const html = renderToStaticMarkup(React.createElement(DocumentPreview));
    assert.equal((html.match(/<tbody/g) || []).length, 5);
    assert.ok(html.includes(`href="${portal}"`));
    assert.ok(html.includes(number));
    assert.doesNotMatch(html, /Certificate Number|Verify on TESDA Portal/);
  }
});

test('no-documents worker checklist includes TESDA after NBI and Police Clearance', () => {
  const doc = { id: 'worker', userId: 'worker', name: 'Worker', role: 'KASAMBAHAY',
    status: 'NO_DOCUMENTS', hasDocuments: false };
  const state = { verifications: [doc], selectedVerificationId: doc.id, isComparisonModalOpen: false };
  const { DocumentPreview } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state } })('src/components/verifications/DocumentPreview.tsx');
  const html = renderToStaticMarkup(React.createElement(DocumentPreview));
  assert.match(html, /Required Submission Checklist.*NBI Clearance.*National Police Clearance.*TESDA NC II/);
  assert.equal((html.match(/Pending Upload/g) || []).length, 3);
});

test('audit changes show clear before/after values and escape supplied text', () => {
  const { AuditCorrectionDetails } = loader()('src/components/dashboard/AuditCorrectionDetails.tsx');
  const metadata = { reason_code: 'reviewer_correction', changes: [
    { section: 'profile', field: 'first_name', old: 'Jameszzz', new: 'James' },
    { section: 'document', field: 'document_number', old: '<script>unsafe</script>', new: '123' },
  ] };
  const html = renderToStaticMarkup(React.createElement(AuditCorrectionDetails, { metadata }));
  assert.match(html, /Account · First name: Jameszzz → James/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('Document Preview uses the saved document number and issue date ahead of stale OCR values', () => {
  const doc = { id: 'doc-1', userId: 'resident', name: 'James Santos', role: 'KASAMBAHAY', avatar: '',
    barangay: 'Pagatpat', documentType: 'Police Clearance', rawDocumentType: 'police_clearance',
    documentNumber: 'CORRECT-123', issuedDate: 'Apr 28, 2026', validityDate: 'Oct 28, 2026',
    status: 'PENDING / REVIEW', recordStatus: 'Under Review', documentImage: '',
    ocrExtractedData: { clearance_number: 'WRONG-999', date_issued: '2028-04-28' },
  };
  const state = { verifications: [doc], selectedVerificationId: doc.id, isComparisonModalOpen: false };
  const { DocumentPreview } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state } })('src/components/verifications/DocumentPreview.tsx');
  const html = renderToStaticMarkup(React.createElement(DocumentPreview));
  assert.match(html, /CORRECT-123/);
  assert.match(html, /Apr 28, 2026/);
  assert.doesNotMatch(html, /WRONG-999|Apr 28, 2028/);
});

test('existing Audit Trail displays the correction, officer, resident and document in the same row', () => {
  const state = { currentRole: 'ADMIN', selectedBarangay: 'Pagatpat', setActiveNav() {}, bookings: [], verifications: [],
    auditLogs: [{ log_id: 'edit-1', actor_name: 'Reviewing Officer', actor_role: 'Barangay', target_name: 'James Santos',
      target_barangay: 'Brgy. Pagatpat', action: 'UPDATED', document_type: 'police_clearance', created_at: '2026-10-30T02:00:00Z',
      previous_status: 'Pending', new_status: 'Pending', metadata: { reason_code: 'reviewer_correction', changes: [
        { section: 'profile', field: 'first_name', old: 'Jameszzz', new: 'James' },
      ] } }],
  };
  const { DashboardActivityTable } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state }, jspdf: () => {}, html2canvas: () => {} })('src/components/dashboard/DashboardActivityTable.tsx');
  let view; act(() => { view = create(React.createElement(DashboardActivityTable)); });
  try {
    const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join('');
    act(() => view.root.findAllByType('button').find(button => text(button).startsWith('Audit Trail')).props.onClick());
    assert.match(text(view.root.findByType('tbody')), /Reviewing Officer.*James Santos.*Police Clearance.*Jameszzz → James/);
  } finally { act(() => view.unmount()); }
});

test('document preview compares OCR and registration for both roles and marks only flagged fields', () => {
  const doc = {
    id: 'doc-1', userId: 'resident', name: 'Christine Tagupa',
    role: 'HOMEOWNER', barangay: 'Agusan', documentType: 'National ID (Front)', rawDocumentType: 'national_id_front',
    status: 'PENDING / REVIEW', recordStatus: 'Flagged', documentImage: '',
    documentNumber: '1234-5678-9012-3456',
    accountRegistration: {
      first_name: 'Christine', middle_name: 'Cruz', last_name: 'Tagupa',
      date_of_birth: '2004-09-24', address: 'Lot 3, Agusan, Cagayan de Oro, Misamis Oriental, 9000',
    },
    ocrExtractedData: {
      first_name: 'JAMES CHRISTOPHER', middle_name: 'CINCHES', last_name: 'TAGUPA',
      date_of_birth: 'Sep 24, 2004', address: 'Lot 3, Agusan',
      _reviewer_corrections: { last_name: {} },
    },
    ocrDiscrepancies: [
      { field: 'first_name', message: 'First names differ.' },
      { field: 'middle_name', message: 'Middle names differ.' },
      { field: 'barangay', message: 'Barangays differ.' },
    ],
  };
  const state = { verifications: [doc], selectedVerificationId: doc.id, isComparisonModalOpen: false };
  const { DocumentPreview } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state } })('src/components/verifications/DocumentPreview.tsx');
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    state.currentRole = role;
    const html = renderToStaticMarkup(React.createElement(DocumentPreview));
    assert.match(html, /OCR Result \(Document\)<\/th>.*Account Registration<\/th>/);
    const fields = html.match(/<tbody[^>]*>.*?<\/tbody>/g);
    assert.equal(fields.length, 5);
    assert.match(fields[0], /First Name.*Mismatch.*JAMES CHRISTOPHER.*Christine/);
    assert.match(fields[1], /Middle Name.*Mismatch.*CINCHES.*Cruz/);
    assert.match(fields[2], /Last Name.*TAGUPA.*Reviewer corrected.*Tagupa/);
    assert.match(fields[3], /Birthdate.*Sep 24, 2004.*Sep 24, 2004/);
    assert.match(fields[4], /Address.*Mismatch.*Lot 3, Agusan.*Lot 3, Agusan, Cagayan de Oro, Misamis Oriental, 9000/);
    assert.doesNotMatch(fields[2] + fields[3], /Mismatch/);
    assert.doesNotMatch(html, /Account Name<\/span>|ID Name \(OCR\)<\/span>/);
    assert.match(html, /<\/table>.*ID Type.*Copy to clipboard.*Verify on PhilSys eVerify.*Date Issued.*Validity.*Status.*Edit details/);
    assert.match(html, /Flagged Discrepancies \(3\)/);
  }
});

test('document preview shows placeholders and retains legacy OCR evidence and quality warnings', () => {
  const doc = {
    id: 'legacy-doc', userId: 'resident', name: 'Christine Tagupa',
    role: 'HOMEOWNER', barangay: 'Agusan', documentType: 'National ID (Front)', rawDocumentType: 'national_id_front',
    status: 'PENDING / REVIEW', recordStatus: 'Flagged', documentImage: '',
    accountRegistration: { first_name: 'Christine', last_name: 'Tagupa', middle_name: null, date_of_birth: '', address: '  ' },
  };
  const state = { verifications: [doc], selectedVerificationId: doc.id, isComparisonModalOpen: false };
  const { DocumentPreview } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state } })('src/components/verifications/DocumentPreview.tsx');
  for (const ocr of [null, {}, { first_name: null, last_name: '', address: '  ' }]) {
    doc.ocrExtractedData = ocr;
    doc.ocrDiscrepancies = [{ field: 'image_quality', message: 'No readable text detected by OCR — please check if the uploaded image is valid.' }];
    const html = renderToStaticMarkup(React.createElement(DocumentPreview));
    assert.equal((html.match(/>Not detected<\/td>/g) || []).length, 5);
    assert.equal((html.match(/>Not provided<\/td>/g) || []).length, 3);
    assert.match(html, /Flagged Discrepancies \(1\).*No readable text detected by OCR/);
    assert.doesNotMatch(html, /Mismatch|Full name from OCR/);
  }
  doc.ocrExtractedData = { full_name: 'JAMES CHRISTOPHER TAGUPA' };
  doc.ocrDiscrepancies = null;
  delete doc.accountRegistration;
  const legacy = renderToStaticMarkup(React.createElement(DocumentPreview));
  assert.match(legacy, /Full name from OCR .*JAMES CHRISTOPHER TAGUPA/);
  assert.equal((legacy.match(/>Not detected<\/td>/g) || []).length, 5);
  assert.equal((legacy.match(/>Not provided<\/td>/g) || []).length, 5);
});

test('correction API uses PATCH with no automatic mutation retries', async () => {
  const calls = [];
  const api = loader({ 'src/api/apiClient.ts': { fetchApi: async (...args) => { calls.push(args); return {}; } } })('src/api/adminApi.ts');
  await api.saveReviewerCorrections('doc-1', { version: 'a'.repeat(64), profile: { first_name: 'James' } });
  assert.match(calls[0][0], /doc-1\/corrections\/$/);
  assert.equal(calls[0][1].method, 'PATCH');
  assert.equal(calls[0][1].maxRetries, 0);
});
