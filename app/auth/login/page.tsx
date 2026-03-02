"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
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

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectPath = useMemo(() => {
    const redirect = searchParams.get("redirect");
    if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
      return "/dashboard";
    }
    return redirect;
  }, [searchParams]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    form.clearErrors("root");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });

      if (error) {
        form.setError("root", { message: error.message });
        return;
      }

      router.push(redirectPath);
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to sign in",
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
            <CardTitle className="font-fraunces text-3xl text-[#2D2B55]">Log in</CardTitle>
            <p className="font-dm-sans text-sm text-[#5E5B86]">
              Sign in to continue to your dashboard.
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
                          placeholder="Your password"
                          autoComplete="current-password"
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

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 w-full bg-[#2D2B55] font-dm-sans text-white hover:bg-[#25234A]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    "Log in"
                  )}
                </Button>
              </form>
            </Form>

            <div className="mt-6 flex flex-col gap-2 text-center font-dm-sans text-sm text-[#5E5B86]">
              <Link href="/auth/forgot-password" className="font-medium text-[#2D2B55] underline">
                Forgot password?
              </Link>
              <p>
                Don&apos;t have an account?{" "}
                <Link href="/auth/signup" className="font-medium text-[#2D2B55] underline">
                  Sign up
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function LoginPageFallback() {
  return (
    <main className="min-h-screen bg-[#FAFAFA] px-4 py-10 text-[#2D2B55]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg items-center">
        <Card className="w-full border-[#E7E6EF] bg-white shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="font-fraunces text-3xl text-[#2D2B55]">Log in</CardTitle>
            <p className="font-dm-sans text-sm text-[#5E5B86]">Loading form...</p>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
