import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeAnalysis, compareMedicineFields } from './analysisSafety.js';
test('historical malformed analyses cannot reach medicine card renderers',()=>{
 for(const value of [null,{}, {medicines:[null]}, {medicines:[{name:{}}]}, {medicines:[],pharmacy_name:{}}, {medicines:[{uncertain_fields:'bad'}]}]) assert.equal(isSafeAnalysis(value),false);
 assert.equal(isSafeAnalysis({medicines:[{name:'Synthetic',strength:null,uncertain_fields:['strength']}]}),true);
});
test('missing strength/form on both sides requires review rather than a match',()=>{
 const result=compareMedicineFields({name:'Synthetic'},{name:'Synthetic'});
 assert.equal(result.differences.length,0);assert.equal(result.uncertainties.length,2);
});
test('explicit strength/form disagreements remain mismatches',()=>{
 const result=compareMedicineFields({strength:'5mg',dosage_form:'tablet'},{strength:'10mg',dosage_form:'syrup'});
 assert.equal(result.differences.length,2);
});
test('complete matching fields retain matched behavior, uncertainty remains flagged',()=>{
 assert.deepEqual(compareMedicineFields({strength:'5 mg',dosage_form:'Tablet'},{strength:'5mg',dosage_form:'tablet'}),{differences:[],uncertainties:[]});
 assert.ok(compareMedicineFields({strength:'5mg',dosage_form:'tablet',uncertain_fields:['strength']},{strength:'5mg',dosage_form:'tablet'}).uncertainties.length);
});
