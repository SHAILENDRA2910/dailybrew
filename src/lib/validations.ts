import { z } from "zod";
import { CURRENCIES, MAX_BUDGET_RUPEES, MAX_QUANTITY, MAX_RATE_RUPEES } from "@/lib/constants";
import { isValidISODate } from "@/lib/dates";
import { isValidMonthKey } from "@/lib/dates";

const currencyCodes = CURRENCIES.map((currency) => currency.code) as [
  string,
  ...string[],
];

export const workspaceSetupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Please add your name.")
    .max(60, "Keep your name under 60 characters."),
  workspaceName: z
    .string()
    .trim()
    .min(2, "Give your workspace a name.")
    .max(60, "Keep the workspace name under 60 characters."),
  importHistory: z.boolean(),
});

export type WorkspaceSetupValues = z.infer<typeof workspaceSetupSchema>;

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Please add your name.").max(60),
  email: z
    .union([z.string().trim().email("Enter a valid email address."), z.literal("")])
    .optional(),
});

export type ProfileValues = z.infer<typeof profileSchema>;

export const workspaceSettingsSchema = z.object({
  name: z.string().trim().min(2, "Name your workspace.").max(60),
  currency: z.enum(currencyCodes),
  timezone: z.string().trim().min(1).max(80),
  dateFormat: z.enum(["dmy", "medium"]),
});

export type WorkspaceSettingsValues = z.infer<typeof workspaceSettingsSchema>;

export const expenseLineSchema = z.object({
  itemId: z.string().min(1, "Choose an item."),
  quantity: z
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(MAX_QUANTITY, `Quantity cannot exceed ${MAX_QUANTITY}.`),
  unitRate: z
    .number()
    .int()
    .min(0, "Rate cannot be negative.")
    .max(MAX_RATE_RUPEES * 100, "Rate is too large."),
});

export const expenseSchema = z.object({
  expenseDate: z
    .string()
    .refine((value) => isValidISODate(value), "Choose a valid expense date."),
  note: z.string().trim().max(240, "Keep notes under 240 characters."),
  items: z.array(expenseLineSchema).min(1, "Add at least one item before saving."),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;

export const itemFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the item a name.")
    .max(80, "Keep the item name under 80 characters."),
  categoryId: z.string().min(1, "Choose a category."),
  rateRupees: z
    .number({ error: "Enter a valid rate." })
    .min(0, "Rate cannot be negative.")
    .max(MAX_RATE_RUPEES, "That rate looks too high."),
  unit: z.string().trim().min(1, "Choose a unit.").max(24),
  isActive: z.boolean(),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name the category.")
    .max(40, "Keep the category name under 40 characters."),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export const budgetFormSchema = z.object({
  amountRupees: z
    .number({ error: "Enter a valid budget." })
    .min(1, "Budget must be greater than zero.")
    .max(MAX_BUDGET_RUPEES, "That budget looks too high."),
});

export type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export const budgetPeriodSchema = z.object({
  monthKey: z.string().refine(isValidMonthKey, "Choose a valid month."),
});

export const dateRangeSchema = z
  .object({
    from: z.string().refine(isValidISODate, "Choose a valid start date."),
    to: z.string().refine(isValidISODate, "Choose a valid end date."),
  })
  .refine((value) => value.from <= value.to, {
    message: "The start date must be before the end date.",
    path: ["to"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});
