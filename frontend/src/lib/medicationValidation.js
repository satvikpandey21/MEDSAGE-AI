// Formatting checks only; these do not establish medicine identity or clinical safety.
export function validateMedication(rawName, rawDosage) {
  const name = rawName.trim();
  const dosage = rawDosage.trim();
  const errors = {};
  if (!name) errors.medicine_name = "Enter a medicine name.";
  else if (name.length > 150 || !/\p{L}/u.test(name) || /[\p{Cc}]/u.test(name))
    errors.medicine_name = "Enter a medicine name containing letters, up to 150 characters.";
  const part = String.raw`(\d+(?:\.\d+)?|\.\d+)\s*(mg|mcg|\u00b5g|\u03bcg|g|ml|mL|l|units?|iu|tablets?|capsules?|drops?|puffs?|patch(?:es)?|sachets?)`;
  const pattern = new RegExp(`^${part}(?:\\s*(?:/|\\+)\\s*${part})*$`, "i");
  if (!dosage) errors.dosage = "Enter a dosage.";
  else if (dosage.length > 100 || !pattern.test(dosage) ||
    [...dosage.matchAll(/(?:^|[+/])\s*(\d+(?:\.\d+)?|\.\d+)/g)].some((match) => Number(match[1]) <= 0))
    errors.dosage = "Enter a positive quantity and unit, such as 500 mg, 5 ml or 1 tablet.";
  return { name, dosage, errors };
}
