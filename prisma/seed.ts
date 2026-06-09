import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

/** Demo logins (OTP mock): use each phone with any 6-digit code when OTP_MOCK=true */
const users = [
  {
    phone: "+919999000001",
    name: "Rahul",
    role: UserRole.ADMIN,
    ifscCode: "HDFC0001234",
    bankAccountNumber: "50100987654321",
  },
  {
    phone: "+919999000002",
    name: "Sadan",
    role: UserRole.BRANCH_MANAGER,
    ifscCode: "HDFC0001234",
    bankAccountNumber: "50100123456789",
  },
  {
    phone: "+919999000003",
    name: "Sudhi",
    role: UserRole.APPROVER,
    ifscCode: "ICIC0005678",
    bankAccountNumber: "60012345678901",
  },
  {
    phone: "+919999000004",
    name: "Sandeep",
    role: UserRole.EMPLOYEE,
    ifscCode: "SBIN0001234",
    bankAccountNumber: "38012345678901",
  },
];

const defaultBranches = [
  "Head Office",
  "Anantapur",
  "Avalahalli",
  "Chikkaballapur",
  "Chintamani",
  "Chittoor",
  "Doddaballapur",
  "Hoskote",
  "Malur",
  "Sidlaghatta",
  "Tirupati",
] as const;

const defaultCategories = [
  "Air Travel",
  "ATM",
  "Commute",
  "Consultant",
  "Electricity",
  "Flight Booking",
  "Food",
  "Fuel",
  "Grocery",
  "Hotel",
  "House Keeping",
  "Insurance",
  "IT",
  "Logistics",
  "Marketing",
  "Office Supplies",
  "Others",
  "Rent",
  "Travel",
  "Utilities",
] as const;

async function main() {
  for (const name of defaultBranches) {
    await prisma.branch.upsert({
      where: { name },
      update: { active: true },
      create: { name, active: true },
    });
  }

  await prisma.branch.updateMany({
    where: { name: { notIn: [...defaultBranches] } },
    data: { active: false },
  });

  for (const name of defaultCategories) {
    await prisma.expenseCategory.upsert({
      where: { name },
      update: { active: true },
      create: { name, active: true },
    });
  }

  const headOffice = await prisma.branch.findUnique({
    where: { name: "Head Office" },
    select: { id: true },
  });
  const chintamani = await prisma.branch.findUnique({
    where: { name: "Chintamani" },
    select: { id: true },
  });

  for (const user of users) {
    const branchId =
      user.role === UserRole.ADMIN || user.role === UserRole.APPROVER
        ? (headOffice?.id ?? null)
        : (chintamani?.id ?? null);

    await prisma.user.upsert({
      where: { phone: user.phone },
      update: {
        name: user.name,
        role: user.role,
        ifscCode: user.ifscCode,
        bankAccountNumber: user.bankAccountNumber,
        branchId,
        active: true,
      },
      create: {
        ...user,
        active: true,
        branchId,
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
