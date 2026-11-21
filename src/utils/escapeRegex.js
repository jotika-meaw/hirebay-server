// Escape a user string before embedding it in a RegExp (server-side
// search). Mirrors the client mock semantics (02 §5, escaped, ≤ 60 chars
// applied by callers).
export function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
