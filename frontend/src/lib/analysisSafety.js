export function isSafeAnalysis(value) {
  const scalar = (x) => x == null || typeof x === "string" || (typeof x === "number" && Number.isFinite(x));
  const fields = ["name","active_ingredient","strength","dosage_form","dosage","route","frequency","duration","instructions","instruction","quantity","unit_price","total_price","patient_name","doctor_name","hospital_name","prescription_date","pharmacy_name","bill_number","bill_date","total_amount","raw_ocr_text","message"];
  const sections = ["symptoms","diagnosis","non_medicine_treatment","care_instructions","tests","investigations","follow_up","additional_notes","uncertain_information"];
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.medicines) || value.medicines.length > 200) return false;
  for (const item of [value, ...value.medicines]) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    if (fields.some((key) => key in item && !scalar(item[key]))) return false;
    if ("uncertain_fields" in item && (!Array.isArray(item.uncertain_fields) || item.uncertain_fields.some((x) => typeof x !== "string"))) return false;
  }
  return sections.every((key) => !(key in value) || (Array.isArray(value[key]) && value[key].every((x) => typeof x === "string" || (x && typeof x === "object" && !Array.isArray(x)))));
}

// Keep decimal points and concentration separators in strengths: 0.5mg != 5mg.
const known = (value) => {
  const text = String(value ?? "").trim();
  return /^(?:unknown|unclear|illegible|unidentified|not identified|not specified|not available|n\/a|none|null|unspecified|-)$/i.test(text) ? "" : text;
};
export const normalizeMedicineName = (value) => known(value).toLowerCase().replace(/[^a-z0-9.]/g, "");
const normalizeField = (value) => known(value).toLowerCase().replace(/\s+/g, "");
const form = (value) => normalizeField(value).replace(/^(tablets|tabs?)$/, "tablet").replace(/^(capsules|caps?)$/, "capsule");

function comparableQuantity(medicine) {
  const raw = known(medicine.quantity);
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*(tablets?|tabs?|capsules?|caps?|ml|packs?)$/i)
    || (known(medicine.quantity_unit) && /^\d+(?:\.\d+)?$/.test(raw)
      ? [null, raw, medicine.quantity_unit] : null);
  if (!match || Number(match[1]) <= 0) return null;
  return { amount: Number(match[1]), unit: form(match[2]).replace(/^packs$/, "pack") };
}

export function compareMedicineFields(medicine, billMedicine) {
  const differences = [], uncertainties = [];
  if ([medicine, billMedicine].some((row) => /\?/.test(`${row.name ?? ""} ${row.strength ?? ""}`))) {
    uncertainties.push("Medicine identity or strength contains an uncertainty marker.");
  }
  const leftName = normalizeMedicineName(medicine.name), rightName = normalizeMedicineName(billMedicine.name);
  if (!leftName || !rightName) uncertainties.push("Medicine identity is missing or ambiguous.");
  else if (leftName !== rightName) differences.push("Medicine name does not match.");
  const leftStrength = normalizeField(medicine.strength), rightStrength = normalizeField(billMedicine.strength);
  if (!leftStrength || !rightStrength) uncertainties.push("strength is missing on one or both sides.");
  else if (leftStrength !== rightStrength) differences.push("strength does not match.");
  const leftForm = form(medicine.dosage_form), rightForm = form(billMedicine.dosage_form);
  if (leftForm && rightForm && leftForm !== rightForm) differences.push("dosage_form does not match.");
  const leftIngredient = normalizeField(medicine.active_ingredient), rightIngredient = normalizeField(billMedicine.active_ingredient);
  if (leftIngredient && rightIngredient && leftIngredient !== rightIngredient) differences.push("Active ingredient does not match.");
  const leftQuantity = comparableQuantity(medicine), rightQuantity = comparableQuantity(billMedicine);
  if (leftQuantity && rightQuantity && leftQuantity.unit === rightQuantity.unit
      && leftQuantity.amount !== rightQuantity.amount) differences.push("quantity does not match.");
  const administration = new Set(["dosage", "dose", "frequency", "duration", "route", "instructions", "instruction"]);
  for (const row of [medicine, billMedicine]) {
    if (row.uncertain_fields?.some((field) => !administration.has(field)
      && !(field === "dosage_form" && (!leftForm || !rightForm)))) {
      uncertainties.push("Some extracted fields are uncertain."); break;
    }
  }
  return { differences, uncertainties };
}

export function comparePrescriptionMedicines(prescriptionMedicines, billMedicines) {
  return prescriptionMedicines.map((medicine) => {
    const name = normalizeMedicineName(medicine.name);
    const candidates = billMedicines.filter((row) => normalizeMedicineName(row.name) === name);
    const base = { prescription_medicine: medicine.name || null, bill_medicine: candidates[0]?.name || null };
    if (!name) return { ...base, status: "needs_review", reason: "Medicine identity is missing or ambiguous." };
    if (!candidates.length) return { ...base, status: "mismatch", reason: "Medicine name not found as an exact match on the bill." };
    if (candidates.length > 1 || prescriptionMedicines.filter((row) => normalizeMedicineName(row.name) === name).length > 1) {
      return { ...base, status: "needs_review", reason: "Duplicate medicine names require manual identification." };
    }
    const { differences, uncertainties } = compareMedicineFields(medicine, candidates[0]);
    return { ...base, differences, uncertainties,
      status: differences.length ? "mismatch" : uncertainties.length ? "needs_review" : "matched" };
  });
}
