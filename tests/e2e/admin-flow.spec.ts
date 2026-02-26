import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@formativecrm.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Password123';

async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
}

test('admin can log in and view dashboard', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
});

test('admin can open lead detail from dashboard', async ({ page }) => {
  await signIn(page);
  const firstLeadLink = page.locator('tbody tr td a').first();
  await expect(firstLeadLink).toBeVisible();
  await firstLeadLink.click();
  await expect(page).toHaveURL(/\/admin\/leads\//);
  await expect(page.getByRole('heading', { name: 'Lead Metadata' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Score Breakdown' })).toBeVisible();
});

test('admin can open logs page', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Error Logs' }).click();
  await expect(page).toHaveURL(/\/admin\/logs/);
  await expect(page.getByRole('heading', { name: 'System Logs' })).toBeVisible();
});
