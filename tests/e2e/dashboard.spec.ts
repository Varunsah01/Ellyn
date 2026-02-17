import { expect, test } from "@playwright/test";
import { AuthPage } from "./page-objects/auth-page";
import { DashboardPage } from "./page-objects/dashboard-page";
import {
  mockAnalyticsApis,
  mockDashboardApis,
  mockSupabaseSignIn,
} from "./support/mocks";
import { buildTestUser, uniqueSuffix } from "./support/test-data";

test.describe("Dashboard", () => {
  test.describe.configure({ mode: "parallel" });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name.toLowerCase().includes("mobile"),
      "Dashboard flow is validated on desktop layouts.",
    );

    const authPage = new AuthPage(page);
    const user = buildTestUser("dashboard");

    await authPage.initializeClientState();
    await mockSupabaseSignIn(page, { email: user.email, fullName: user.name });
    await mockDashboardApis(page);
    await mockAnalyticsApis(page);

    await authPage.gotoLogin("/dashboard");
    await authPage.loginExistingUser(
      { email: user.email, password: user.password },
      "/dashboard",
    );
  });

  test.afterEach(async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.cleanupClientState();
  });

  test("navigates between dashboard tabs", async ({ page }) => {
    const dashboardPage = new DashboardPage(page);

    await dashboardPage.goto();
    await dashboardPage.navigateUsingSidebar("Contacts");
    await expect(page.getByRole("heading", { name: "Contacts", exact: true })).toBeVisible();

    await dashboardPage.navigateUsingSidebar("Templates");
    await expect(page.getByRole("heading", { name: "Templates", exact: true })).toBeVisible();

    await dashboardPage.navigateUsingSidebar("Dashboard");
    await expect(
      page.getByRole("heading", { name: /Good morning|Good afternoon|Good evening/i }),
    ).toBeVisible();
  });

  test("views analytics", async ({ page }) => {
    const dashboardPage = new DashboardPage(page);

    await dashboardPage.gotoAnalytics();
    await dashboardPage.expectAnalyticsOverview();

    await dashboardPage.openAnalyticsTab("Sequences");
    await dashboardPage.expectSequencesTabContent();

    await dashboardPage.openAnalyticsTab("Contacts");
    await dashboardPage.expectContactsTabContent();

    await dashboardPage.openAnalyticsTab("Activity");
    await dashboardPage.expectActivityTabContent();
  });

  test("updates settings", async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    const nextName = `Updated-${uniqueSuffix("settings")}`;

    await dashboardPage.gotoSettings();
    await dashboardPage.updateProfileFirstName(nextName);
    await expect(page.locator("#firstName")).toHaveValue(nextName);
  });
});
