import { expect, type Page } from "@playwright/test";
import { BasePage } from "./base-page";

export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      this.page.getByRole("heading", { name: /Good morning|Good afternoon|Good evening/i }),
    ).toBeVisible({ timeout: 30_000 });
  }

  async navigateUsingSidebar(label: "Dashboard" | "Contacts" | "Templates"): Promise<void> {
    const sidebarLinkName =
      label === "Contacts" ? /^Contacts\b/i : label === "Templates" ? /^Templates\b/i : /^Dashboard\b/i;
    await this.page
      .getByRole("complementary")
      .getByRole("link", { name: sidebarLinkName })
      .first()
      .click();
    await expect(this.page).toHaveURL(
      new RegExp(`/dashboard${label === "Dashboard" ? "$" : `/${label.toLowerCase()}`}`),
      { timeout: 30_000 },
    );
  }

  async gotoAnalytics(): Promise<void> {
    await this.page.goto("/dashboard/analytics", { waitUntil: "domcontentloaded" });
    await expect(this.page.getByRole("heading", { name: "Analytics" })).toBeVisible({
      timeout: 30_000,
    });
  }

  async openAnalyticsTab(tab: "Overview" | "Sequences" | "Contacts" | "Activity"): Promise<void> {
    await this.page.getByRole("tab", { name: tab }).click();
  }

  async expectAnalyticsOverview(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: "Total Contacts", exact: true })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Reply Rate", exact: true })).toBeVisible();
  }

  async expectSequencesTabContent(): Promise<void> {
    await expect(this.page.getByText("Sequence Performance")).toBeVisible();
  }

  async expectContactsTabContent(): Promise<void> {
    await expect(this.page.getByText("Top Companies")).toBeVisible();
  }

  async expectActivityTabContent(): Promise<void> {
    await expect(this.page.getByText("Activity Heatmap")).toBeVisible();
  }

  async gotoSettings(): Promise<void> {
    await this.page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });
    await expect(this.page.getByRole("heading", { name: "Settings" })).toBeVisible({
      timeout: 30_000,
    });
  }

  async updateProfileFirstName(name: string): Promise<void> {
    await this.page.getByRole("tab", { name: "Profile" }).click();
    await this.page.locator("#firstName").fill(name);
    const saveButton = this.page.getByRole("button", { name: "Save Changes" }).first();
    await saveButton.click();
    await expect(this.page.getByRole("button", { name: "Saving..." })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Saving..." })).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(saveButton).toBeVisible();
  }

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.page.getByRole("tab", { name: "Privacy" }).click();
    await this.page.locator("#currentPassword").fill(currentPassword);
    await this.page.locator("#newPassword").fill(newPassword);
    await this.page.locator("#confirmNewPassword").fill(newPassword);
    await this.page.getByRole("button", { name: "Update Password" }).click();
  }
}
