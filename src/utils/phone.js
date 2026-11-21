// Bangladesh mobile numbers: strip spaces/dashes, accept +880/880/0
// prefixes, store as +8801XXXXXXXXX (01 decision 7).
const BD_PHONE_RE = /^(?:\+?880|0)1[3-9]\d{8}$/;

export function normalizePhone(value) {
  const compact = String(value ?? "").replace(/[\s-]/g, "");
  if (!BD_PHONE_RE.test(compact)) return null;
  const digits = compact.replace(/^\+/, "");
  const local = digits.startsWith("880") ? digits.slice(3) : digits.slice(1);
  return `+880${local}`;
}
