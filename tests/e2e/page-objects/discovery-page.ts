import { expect, type Page } from "@playwright/test";
import { BasePage } from "./base-page";

type DiscoveryInput = {
  firstName: string;
  lastName: string;
  company: string;
  role?: string;
};

export class DiscoveryPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto("/dashboard/discovery");
    await expect(this.page.getByRole("heading", { name: "Discovery" })).toBeVisible();
  }

  async discoverEmails(input: DiscoveryInput): Promise<void> {
    await this.page.getByPlaceholder("John").fill(input.firstName);
    await this.page.getByPlaceholder("Doe").fill(input.lastName);
    await this.page.getByPlaceholder("Microsoft").fill(input.company);
    if (input.role) {
      await this.page.getByPlaceholder("Senior Engineer").fill(input.role);
    }

    await this.page.getByRole("button", { name: "Discover Email Patterns" }).click();
    await expect(this.page.getByText(/Found \d+ email patterns/i)).toBeVisible();
  }

  async selectPattern(email: string): Promise<void> {
    const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await this.page.getByRole("button", { name: new RegExp(escapedEmail, "i") }).click();
    await expect(this.page.getByRole("button", { name: "Save as Lead" })).toBeVisible();
  }

  async saveAsLead(): Promise<void> {
    await this.page.getByRole("button", { name: "Save as Lead" }).click();
    await expect(this.page.getByText("Lead saved successfully!")).toBeVisible();
  }

  async openLeadsTab(): Promise<void> {
    await this.page.getByRole("tab", { name: "Leads" }).click();
    await expect(this.page.getByRole("heading", { name: "Saved Leads" })).toBeVisible();
  }

  async expectLeadVisible(name: string): Promise<void> {
    await expect(this.page.getByRole("row").filter({ hasText: name })).toBeVisible();
  }

  async expectConfidenceScore(value: string): Promise<void> {
    await expect(this.page.getByText(value, { exact: false })).toBeVisible();
  }
}
