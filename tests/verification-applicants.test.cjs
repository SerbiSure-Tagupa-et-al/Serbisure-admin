const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { create, act } = require('react-test-renderer');
const loader = require('./source-loader.cjs');
const { groupVerificationApplicants, applicantStatus, preferredDocument } = loader()('src/data/verificationApplicants.ts');

const document = (id, userId, type, status = 'PENDING / REVIEW', extra = {}) => ({
  id, userId, rawDocumentType: type, documentType: type.replaceAll('_', ' '), status,
  name: 'Sakura Sasuke', email: `${userId}@example.test`, role: 'HOMEOWNER', barangay: 'Pagatpat',
  avatar: '', documentImage: '', hasDocuments: true, submittedDate: 'Oct 12, 2026 02:00 PM',
  submittedAt: '2026-10-12T06:00:00Z', ...extra,
});
const front = document('front', 'owner', 'national_id_front');
const back = document('back', 'owner', 'national_id_back');

test('each account has one applicant row and keeps both independent document IDs', () => {
  const groups = groupVerificationApplicants([back, front]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].id, 'owner');
  assert.deepEqual(groups[0].documents.map(item => item.id), ['front', 'back']);
  assert.equal(groups[0].status, 'PENDING / REVIEW');
  assert.equal(groupVerificationApplicants([front, back, front])[0].documents.length, 2);
});

test('identical names never merge different accounts; legacy responses group by email only', () => {
  assert.equal(groupVerificationApplicants([front, document('other', 'other-owner', 'national_id_front')]).length, 2);
  assert.equal(groupVerificationApplicants([{ ...front, userId: undefined }, { ...back, userId: undefined }]).length, 1);
  assert.equal(groupVerificationApplicants([{ ...front, userId: undefined, email: '' }, { ...back, userId: undefined, email: '' }]).length, 2);
});

test('overall status is rejected if any document is rejected; one approval never verifies the applicant', () => {
  const approved = { ...front, status: 'VERIFIED' };
  assert.equal(applicantStatus([approved, back], 'HOMEOWNER'), 'PENDING / REVIEW');
  assert.equal(applicantStatus([approved], 'HOMEOWNER'), 'PENDING / REVIEW');
  assert.equal(applicantStatus([approved, { ...back, status: 'REJECTED' }], 'HOMEOWNER'), 'REJECTED');
  assert.equal(applicantStatus([front, { ...back, status: 'REJECTED' }], 'HOMEOWNER'), 'REJECTED');
  assert.equal(applicantStatus([approved, { ...back, status: 'VERIFIED' }], 'HOMEOWNER'), 'PENDING / REVIEW');
  assert.equal(applicantStatus([approved, { ...back, status: 'VERIFIED' }, document('photo', 'owner', 'profile_photo', 'VERIFIED')], 'HOMEOWNER'), 'VERIFIED');
  assert.equal(applicantStatus([], 'HOMEOWNER'), 'NO_DOCUMENTS');
});

test('workers require both NBI and Police clearances; wrong or duplicate types do not satisfy the requirement', () => {
  const nbi = document('nbi', 'worker', 'nbi_clearance', 'VERIFIED', { role: 'KASAMBAHAY' });
  const police = document('police', 'worker', 'police_clearance', 'VERIFIED', { role: 'KASAMBAHAY' });
  assert.equal(applicantStatus([nbi, police], 'KASAMBAHAY'), 'PENDING / REVIEW');
  assert.equal(applicantStatus([nbi, police, document('photo', 'worker', 'profile_photo', 'VERIFIED')], 'KASAMBAHAY'), 'VERIFIED');
  assert.equal(applicantStatus([nbi, { ...nbi, id: 'duplicate' }], 'KASAMBAHAY'), 'PENDING / REVIEW');
  assert.equal(applicantStatus([front, back], 'KASAMBAHAY'), 'PENDING / REVIEW');
});

test('latest submission determines the applicant date; placeholders are ignored when documents exist', () => {
  const newer = { ...back, submittedDate: 'Oct 15, 2026 01:00 PM', submittedAt: '2026-10-15T05:00:00Z' };
  const placeholder = document('unsubmitted_owner', 'owner', 'unsubmitted', 'NO_DOCUMENTS', { hasDocuments: false });
  const [applicant] = groupVerificationApplicants([placeholder, front, newer]);
  assert.equal(applicant.documents.length, 2);
  assert.equal(applicant.submittedDate, newer.submittedDate);
  assert.equal(applicant.submittedAt, Date.parse(newer.submittedAt));
  assert.equal(preferredDocument(applicant).id, 'front');
  assert.equal(groupVerificationApplicants([placeholder])[0].status, 'NO_DOCUMENTS');
});

test('reviewing one document leaves its companion visible and unchanged in the same applicant', () => {
  const records = [front, back];
  const reviewed = records.map(item => item.id === front.id ? { ...item, status: 'VERIFIED' } : item);
  const [applicant] = groupVerificationApplicants(reviewed);
  assert.equal(applicant.documents[1], back);
  assert.equal(preferredDocument(applicant).id, 'back');
  assert.equal(applicant.status, 'PENDING / REVIEW');
});

test('queue rows, status counts and pagination count applicants instead of documents', () => {
  const state = { verifications: [front, back], selectedVerificationId: '', setSelectedVerificationId() {},
    currentRole: 'SUPERADMIN', selectedBarangay: 'All Barangays', userBarangays: [], refreshVerifications() {} };
  const { VerificationQueue } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state } })('src/components/verifications/VerificationQueue.tsx');
  const html = renderToStaticMarkup(React.createElement(VerificationQueue));
  assert.equal((html.match(/<tr role="button"/g) || []).length, 1);
  assert.match(html, /1 applicant awaiting review/);
  assert.match(html, />2 documents</);
  assert.match(html, /of.*>1<.*applicants/);
  assert.doesNotMatch(html, /2 documents awaiting review/);
});

test('individual document cards have their own preview, status and review actions', () => {
  const { VerificationDocumentRow } = loader()('src/components/verifications/VerificationDocumentRow.tsx');
  const render = status => renderToStaticMarkup(React.createElement(VerificationDocumentRow, {
    document: { ...front, status }, selected: false, onReview() {}, onApprove() {}, onReject() {}, onReset() {},
  }));
  assert.match(render('PENDING / REVIEW'), /Review national id front/);
  assert.match(render('PENDING / REVIEW'), />Reject<|>Reject<!--/);
  assert.match(render('PENDING / REVIEW'), /Approve/);
  assert.match(render('VERIFIED'), /Re-open/);
  assert.doesNotMatch(render('VERIFIED'), /Confirm rejection|>Approve/);
});

const { IdentityComparisonContent } = loader()('src/components/verifications/IdentityComparisonModal.tsx');
const comparison = (overrides = {}) => renderToStaticMarkup(React.createElement(IdentityComparisonContent, {
  isOpen: true, onClose() {}, user: { id: 'owner', name: 'Sample Applicant', role: 'HOMEOWNER', avatar: '' },
  document: front, documents: [front, back], onDocumentChange() {}, onApprove() {}, onReject() {}, onReset() {}, ...overrides,
}));

test('comparison shows both document choices but only the selected document status', () => {
  const html = comparison({ document: { ...back, status: 'VERIFIED' } });
  assert.match(html, /<select[^>]*aria-label="Document to review"/);
  assert.match(html, /value="front"/);
  assert.match(html, /value="back" selected/);
  assert.match(html, /Re-open document/);
  assert.doesNotMatch(html, />Approve document</);
});

test('comparison cannot approve missing or unresolved images and explains the missing photo', () => {
  const html = comparison();
  assert.match(html, /No image submitted/);
  assert.match(html, /generated avatar cannot be used for face comparison/);
  assert.match(html, /Both images must load before approving/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Approve document<\/button>/);
});

test('applicants with no documents can be inspected without review actions', () => {
  const html = comparison({ document: { ...front, status: 'NO_DOCUMENTS', hasDocuments: false }, documents: [], hasDocuments: false });
  assert.doesNotMatch(html, />Approve document<|>Reject document<|>Re-open document</);
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /Close applicant review/);
});

async function photoReview(t, { fail = false } = {}) {
  const calls = [];
  const { ProfilePhotoReview } = loader()('src/components/verifications/ProfilePhotoReview.tsx');
  let view;
  await act(async () => { view = create(React.createElement(ProfilePhotoReview, {
    photo: document('face', 'owner', 'profile_photo', 'PENDING / REVIEW', { documentImage: '/face.jpg' }),
    documents: [front, back, document('face', 'owner', 'profile_photo')], onSelect: id => calls.push(['select', id]),
    onApprove: async id => { calls.push(['approve', id]); if (fail) throw Error('Please try again.'); },
    onReject: async (id, reason) => calls.push(['reject', id, reason]),
  })); });
  t.after(() => act(() => view.unmount()));
  const button = text => view.root.findAllByType('button').find(node => node.children.includes(text));
  const click = async text => act(async () => { button(text).props.onClick(); });
  return { view, calls, button, click };
}

test('photo review blocks approval until the image loads and keeps ID selection available', async t => {
  const f = await photoReview(t);
  assert.equal(f.button('Approve Photo').props.disabled, true);
  await f.click('national id front');
  assert.deepEqual(f.calls, [['select', 'front']]);
  act(() => f.view.root.findByType('img').props.onLoad());
  await f.click('Approve Photo');
  assert.deepEqual(f.calls[1], ['approve', 'face']);
  assert.match(JSON.stringify(f.view.toJSON()), /Profile photo approved/);
});

test('photo rejection requires a reason and confirmation, without changing the other documents', async t => {
  const f = await photoReview(t);
  act(() => f.view.root.findByType('img').props.onLoad());
  await f.click('Reject Photo');
  assert.match(JSON.stringify(f.view.toJSON()), /Please explain/);
  assert.equal(f.calls.length, 0);
  act(() => f.view.root.findByType('textarea').props.onChange({ target: { value: '  Face is too dark.  ' } }));
  await f.click('Reject Photo');
  assert.equal(f.calls.length, 0);
  await f.click('Keep reviewing');
  assert.equal(f.calls.length, 0);
  await f.click('Reject Photo');
  await f.click('Confirm rejection');
  assert.deepEqual(f.calls, [['reject', 'face', 'Face is too dark.']]);
});

test('failed review and broken images never claim approval', async t => {
  const f = await photoReview(t, { fail: true });
  act(() => f.view.root.findByType('img').props.onLoad());
  await f.click('Approve Photo');
  assert.match(JSON.stringify(f.view.toJSON()), /Please try again/);
  assert.doesNotMatch(JSON.stringify(f.view.toJSON()), /Profile photo approved/);
  act(() => f.view.root.findByType('img').props.onError());
  assert.equal(f.button('Approve Photo').props.disabled, true);
});
