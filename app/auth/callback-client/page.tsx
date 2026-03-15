"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthPageLoading } from "@/components/auth/AuthFormLayout";

function AuthCallbackClientContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    router.replace(query ? `/auth/callback?${query}` : "/auth/callback");
  }, [router, searchParams]);

  return <AuthPageLoading text="Redirecting to secure callback..." />;
}

export default function AuthCallbackClientPage() {
  return (
    <Suspense fallback={<AuthPageLoading text="Redirecting to secure callback..." />}>
      <AuthCallbackClientContent />
    </Suspense>
  );
}
