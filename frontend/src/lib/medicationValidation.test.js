import test from "node:test";
import assert from "node:assert/strict";
import { validateMedication } from "./medicationValidation.js";
test("accepts named medicines and reasonable positive dosage formats", () => {
  for (const name of ["Paracetamol", "Co-amoxiclav", "Vitamin B12", "A + B", "Brand (XR)"])
    for (const dosage of ["500 mg", "250 mcg", "5 ml", "1 tablet", "2 capsules", ".5 ml", "500 mg / 125 mg"])
      assert.deepEqual(validateMedication(name, dosage).errors, {}, `${name}: ${dosage}`);
  assert.equal(validateMedication("  Co-amoxiclav  ", " 500 mg ").name, "Co-amoxiclav");
});
test("rejects blank, symbol-only and excessive names without asserting authenticity", () => {
  for (const name of ["", "  ", "---+", "12345", "A".repeat(151)])
    assert.ok(validateMedication(name, "500 mg").errors.medicine_name);
});
test("rejects negative, zero, blank and malformed dosages", () => {
  for (const dosage of ["", "0 mg", "0.0 ml", "-500 mg", "500", "mg 500", "abc", "1..2 mg", "500 mg + 0 mg", "1 tablet daily", "Infinity mg"])
    assert.ok(validateMedication("Medicine", dosage).errors.dosage, dosage);
});
