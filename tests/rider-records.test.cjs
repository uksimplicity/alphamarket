const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/components/admin/riderRecords.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const {parseRider, riderRows, mergeRiderDetails, mergeRiderAccount, safeRiderDocumentUrl} = loaded.exports;

test('queue unwraps rider collections without confusing documents with riders', () => {
  const rider = { id: 'rider-1', documents: ['https://example.com/licence.pdf'] };
  assert.deepEqual(riderRows({data: {riders: [rider], total: 1}}), [rider]);
  assert.deepEqual(riderRows({documents: [rider]}), []);
  assert.deepEqual(riderRows({data: {riders: []}}), []);
});

test('nested user identity and vehicle details are displayed with the rider ID', () => {
  const rider = parseRider({
    id: 'rider-1', user_id: 'user-1', status: 'offline', license_number: 'LIC-123',
    user: {id: 'user-1', first_name: 'Ada', last_name: 'Okoro', email: 'ada@example.com', phone_number: '+234123'},
    vehicle: {type: 'motorcycle', model: 'Model A', plate_number: 'ABC-123'},
  });
  assert.equal(rider.id, 'rider-1');
  assert.equal(rider.userId, 'user-1');
  assert.equal(rider.name, 'Ada Okoro');
  assert.equal(rider.email, 'ada@example.com');
  assert.equal(rider.phone, '+234123');
  assert.equal(rider.vehicleType, 'motorcycle');
  assert.equal(rider.vehiclePlate, 'ABC-123');
  assert.equal(rider.licenseNumber, 'LIC-123');
  assert.equal(rider.availability, 'offline');
});

test('driver registration document arrays and labelled documents are supported', () => {
  const rider = parseRider({vehicle_number: 'ABC-123', documents: [
    'https://example.com/license.pdf',
    {type: 'Identity card', file_url: '/uploads/id.png'},
    {url: 'javascript:alert(1)'},
  ]});
  assert.equal(rider.vehiclePlate, 'ABC-123');
  assert.deepEqual(rider.documents, [
    {label: 'Document 1', url: 'https://example.com/license.pdf'},
    {label: 'Identity card', url: '/uploads/id.png'},
  ]);
});

test('rider detail fields in gRPC camel case are supported', () => {
  const rider = parseRider({riderId: 'rider-1', fullName: 'Ada Okoro', phoneNumber: '+234123', vehicleType: 'car', vehicleModel: 'Model B', vehicleNumber: 'ABC-123', documents: [{fileUrl: 'https://example.com/id.pdf'}]});
  assert.equal(rider.id, 'rider-1');
  assert.equal(rider.name, 'Ada Okoro');
  assert.equal(rider.phone, '+234123');
  assert.equal(rider.vehicleType, 'car');
  assert.equal(rider.vehiclePlate, 'ABC-123');
  assert.equal(rider.documents.length, 1);
});

test('documents reject executable and external protocol-relative URLs', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,bad', '//evil.example/id', '/\\evil.example/id', '/\nevil.example/id', 'https://user:password@example.com/id', {}]) {
    assert.equal(safeRiderDocumentUrl(value), '');
  }
  assert.equal(safeRiderDocumentUrl('/uploads/license.pdf'), '/uploads/license.pdf');
});

test('sparse additional details preserve submitted data and the verification target', () => {
  const summary = parseRider({id: 'rider-1', email: 'ada@example.com', vehicle_number: 'ABC', documents: ['https://example.com/id.pdf']});
  const merged = mergeRiderDetails(summary, {data: {id: 'rider-1', user: {id: 'user-1', first_name: 'Ada', last_name: 'Okoro'}, documents: ['https://example.com/id.pdf', 'https://example.com/licence.pdf']}});
  assert.equal(merged.id, 'rider-1');
  assert.equal(merged.name, 'Ada Okoro');
  assert.equal(merged.email, 'ada@example.com');
  assert.equal(merged.vehiclePlate, 'ABC');
  assert.equal(merged.documents.length, 2);
});

test('a mismatched rider detail response cannot replace the selected rider identity or documents', () => {
  const summary = parseRider({id: 'rider-1', name: 'Ada'});
  const merged = mergeRiderDetails(summary, {data: {id: 'rider-2', name: 'Another rider', documents: ['https://example.com/other.pdf']}});
  assert.deepEqual(merged, summary);
});

test('missing information is not fabricated and user IDs are not verification IDs', () => {
  const rider = parseRider({user: {id: 'user-1'}, status: 'offline'});
  assert.equal(rider.id, '');
  assert.equal(rider.userId, 'user-1');
  assert.equal(rider.name, '');
  assert.equal(rider.licenseNumber, '');
  assert.deepEqual(rider.documents, []);
});

test('a KYC-only rider gets their registered name from the linked account', () => {
  const rider = parseRider({id: 'rider-1', user_id: 'user-1', vehicle_number: 'ABC', documents: ['https://example.com/license.pdf']});
  const merged = mergeRiderAccount(rider, {data: {id: 'user-1', first_name: 'Ada', last_name: 'Okoro', email: 'ada@example.com', phone: '+234123'}});
  assert.equal(merged.name, 'Ada Okoro');
  assert.equal(merged.email, 'ada@example.com');
  assert.equal(merged.phone, '+234123');
  assert.equal(merged.id, 'rider-1');
  assert.equal(merged.userId, 'user-1');
  assert.equal(merged.vehiclePlate, 'ABC');
  assert.deepEqual(merged.documents, rider.documents);
});

test('nested camel-case user account responses hydrate identity without erasing known contact fields', () => {
  const rider = parseRider({id: 'rider-1', userId: 'user-1', phone: '+234123'});
  const merged = mergeRiderAccount(rider, {data: {user: {id: 'user-1', firstName: 'Ada', lastName: 'Okoro'}}});
  assert.equal(merged.name, 'Ada Okoro');
  assert.equal(merged.phone, '+234123');
});

test('another account or a missing account ID cannot supply the rider identity', () => {
  const rider = parseRider({id: 'rider-1', user_id: 'user-1'});
  assert.throws(() => mergeRiderAccount(rider, {data: {id: 'user-2', name: 'Another person'}}), /does not match/);
  assert.throws(() => mergeRiderAccount(rider, {data: {name: 'Unknown person'}}), /does not match/);
  assert.throws(() => mergeRiderAccount(parseRider({id: 'rider-1'}), {data: {id: 'rider-1', name: 'Wrong association'}}), /does not match/);
});
