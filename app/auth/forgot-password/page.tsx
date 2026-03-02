"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: ForgotPasswordValues) => {
    setIsSubmitting(true);
    setSuccessMessage("");
    form.clearErrors("root");

    try {
      const supabase = createClient();
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/auth/login` : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(
        values.email.trim().toLowerCase(),
        redirectTo ? { redirectTo } : undefined
      );

      if (error) {
        form.setError("root", { message: error.message });
        return;
      }

      setSuccessMessage("Password reset email sent. Check your inbox.");
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to send reset email",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FAFAFA] px-4 py-10 text-[#2D2B55]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg items-center">
        <Card className="w-full border-[#E7E6EF] bg-white shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="font-fraunces text-3xl text-[#2D2B55]">
              Reset password
            </CardTitle>
            <p className="font-dm-sans text-sm text-[#5E5B86]">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-dm-sans text-[#2D2B55]">
                        Email Address
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="you@example.com"
                          autoComplete="email"
                          className="border-[#D8D6EA] focus-visible:ring-[#2D2B55]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.formState.errors.root?.message ? (
                  <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
                ) : null}

                {successMessage ? <p className="text-sm text-green-700">{successMessage}</p> : null}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 w-full bg-[#2D2B55] font-dm-sans text-white hover:bg-[#25234A]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send reset email"
                  )}
                </Button>
              </form>
            </Form>

            <p className="mt-6 text-center font-dm-sans text-sm text-[#5E5B86]">
              Back to{" "}
              <Link href="/auth/login" className="font-medium text-[#2D2B55] underline">
                Log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
