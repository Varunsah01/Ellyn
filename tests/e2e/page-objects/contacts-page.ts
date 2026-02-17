import { expect, type Download, type Page } from "@playwright/test";
import { BasePage } from "./base-page";

type ContactDetails = {
  name: string;
  title: string;
  company: string;
  email: string;
};

export class ContactsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto("/dashboard/contacts");
    await expect(
      this.page.getByRole("heading", { name: "Contacts" }),
    ).toBeVisible({ timeout: 30_000 });
  }

  async createContact(details: ContactDetails): Promise<void> {
    await this.page.getByRole("button", { name: "New Contact" }).click();
    await expect(this.page.getByText("New contact added.")).toBeVisible();
    await this.closeDetailDialogIfOpen();

    await this.editContact("New Contact", details);
  }

  async editContact(currentName: string, details: ContactDetails): Promise<void> {
    const row = this.contactRow(currentName);
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Edit contact" }).click();

    const dialog = this.page.locator('[role="dialog"]').first();
    await dialog.locator("#edit-contact-name").fill(details.name);
    await dialog.locator("#edit-contact-designation").fill(details.title);
    await dialog.locator("#edit-contact-company").fill(details.company);
    await dialog.locator("#edit-contact-email").fill(details.email);
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(this.page.getByText("Contact updated.").first()).toBeVisible();
    await expect(this.contactRow(details.name)).toBeVisible();
  }

  async searchContacts(query: string): Promise<void> {
    await this.page
      .getByPlaceholder("Search by name, company, title, or email")
      .fill(query);
  }

  async applyStatusFilter(statusLabel: "Draft" | "Sent" | "Opened/No response" | "Replied"): Promise<void> {
    await this.closeDetailDialogIfOpen();
    await this.page.getByRole("button", { name: "Open filters" }).click();
    await this.page.locator("label").filter({ hasText: statusLabel }).first().click();
    await expect(
      this.page.getByRole("button", { name: `Remove ${statusLabel} filter` }),
    ).toBeVisible();
  }

  async setPipelineStatus(contactName: string, stage: "Sent" | "Opened" | "Replied"): Promise<void> {
    const row = this.contactRow(contactName);
    await row.getByRole("button", { name: `Set stage to ${stage}` }).click();
    await this.closeDetailDialogIfOpen();
  }

  async deleteContact(contactName: string): Promise<void> {
    const row = this.contactRow(contactName);
    await row.getByRole("button", { name: "More options" }).click();
    await this.page.getByRole("menuitem", { name: "Delete Contact" }).click();
    await this.page.getByRole("button", { name: "Delete Contact" }).click();
    await expect(this.page.getByText("Contact deleted.")).toBeVisible();
  }

  async exportSelectedContact(contactName: string): Promise<Download> {
    await this.page.getByRole("checkbox", { name: `Select ${contactName}` }).click();
    const downloadPromise = this.page.waitForEvent("download");
    await this.page.getByRole("button", { name: "Export" }).click();
    return downloadPromise;
  }

  async expectContactVisible(contactName: string): Promise<void> {
    await expect(this.contactRow(contactName)).toBeVisible();
  }

  async expectContactNotVisible(contactName: string): Promise<void> {
    await expect(this.page.getByRole("row").filter({ hasText: contactName })).toHaveCount(0);
  }

  async expectNoResultsState(): Promise<void> {
    await expect(this.page.getByText("No contacts found")).toBeVisible();
  }

  private contactRow(contactName: string) {
    return this.page.getByRole("row").filter({ hasText: contactName }).first();
  }

  private async closeDetailDialogIfOpen(): Promise<void> {
    const closeButton = this.page
      .locator('[role="dialog"]')
      .getByRole("button", { name: "Close" })
      .first();

    const isVisible = await closeButton.isVisible().catch(() => false);
    if (!isVisible) return;

    await closeButton.click();
    await expect(this.page.locator('[role="dialog"]')).toHaveCount(0);
  }
}
