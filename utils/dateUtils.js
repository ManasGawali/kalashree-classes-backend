const { MONTH_NAMES } = require("./sendEmail");

/** Add `n` months to a {month, year} pair. month is 1-12. */
function addMonths({ month, year }, n) {
  const idx = (month - 1) + n;
  const newYear = year + Math.floor(idx / 12);
  const newMonth = (((idx % 12) + 12) % 12) + 1;
  return { month: newMonth, year: newYear };
}

/** Compare two {month,year} pairs: returns -1, 0, or 1 */
function compareMY(a, b) {
  if (a.year !== b.year) return a.year < b.year ? -1 : 1;
  if (a.month !== b.month) return a.month < b.month ? -1 : 1;
  return 0;
}

/**
 * Given a user, determine:
 *  - lastPaidMonth/Year (null if never paid)
 *  - dueMonth/dueYear (the next unpaid month - what they currently owe)
 *  - monthsOverdue (count of months due, including the current calendar month if unpaid)
 */
function getUserPaymentStatus(user) {
  const today = new Date();
  const current = { month: today.getMonth() + 1, year: today.getFullYear() };

  const lastPaid = user.paidTillMonth
    ? { month: user.paidTillMonth, year: user.paidTillYear }
    : null;

  const dueStart = lastPaid
    ? addMonths(lastPaid, 1)
    : { month: user.joinMonth, year: user.joinYear };

  // Count months from dueStart up to and including current month
  let monthsOverdue = 0;
  let cursor = { ...dueStart };
  while (compareMY(cursor, current) <= 0) {
    monthsOverdue += 1;
    cursor = addMonths(cursor, 1);
  }

  return {
    lastPaid,
    dueMonth: dueStart.month,
    dueYear: dueStart.year,
    monthsOverdue,
    isUpToDate: compareMY(dueStart, current) > 0,
  };
}

/** Generate a list of the next `count` payable months starting at dueMonth/dueYear */
function getPayableMonths(dueMonth, dueYear, count = 12) {
  const list = [];
  let cursor = { month: dueMonth, year: dueYear };
  for (let i = 0; i < count; i++) {
    list.push({
      month: cursor.month,
      year: cursor.year,
      label: `${MONTH_NAMES[cursor.month]} ${cursor.year}`,
    });
    cursor = addMonths(cursor, 1);
  }
  return list;
}

module.exports = { addMonths, compareMY, getUserPaymentStatus, getPayableMonths };
