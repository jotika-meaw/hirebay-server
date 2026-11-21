// Express middlewares (02 §3 C2). The role always comes from req.user,
// which verifyToken loaded from the database — never from the token.
function requireRoles(roles) {
  return function verifyRole(req, res, next) {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}

export const verifyRenter = requireRoles(["customer"]);
export const verifyOwner = requireRoles(["owner"]);
export const verifyAdmin = requireRoles(["admin"]);
export const verifyOwnerOrAdmin = requireRoles(["owner", "admin"]);
