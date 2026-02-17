import type { Page } from "@playwright/test";
import { clearClientState, primeClientState } from "../support/app-state";

export class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async initializeClientState(): Promise<void> {
    await primeClientState(this.page);
  }

  async cleanupClientState(): Promise<void> {
    await clearClientState(this.page);
  }
}

