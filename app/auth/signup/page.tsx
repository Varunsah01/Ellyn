"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";
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

const signupSchema = z
  .object({
    full_name: z.string().min(1, "Full name is required"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match",
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: values.email.trim().toLowerCase(),
          password: values.password,
          full_name: values.full_name.trim(),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        showToast.error(payload.error ?? "Failed to create account");
        return;
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });

      if (signInError) {
        showToast.error(signInError.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to create account");
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
              Create your account
            </CardTitle>
            <p className="font-dm-sans text-sm text-[#5E5B86]">
              Start using ELLYN with your free account.
            </p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-dm-sans text-[#2D2B55]">Full Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Jane Doe"
                          autoComplete="name"
                          className="border-[#D8D6EA] focus-visible:ring-[#2D2B55]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-dm-sans text-[#2D2B55]">Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Minimum 8 characters"
                          autoComplete="new-password"
                          className="border-[#D8D6EA] focus-visible:ring-[#2D2B55]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-dm-sans text-[#2D2B55]">
                        Confirm Password
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Re-enter password"
                          autoComplete="new-password"
                          className="border-[#D8D6EA] focus-visible:ring-[#2D2B55]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 w-full bg-[#2D2B55] font-dm-sans text-white hover:bg-[#25234A]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create account"
                  )}
                </Button>
              </form>
            </Form>

            <p className="mt-6 text-center font-dm-sans text-sm text-[#5E5B86]">
              Already have an account?{" "}
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
