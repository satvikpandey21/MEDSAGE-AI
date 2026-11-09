import test from 'node:test';
import assert from 'node:assert/strict';
import { countLowStockRows } from './sidebarCounts.js';
test('counts across short pages instead of mistaking a server row cap for EOF', async () => {
 const offsets=[];
 const pages={0:[{stock_quantity:0,low_stock_threshold:0},{stock_quantity:20,low_stock_threshold:5}],2:[{stock_quantity:2,low_stock_threshold:5}],3:[]};
 assert.equal(await countLowStockRows(async offset => {offsets.push(offset);return pages[offset];}),2);
 assert.deepEqual(offsets,[0,2,3]);
});
test('empty sets and unknown quantities are not low-stock alerts', async () => {
 assert.equal(await countLowStockRows(async () => []),0);
 assert.equal(await countLowStockRows(async offset => offset ? [] : [{stock_quantity:null},{stock_quantity:8}]),0);
});
test('failed fetch does not return a misleading partial count', async () => {
 await assert.rejects(countLowStockRows(async offset => {if(offset) throw new Error('offline');return [{stock_quantity:0}];}),/offline/);
});
