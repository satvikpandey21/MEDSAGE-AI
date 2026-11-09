import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteOwnedDocument } from './deleteOwnedDocument.js';
function fake(result, storageError=null) {
 const events=[];
 const q={delete(){events.push('delete-row');return q;},eq(k,v){events.push([k,v]);return q;},select(){return q;},async single(){return result;}};
 const client={from(){return q;},storage:{from(){return {async remove(paths){events.push(['remove',paths]);return {error:storageError};}};}}};
 return {client,events};
}
const args={table:'patient_prescriptions',bucket:'prescriptions',id:'doc',userId:'patient'};
test('a rejected database delete never removes the Storage object',async()=>{
 const f=fake({error:new Error('protected OCR')});
 await assert.rejects(deleteOwnedDocument({...args,client:f.client}),/protected OCR/);
 assert.equal(f.events.some(e=>Array.isArray(e)&&e[0]==='remove'),false);
});
test('zero deleted rows never remove objects',async()=>{
 const f=fake({data:null});await assert.rejects(deleteOwnedDocument({...args,client:f.client}));
 assert.equal(f.events.some(e=>Array.isArray(e)&&e[0]==='remove'),false);
});
test('successful owner-filtered deletion removes the authoritative returned path',async()=>{
 const f=fake({data:{id:'doc',file_path:'patient/actual.png'}});
 assert.deepEqual(await deleteOwnedDocument({...args,client:f.client}),{storageCleanupPending:false});
 assert.deepEqual(f.events.at(-1),['remove',['patient/actual.png']]);
 assert.ok(f.events.some(e=>Array.isArray(e)&&e[0]==='patient_id'&&e[1]==='patient'));
});
test('Storage failure is reported without pretending the row still exists',async()=>{
 const f=fake({data:{id:'doc',file_path:'patient/actual.png'}},new Error('offline'));
 assert.deepEqual(await deleteOwnedDocument({...args,client:f.client}),{storageCleanupPending:true});
});
test('a returned foreign path is never removed',async()=>{
 const f=fake({data:{id:'doc',file_path:'other/actual.png'}});
 assert.deepEqual(await deleteOwnedDocument({...args,client:f.client}),{storageCleanupPending:true});
 assert.equal(f.events.some(e=>Array.isArray(e)&&e[0]==='remove'),false);
});
