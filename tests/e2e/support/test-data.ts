export interface TestUser {
  name: string;
  email: string;
  password: string;
}

function randomPart(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function uniqueSuffix(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${randomPart()}`;
}

export function buildTestUser(prefix = "user"): TestUser {
  const suffix = uniqueSuffix(prefix);
  return {
    name: `Test ${suffix}`,
    email: `${suffix}@example.com`,
    password: "Password123!",
  };
}

export function buildContactName(prefix = "contact"): string {
  return `Contact ${uniqueSuffix(prefix)}`;
}

