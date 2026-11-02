import { test, expect } from '@playwright/test';

test('登录页可渲染并在登录/注册之间切换', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /问田/ })).toBeVisible();
  await expect(page.locator('input[name="username"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();

  await page.getByRole('button', { name: '立即注册' }).click();
  await expect(page.getByRole('heading', { name: /注册账号/ })).toBeVisible();
  await expect(page.locator('input[name="confirm-password"]')).toBeVisible();

  await page.getByRole('button', { name: '立即登录' }).click();
  await expect(page.getByRole('heading', { name: /问田/ })).toBeVisible();
});

test('注册时两次密码不一致会给出提示', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '立即注册' }).click();

  await page.locator('input[name="username"]').fill('e2e-smoke');
  await page.locator('input[name="new-password"]').fill('smoke123');
  await page.locator('input[name="confirm-password"]').fill('smoke456');
  await page.getByRole('button', { name: /注\s*册/ }).click();

  await expect(page.getByRole('alert')).toContainText('两次输入的密码不一致');
});