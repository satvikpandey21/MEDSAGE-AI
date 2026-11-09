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

export function compareMedicineFields(medicine, billMedicine) {
  const normalize = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const differences = [], uncertainties = [];
  if (medicine.uncertain_fields?.length || billMedicine.uncertain_fields?.length) uncertainties.push("Some extracted fields are uncertain.");
  for (const field of ["strength", "dosage_form"]) {
    const left = normalize(medicine[field]), right = normalize(billMedicine[field]);
    if (!left || !right) uncertainties.push(`${field} is missing on one or both sides.`);
    else if (left !== right) differences.push(`${field} does not match.`);
  }
  return { differences, uncertainties };
}
