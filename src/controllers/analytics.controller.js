import { getDb } from "../lib/db.js";

// Last 6 calendar months including the current one, oldest first,
// as "YYYY-MM". Months with no data return 0 (filled by callers).
export function last6Months(now = new Date()) {
  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(m.toISOString().slice(0, 7));
  }
  return months;
}

export function monthStart(month) {
  return new Date(`${month}-01T00:00:00.000Z`);
}

export async function getAdminAnalytics(req, res, next) {
  try {
    const db = await getDb();
    const now = new Date();
    const months = last6Months(now);
    const [totalUsers, totalEquipment, totalBookings, pendingApprovals, completedRentals, revenueAll, revenueByMonth, bookingsByMonth] =
      await Promise.all([
        db.collection("user").countDocuments({}),
        db.collection("equipment").countDocuments({}),
        db.collection("bookings").countDocuments({}),
        db.collection("equipment").countDocuments({ status: "pending" }),
        db.collection("bookings").countDocuments({ status: "completed" }),
        db
          .collection("payments")
          .aggregate([
            { $match: { status: "paid" } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ])
          .toArray(),
        db
          .collection("payments")
          .aggregate([
            { $match: { status: "paid", createdAt: { $gte: monthStart(months[0]) } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                revenue: { $sum: "$amount" },
              },
            },
          ])
          .toArray(),
        db
          .collection("bookings")
          .aggregate([
            { $match: { createdAt: { $gte: monthStart(months[0]) } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                bookings: { $sum: 1 },
              },
            },
          ])
          .toArray(),
      ]);
    const revenueMap = new Map(revenueByMonth.map((r) => [r._id, r.revenue]));
    const bookingsMap = new Map(bookingsByMonth.map((r) => [r._id, r.bookings]));
    return res.json({
      data: {
        totalUsers,
        totalEquipment,
        totalBookings,
        pendingApprovals,
        completedRentals,
        totalRevenue: revenueAll[0]?.total ?? 0,
        monthly: months.map((month) => ({
          month,
          bookings: bookingsMap.get(month) ?? 0,
          revenue: revenueMap.get(month) ?? 0,
        })),
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function getOwnerAnalytics(req, res, next) {
  try {
    const db = await getDb();
    const now = new Date();
    const months = last6Months(now);
    const ownerId = req.user.id;
    const [listed, byStatus, completedRentals, paidAgg, paidByMonth, statusMix] = await Promise.all([
      db.collection("equipment").countDocuments({ "owner.id": ownerId }),
      db
        .collection("equipment")
        .aggregate([{ $match: { "owner.id": ownerId } }, { $group: { _id: "$status", count: { $sum: 1 } } }])
        .toArray(),
      db.collection("bookings").countDocuments({ "owner.id": ownerId, status: "completed" }),
      db
        .collection("bookings")
        .aggregate([
          { $match: { "owner.id": ownerId, paymentStatus: "paid" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ])
        .toArray(),
      db
        .collection("bookings")
        .aggregate([
          { $match: { "owner.id": ownerId, paymentStatus: "paid", createdAt: { $gte: monthStart(months[0]) } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
              earnings: { $sum: "$totalAmount" },
            },
          },
        ])
        .toArray(),
      db
        .collection("bookings")
        .aggregate([{ $match: { "owner.id": ownerId } }, { $group: { _id: "$status", count: { $sum: 1 } } }])
        .toArray(),
    ]);
    const statusCount = new Map(byStatus.map((r) => [r._id, r.count]));
    const mixCount = new Map(statusMix.map((r) => [r._id, r.count]));
    const earningsMap = new Map(paidByMonth.map((r) => [r._id, r.earnings]));
    const thisMonthKey = months[months.length - 1];
    return res.json({
      data: {
        listed,
        approved: statusCount.get("approved") ?? 0,
        pending: statusCount.get("pending") ?? 0,
        rejected: statusCount.get("rejected") ?? 0,
        completedRentals,
        totalEarnings: paidAgg[0]?.total ?? 0,
        thisMonth: earningsMap.get(thisMonthKey) ?? 0,
        statusMix: {
          completed: mixCount.get("completed") ?? 0,
          confirmed: mixCount.get("confirmed") ?? 0,
          pending: mixCount.get("pending") ?? 0,
        },
        monthly: months.map((month) => ({ month, earnings: earningsMap.get(month) ?? 0 })),
      },
    });
  } catch (err) {
    return next(err);
  }
}
