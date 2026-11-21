import { ObjectId } from "mongodb";

// Matches a user id stored either as an ObjectId or as a plain string
// (check what BetterAuth stored). Used by auth + profile lookups.
export function matchUserId(id) {
  const or = [{ _id: id }, { id }];
  if (typeof id === "string" && ObjectId.isValid(id)) {
    or.push({ _id: new ObjectId(id) });
  }
  return { $or: or };
}
