import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBase } from './api.js';
test('development keeps local fallback; configured base wins over legacy', () => {
 assert.equal(resolveApiBase(), 'http://127.0.0.1:8000');
 assert.equal(resolveApiBase({base:'https://api.example.com/',legacy:'https://old.example.com'}),'https://api.example.com');
});
test('production rejects missing, loopback, plaintext and credential URLs', () => {
 for (const base of ['', 'http://api.example.com','https://localhost','https://127.0.0.1','https://u:p@api.example.com']) {
  assert.throws(() => resolveApiBase({base,production:true}));
 }
});
test('production accepts explicit HTTPS and legacy configuration', () => {
 assert.equal(resolveApiBase({legacy:'https://api.example.com/',production:true}),'https://api.example.com');
});
