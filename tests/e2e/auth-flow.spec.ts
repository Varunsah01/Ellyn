import { expect, test } from "@playwright/test";
import { AuthPage } from "./page-objects/auth-page";
import { DashboardPage } from "./page-objects/dashboard-page";
import {
  mockDashboardApis,
  mockPasswordChangeApi,
  mockSignupApi,
  mockSupabaseSignIn,
} from "./support/mocks";
import { buildTestUser } from "./support/test-data";

test.describe("Authentication flow", () => {
  test.describe.configure({ mode: "parallel" });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name.toLowerCase().includes("mobile"),
      "Authentication flow is validated on desktop layouts.",
    );

    const authPage = new AuthPage(page);
    await authPage.initializeClientState();
    await mockSupabaseSignIn(page);
    await mockDashboardApis(page);
  });

  test.afterEach(async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.cleanupClientState();
  });

  test("signs up a new user", async ({ page }) => {
    const authPage = new AuthPage(page);
    const user = buildTestUser("signup");

    await mockSignupApi(page);
    await authPage.gotoSignup("/dashboard/contacts");
    await authPage.signupNewUser({
      fullName: user.name,
      email: user.email,
      password: user.password,
    });

    await expect(page).toHaveURL(/\/dashboard\/contacts(?:\?.*)?$/, {
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "Contacts" })).toBeVisible();
  });

  test("logs in an existing user", async ({ page }) => {
    const authPage = new AuthPage(page);
    const user = buildTestUser("login");

    await authPage.gotoLogin("/dashboard/contacts");
    await authPage.loginExistingUser({
      email: user.email,
      password: user.password,
    });

    await expect(page.getByRole("heading", { name: "Contacts" })).toBeVisible();
  });

  test("runs password reset flow from settings", async ({ page }) => {
    const authPage = new AuthPage(page);
    const dashboardPage = new DashboardPage(page);
    const user = buildTestUser("password");

    await mockPasswordChangeApi(page);
    await authPage.gotoLogin("/dashboard/settings");
    await authPage.loginExistingUser(
      {
        email: user.email,
        password: user.password,
      },
      "/dashboard/settings",
    );

    await dashboardPage.updatePassword(user.password, "NewPassword123!");
    await authPage.expectMessage("Password updated successfully.");
  });

  test("keeps the session after page reload", async ({ page }) => {
    const authPage = new AuthPage(page);
    const user = buildTestUser("session");

    await authPage.gotoLogin("/dashboard/contacts");
    await authPage.loginExistingUser({
      email: user.email,
      password: user.password,
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/contacts/);
    await expect(page.getByText("Checking your session...")).toHaveCount(0, {
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "Contacts" })).toBeVisible({
      timeout: 30_000,
    });
  });
});
