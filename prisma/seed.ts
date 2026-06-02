import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

/** Demo logins (OTP mock): use each phone with any 6-digit code when OTP_MOCK=true */
const users = [
  {
    phone: "+919999000001",
    name: "Rahul",
    role: UserRole.ADMIN,
    ifscCode: null,
    bankAccountNumber: null,
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

  const chintamani = await prisma.branch.findUnique({
    where: { name: "Chintamani" },
    select: { id: true },
  });
  const demoBranchId = chintamani?.id ?? null;

  for (const user of users) {
    const shouldAttachBranch =
      demoBranchId && (user.role === UserRole.EMPLOYEE || user.role === UserRole.BRANCH_MANAGER);

    await prisma.user.upsert({
      where: { phone: user.phone },
      update: {
        name: user.name,
        role: user.role,
        ifscCode: user.ifscCode,
        bankAccountNumber: user.bankAccountNumber,
        branchId: shouldAttachBranch ? demoBranchId : null,
        active: true,
      },
      create: {
        ...user,
        active: true,
        branchId: shouldAttachBranch ? demoBranchId : null,
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
