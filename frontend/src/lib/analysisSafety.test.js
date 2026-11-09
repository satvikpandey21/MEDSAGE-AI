import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeAnalysis, compareMedicineFields, comparePrescriptionMedicines } from './analysisSafety.js';
test('historical malformed analyses cannot reach medicine card renderers',()=>{
 for(const value of [null,{}, {medicines:[null]}, {medicines:[{name:{}}]}, {medicines:[],pharmacy_name:{}}, {medicines:[{uncertain_fields:'bad'}]}]) assert.equal(isSafeAnalysis(value),false);
 assert.equal(isSafeAnalysis({medicines:[{name:'Synthetic',strength:null,uncertain_fields:['strength']}]}),true);
});
test('missing strength requires review; missing form adds no warning',()=>{
 const result=compareMedicineFields({name:'Synthetic'},{name:'Synthetic'});
 assert.equal(result.differences.length,0);assert.equal(result.uncertainties.length,1);
});
test('explicit strength/form disagreements remain mismatches',()=>{
 const result=compareMedicineFields({name:'Synthetic',strength:'5mg',dosage_form:'tablet'},{name:'Synthetic',strength:'10mg',dosage_form:'syrup'});
 assert.equal(result.differences.length,2);
});
test('complete matching fields retain matched behavior, uncertainty remains flagged',()=>{
 assert.deepEqual(compareMedicineFields({name:'Synthetic',strength:'5 mg',dosage_form:'Tablet'},{name:'Synthetic',strength:'5mg',dosage_form:'tablet'}),{differences:[],uncertainties:[]});
 assert.ok(compareMedicineFields({strength:'5mg',dosage_form:'tablet',uncertain_fields:['strength']},{strength:'5mg',dosage_form:'tablet'}).uncertainties.length);
});

const medicine = { name: 'Synthetic Medicine', strength: '500 mg' };
const compare = (left, right) => comparePrescriptionMedicines(left, right)[0];
test('matching identity and known strength match with form absent on either or both sides', () => {
 for (const [left,right] of [[medicine,medicine],[{...medicine,dosage_form:'tablet'},medicine],[medicine,{...medicine,dosage_form:'tablet'}]]) {
  const result=compare([left],[right]);assert.equal(result.status,'matched');assert.deepEqual(result.uncertainties,[]);
 }
});
test('known conflicting names, strengths, ingredients and forms remain discrepancies', () => {
 for (const changes of [{name:'Different'},{strength:'250mg'},{dosage_form:'syrup'},{active_ingredient:'Different ingredient'}]) {
  const result=compare([{...medicine,dosage_form:'tablet',active_ingredient:'Synthetic ingredient'}],[{...medicine,dosage_form:'tablet',active_ingredient:'Synthetic ingredient',...changes}]);
  assert.equal(result.status,'mismatch');
 }
 assert.equal(compare([{...medicine,strength:'0.5mg'}],[{...medicine,strength:'5mg'}]).status,'mismatch');
});
test('administration instructions absent on bills never cause a warning', () => {
 const result=compare([{...medicine,dosage:'One tablet twice daily',frequency:'twice daily',uncertain_fields:['dosage','frequency']}],[{...medicine,uncertain_fields:['dosage_form','instructions']}]);
 assert.equal(result.status,'matched');assert.deepEqual(result.uncertainties,[]);
});
test('unknown strength or uncertain identity remains needs_review', () => {
 for(const row of [{...medicine,strength:null},{...medicine,strength:'unknown'},{...medicine,uncertain_fields:['name']},{...medicine,name:null},{...medicine,name:'Synthetic Medicine?'}]) {
  assert.equal(compare([row],[medicine]).status,'needs_review');
 }
});
test('duplicate normalized names on either side never silently choose the first', () => {
 assert.equal(compare([medicine],[medicine,{...medicine,strength:'250mg'}]).status,'needs_review');
 assert.equal(compare([medicine,medicine],[medicine]).status,'needs_review');
});
test('quantity compares only with explicit comparable units; no unit conversion is invented', () => {
 assert.equal(compare([{...medicine,quantity:'10 tablets'}],[{...medicine,quantity:'20 tablets'}]).status,'mismatch');
 for(const [left,right] of [['10','20'],[null,'20 tablets'],['10 tablets','1 pack'],['unknown','20 tablets']]) {
  assert.equal(compare([{...medicine,quantity:left}],[{...medicine,quantity:right}]).status,'matched');
 }
});
