import test from 'node:test';
import assert from 'node:assert/strict';
import { updateStockSafely } from './updateStockSafely.js';
const fixture=(result)=>{
 const filters=[];const q={update(){return q;},eq(k,v){filters.push([k,v]);return q;},is(k,v){filters.push([k,v]);return q;},select(){return q;},async single(){return result;}};
 return {client:{from(){return q;}},filters};
};
test('stock writes include owner, observed stock/threshold and available version',async()=>{
 const f=fixture({data:{id:'s'}});
 await updateStockSafely(f.client,{id:'s',stock_quantity:5,low_stock_threshold:3,caretaker_edit_version:4},'patient',{stock_quantity:8});
 assert.deepEqual(f.filters,[['id','s'],['patient_id','patient'],['stock_quantity',5],['low_stock_threshold',3],['caretaker_edit_version',4]]);
});
test('stale or denied writes fail instead of reporting success',async()=>{
 const f=fixture({data:null});await assert.rejects(updateStockSafely(f.client,{id:'s'},'patient',{stock_quantity:8}),/Reload/);
});
test('unknown stock uses IS NULL and needs no pending-migration version column',async()=>{
 const f=fixture({data:{id:'s'}});await updateStockSafely(f.client,{id:'s',stock_quantity:null,low_stock_threshold:0},'patient',{stock_quantity:8});
 assert.deepEqual(f.filters,[['id','s'],['patient_id','patient'],['stock_quantity',null],['low_stock_threshold',0]]);
});
