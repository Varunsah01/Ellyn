import { expect, test } from "@playwright/test";
import { AuthPage } from "./page-objects/auth-page";
import { ContactsPage } from "./page-objects/contacts-page";
import { mockDashboardApis, mockSupabaseSignIn } from "./support/mocks";
import { buildContactName, buildTestUser, uniqueSuffix } from "./support/test-data";

test.describe("Contact management", () => {
  test.describe.configure({ mode: "parallel" });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name.toLowerCase().includes("mobile"),
      "Contact workspace E2E coverage runs on desktop layouts.",
    );

    const authPage = new AuthPage(page);
    const user = buildTestUser("contacts");

    await authPage.initializeClientState();
    await mockSupabaseSignIn(page, { email: user.email, fullName: user.name });
    await mockDashboardApis(page);

    await authPage.gotoLogin("/dashboard/contacts");
    await authPage.loginExistingUser({ email: user.email, password: user.password });
  });

  test.afterEach(async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.cleanupClientState();
  });

  test("creates a contact", async ({ page }) => {
    const contactsPage = new ContactsPage(page);
    const contactName = buildContactName("create");

    await contactsPage.goto();
    await contactsPage.createContact({
      name: contactName,
      title: "Software Engineer",
      company: "Acme Labs",
      email: `${uniqueSuffix("create")}@acme.com`,
    });

    await contactsPage.expectContactVisible(contactName);
  });

  test("searches contacts", async ({ page }) => {
    const contactsPage = new ContactsPage(page);
    const contactName = buildContactName("search");

    await contactsPage.goto();
    await contactsPage.createContact({
      name: contactName,
      title: "Engineering Manager",
      company: "Globex",
      email: `${uniqueSuffix("search")}@globex.com`,
    });

    await contactsPage.searchContacts(contactName);
    await contactsPage.expectContactVisible(contactName);
  });

  test("filters contacts", async ({ page }) => {
    const contactsPage = new ContactsPage(page);
    const contactName = buildContactName("filter");

    await contactsPage.goto();
    await contactsPage.createContact({
      name: contactName,
      title: "Product Designer",
      company: "Initech",
      email: `${uniqueSuffix("filter")}@initech.com`,
    });

    await contactsPage.setPipelineStatus(contactName, "Sent");
    await contactsPage.applyStatusFilter("Sent");
    await contactsPage.expectContactVisible(contactName);
  });

  test("updates a contact", async ({ page }) => {
    const contactsPage = new ContactsPage(page);
    const originalName = buildContactName("update-original");
    const updatedName = buildContactName("update-new");

    await contactsPage.goto();
    await contactsPage.createContact({
      name: originalName,
      title: "Backend Engineer",
      company: "Hooli",
      email: `${uniqueSuffix("update")}@hooli.com`,
    });

    await contactsPage.editContact(originalName, {
      name: updatedName,
      title: "Staff Backend Engineer",
      company: "Hooli",
      email: `${uniqueSuffix("update2")}@hooli.com`,
    });

    await contactsPage.searchContacts(updatedName);
    await contactsPage.expectContactVisible(updatedName);

    await contactsPage.searchContacts(originalName);
    await contactsPage.expectNoResultsState();
  });

  test("deletes a contact", async ({ page }) => {
    const contactsPage = new ContactsPage(page);
    const contactName = buildContactName("delete");

    await contactsPage.goto();
    await contactsPage.createContact({
      name: contactName,
      title: "Sales Engineer",
      company: "Pied Piper",
      email: `${uniqueSuffix("delete")}@piedpiper.com`,
    });

    await contactsPage.deleteContact(contactName);
    await contactsPage.searchContacts(contactName);
    await contactsPage.expectNoResultsState();
  });

  test("exports contacts", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Download assertions are verified in Chromium.");

    const contactsPage = new ContactsPage(page);
    const contactName = buildContactName("export");

    await contactsPage.goto();
    await contactsPage.createContact({
      name: contactName,
      title: "DevRel Engineer",
      company: "Umbrella",
      email: `${uniqueSuffix("export")}@umbrella.com`,
    });

    const download = await contactsPage.exportSelectedContact(contactName);
    expect(download.suggestedFilename()).toContain("ellyn-contacts-selected-");
    expect(download.suggestedFilename()).toContain(".csv");
  });
});

