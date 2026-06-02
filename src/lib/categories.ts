export const EXPENSE_CATEGORIES = [
  "Electricity",
  "House Keeping",
  "Consultant",
  "IT",
  "Office Supplies",
  "Rent",
  "Travel",
  "Utilities",
  "Air Travel",
  "ATM",
  "Commute",
  "Flight Booking",
  "Food",
  "Fuel",
  "Grocery",
  "Hotel",
  "Insurance",
  "Logistics",
  "Marketing",
  "Others",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
