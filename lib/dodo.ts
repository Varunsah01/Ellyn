import 'server-only'

import DodoPayments from "dodopayments";
import { requireServerEnv } from "@/lib/env";

let client: DodoPayments | null = null;

export function getDodoClient(): DodoPayments {
  if (!client) {
    client = new DodoPayments({
      bearerToken: requireServerEnv("DODO_PAYMENTS_API_KEY"),
      environment: (process.env.DODO_PAYMENTS_ENVIRONMENT as any) ?? "test_mode",
    });
  }

  return client;
}
