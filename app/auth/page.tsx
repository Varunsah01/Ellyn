import { redirect } from "next/navigation";

type AuthEntryPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function getSingleValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return value[0] || null;
  return null;
}

export default function AuthEntryPage({ searchParams }: AuthEntryPageProps) {
  const params = new URLSearchParams();

  const source = getSingleValue(searchParams?.source);
  const next = getSingleValue(searchParams?.next);
  const extensionId = getSingleValue(searchParams?.extensionId);

  if (source) {
    params.set("source", source);
  }

  if (next) {
    params.set("next", next);
  }

  if (extensionId) {
    params.set("extensionId", extensionId);
  }

  const queryString = params.toString();
  const target = queryString ? `/auth/login?${queryString}` : "/auth/login";
  redirect(target);
}
