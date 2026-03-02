import DodoPayments from "dodopayments";

let client: DodoPayments | null = null;

export function getDodoClient(): DodoPayments {
  if (!client) {
    client = new DodoPayments({
      bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
      environment: (process.env.DODO_PAYMENTS_ENVIRONMENT as any) ?? "test_mode",
    });
  }

  return client;
}
