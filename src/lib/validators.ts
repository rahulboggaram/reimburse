import { z } from "zod";
import { ASSIGNABLE_ROLES } from "@/lib/access-roles";
export const sendOtpSchema = z.object({
  phone: z.string().min(10).max(20),
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(10).max(20),
  code: z.string().trim().length(6),
});

export const changePhoneSchema = z.object({
  phone: z.string().min(10).max(20),
  code: z.string().trim().length(6),
});

export const changeEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  code: z.string().trim().length(6),
});

export const employeeProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  ifscCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code"),
  bankAccountNumber: z
    .string()
    .trim()
    .regex(/^\d{9,18}$/, "Enter a valid bank account number (9–18 digits)"),
});

export const updateProfileSchema = employeeProfileSchema;

export const adminCreateEmployeeSchema = z.object({
  phone: z.string().min(10).max(20),
  role: z.enum(ASSIGNABLE_ROLES),
  branchId: z.string().min(1),
});

/** RazorpayX requires at least 100 paise (₹1) per payout. */
export const MIN_REIMBURSEMENT_AMOUNT = 1;

export const createReimbursementFormSchema = z.object({
  amount: z
    .number()
    .min(MIN_REIMBURSEMENT_AMOUNT, "Amount must be at least ₹1.")
    .max(10_000_000),
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().min(3).max(2000),
});

export const refileReimbursementFormSchema = createReimbursementFormSchema;

export const createBranchSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const decideReimbursementSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().trim().max(500).optional(),
});

export const adminUpdateEmployeeSchema = z
  .object({
    role: z.enum(ASSIGNABLE_ROLES).optional(),
    branchId: z.string().min(1).nullable().optional(),
    active: z.literal(true).optional(),
    email: z
      .union([z.string().trim().email("Enter a valid email address."), z.literal("")])
      .optional(),
  })
  .refine(
    (data) =>
      data.role !== undefined ||
      data.branchId !== undefined ||
      data.active === true ||
      data.email !== undefined,
    { message: "No updates provided" },
  );

export const bulkClaimIdsSchema = z.object({
  claimIds: z.array(z.string().min(1)).min(1).max(200),
});
