import { test, expect } from '@playwright/test';

test('app sirve página de login', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveURL(/\/(login|acceso)/);
});
