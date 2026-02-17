import { expect, test } from "@playwright/test";
import { AuthPage } from "./page-objects/auth-page";
import { DiscoveryPage } from "./page-objects/discovery-page";
import { mockDashboardApis, mockDiscoveryApis, mockSupabaseSignIn } from "./support/mocks";
import { buildTestUser } from "./support/test-data";

test.describe("Email discovery", () => {
  test.describe.configure({ mode: "parallel" });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name.toLowerCase().includes("mobile"),
      "Discovery flow is validated on desktop layouts.",
    );

    const authPage = new AuthPage(page);
    const user = buildTestUser("discovery");

    await authPage.initializeClientState();
    await mockSupabaseSignIn(page, { email: user.email, fullName: user.name });
    await mockDashboardApis(page);
    await mockDiscoveryApis(page);

    await authPage.gotoLogin("/dashboard/discovery");
    await authPage.loginExistingUser(
      { email: user.email, password: user.password },
      "/dashboard/discovery",
    );
  });

  test.afterEach(async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.cleanupClientState();
  });

  test("discovers emails for a contact", async ({ page }) => {
    const discoveryPage = new DiscoveryPage(page);

    await discoveryPage.goto();
    await discoveryPage.discoverEmails({
      firstName: "John",
      lastName: "Doe",
      company: "Microsoft",
      role: "Senior Engineer",
    });

    await expect(page.getByText("Email Patterns (3)")).toBeVisible();
    await expect(page.getByText("john.doe@microsoft.com")).toBeVisible();
  });

  test("selects an email pattern", async ({ page }) => {
    const discoveryPage = new DiscoveryPage(page);

    await discoveryPage.goto();
    await discoveryPage.discoverEmails({
      firstName: "John",
      lastName: "Doe",
      company: "Microsoft",
    });
    await discoveryPage.selectPattern("john.doe@microsoft.com");

    await expect(page.getByRole("button", { name: "Save as Lead" })).toBeVisible();
  });

  test("saves discovered result as a lead", async ({ page }) => {
    const discoveryPage = new DiscoveryPage(page);

    await discoveryPage.goto();
    await discoveryPage.discoverEmails({
      firstName: "John",
      lastName: "Doe",
      company: "Microsoft",
    });
    await discoveryPage.selectPattern("john.doe@microsoft.com");
    await discoveryPage.saveAsLead();
    await discoveryPage.openLeadsTab();

    await discoveryPage.expectLeadVisible("John Doe");
  });

  test("shows confidence scores for discovered patterns", async ({ page }) => {
    const discoveryPage = new DiscoveryPage(page);

    await discoveryPage.goto();
    await discoveryPage.discoverEmails({
      firstName: "John",
      lastName: "Doe",
      company: "Microsoft",
    });

    await discoveryPage.expectConfidenceScore("88%");
    await discoveryPage.expectConfidenceScore("71%");
    await discoveryPage.expectConfidenceScore("55%");
  });
});

