import type { Page } from "@playwright/test";

const ONBOARDING_COMPLETE_STATE = {
  step: 1,
  completed: true,
  dismissed: true,
  tourPending: false,
  tourCompleted: true,
  tourDismissed: true,
};

export async function primeClientState(page: Page): Promise<void> {
  await page.addInitScript((state) => {
    window.localStorage.setItem("ellyn:onboarding", JSON.stringify(state));
  }, ONBOARDING_COMPLETE_STATE);
}

export async function clearClientState(page: Page): Promise<void> {
  const url = page.url();
  if (!/^https?:/i.test(url)) {
    return;
  }

  try {
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  } catch {
    // Some browsers/security contexts can block storage access during teardown.
  }
}
