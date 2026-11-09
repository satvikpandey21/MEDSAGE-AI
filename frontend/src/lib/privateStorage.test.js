import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnedSignedUrl } from './privateStorage.js';
function fixture({signedError=null,user='patient',authError=null}={}) {
 const calls=[];
 return {calls,client:{auth:{async getUser(){return {data:{user:user?{id:user}:null},error:authError};}},storage:{from(bucket){calls.push(bucket);return {async createSignedUrl(path,ttl){calls.push({path,ttl});return {data:{signedUrl:'https://storage.example/object/sign/private?token=synthetic'},error:signedError};}};}}}};
}
test('private prescription viewing requests a 60-second authenticated signed URL',async()=>{
 const f=fixture();assert.match(await createOwnedSignedUrl(f.client,'prescriptions','patient/synthetic.png'),/object\/sign/);
 assert.deepEqual(f.calls,['prescriptions',{path:'patient/synthetic.png',ttl:60}]);
});
test('bill bucket uses the same short-lived private mechanism',async()=>{
 const f=fixture();await createOwnedSignedUrl(f.client,'pharmacy-bills','patient/synthetic.pdf');
 assert.deepEqual(f.calls,['pharmacy-bills',{path:'patient/synthetic.pdf',ttl:60}]);
});
test('signed URL denial fails closed without a public-URL fallback',async()=>{
 const f=fixture({signedError:new Error('denied')});await assert.rejects(createOwnedSignedUrl(f.client,'prescriptions','patient/synthetic.png'),/private document link/);
 assert.equal(f.calls.length,2);
});
test('anonymous users never reach Storage',async()=>{
 const f=fixture({user:null});await assert.rejects(createOwnedSignedUrl(f.client,'prescriptions','patient/synthetic.png'),/sign in/);assert.deepEqual(f.calls,[]);
});
test('an approved caretaker session cannot sign a patient path through the client helper',async()=>{
 const f=fixture({user:'caretaker'});await assert.rejects(createOwnedSignedUrl(f.client,'prescriptions','patient/synthetic.png'),/access denied/);assert.deepEqual(f.calls,[]);
});
test('foreign, encoded and traversal paths never reach Storage',async()=>{
 for(const path of ['other/x','patient/../x','patient/%2e%2e/x','patient/a\\x']){
  const f=fixture();await assert.rejects(createOwnedSignedUrl(f.client,'prescriptions',path));assert.deepEqual(f.calls,[]);
 }
});
