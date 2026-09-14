import { z } from "zod";

export const userPasswordSchema = z.string()
  .min(1, "Password is required")
  .min(6, "Password must be at least 6 characters")
  .max(128, "Password must be at most 128 characters");

export const signInSchema = z.object({
  email:    z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required").max(128, "Password too long"),
});

export const signUpSchema = z.object({
  email:     z.string().email("Invalid email"),
  password:  userPasswordSchema,
  firstName: z.string().min(1).max(100).optional(),
  lastName:  z.string().min(1).max(100).optional(),
});

export const resendVerificationSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  password: userPasswordSchema,
  confirmPassword: z.string().min(1, "Confirm password is required"),
}).superRefine(({ password, confirmPassword }, context) => {
  if (confirmPassword && password !== confirmPassword) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confirmPassword"],
      message: "Passwords do not match",
    });
  }
});

export type SignInInput  = z.infer<typeof signInSchema>;
export type SignUpInput  = z.infer<typeof signUpSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
