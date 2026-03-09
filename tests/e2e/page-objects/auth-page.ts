import { expect, type Page } from "@playwright/test";
import { BasePage } from "./base-page";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type SignupPayload = {
  fullName: string;
  email: string;
  password: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

export class AuthPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async gotoLogin(nextPath = "/dashboard/contacts"): Promise<void> {
    const next = encodeURIComponent(nextPath);
    await this.page.goto(`/auth/login?next=${next}`);
    await expect(
      this.page.getByRole("heading", { name: "Log in" }),
    ).toBeVisible();
  }

  async gotoSignup(nextPath = "/dashboard/contacts"): Promise<void> {
    const next = encodeURIComponent(nextPath);
    await this.page.goto(`/auth/signup?next=${next}`);
    await expect(
      this.page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
  }

  async signupNewUser(payload: SignupPayload): Promise<void> {
    await this.page.getByLabel("Full Name").fill(payload.fullName);
    await this.page.getByLabel("Email Address").fill(payload.email);
    await this.page.getByLabel("Password", { exact: true }).fill(payload.password);
    await this.page.getByLabel("Confirm Password").fill(payload.password);
    await this.page.getByRole("button", { name: "Create account" }).click();
  }

  async loginExistingUser(
    payload: LoginPayload,
    nextPath = "/dashboard/contacts",
  ): Promise<void> {
    await this.page.getByLabel("Email Address").fill(payload.email);
    await this.page.getByLabel("Password").fill(payload.password);
    await this.page.getByRole("button", { name: "Log in" }).click();
    await expect(this.page).toHaveURL(new RegExp(escapeRegex(nextPath)), {
      timeout: 30_000,
    });
  }

  async expectMessage(message: string): Promise<void> {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  async expectUrlContains(pathname: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(escapeRegex(pathname)));
  }
}
