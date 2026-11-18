import { test, expect } from '@playwright/test';

test.describe('Right Here, Right Now E2E', () => {
  test('has title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Right Here, Right Now/);
  });

  test('header loads properly', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header');
    await expect(header).toBeVisible();
    await expect(header.locator('h1')).toHaveText('Right Here, Right Now.');
  });

  test('navigation filters exist and work', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav[aria-label="Category filters"]');
    await expect(nav).toBeVisible();

    // The All link should be active on the homepage
    const allLink = nav.getByRole('link', { name: 'All' });
    await expect(allLink).toBeVisible();
    await expect(allLink).toHaveAttribute('aria-current', 'page');
  });

  test('renders widgets on homepage', async ({ page }) => {
    await page.goto('/');
    // The grid should render widgets
    const gridContainer = page.locator('.columns-1');
    await expect(gridContainer).toBeVisible();

    // Check that we have at least one widget card
    const widgetCard = page.locator('.rounded-xl.border');
    await expect(widgetCard.first()).toBeVisible();
  });

  test('navigates to a specific category and shows widgets', async ({ page }) => {
    await page.goto('/');

    // Click on the 'Sports' filter
    const sportsLink = page.locator('nav[aria-label="Category filters"]').getByRole('link', { name: 'Sports' });
    await sportsLink.click();

    // Verify URL changed
    await expect(page).toHaveURL(/.*\/sports/);

    // Should still have grid container
    const gridContainer = page.locator('.columns-1');
    await expect(gridContainer).toBeVisible();

    // Check that we have widget cards
    const widgetCard = page.locator('.rounded-xl.border');
    await expect(widgetCard.first()).toBeVisible();
  });

  for (const [path, title] of [
    ['/entertainment', 'US Billboard Hot 100'],
    ['/video-games', 'Most Played Steam Games (Live)'],
    ['/business-tech', 'Trending Cryptocurrencies'],
  ]) {
    test(`${path} shows its widgets`, async ({ page }) => {
      await page.goto(path);

      await expect(page.locator('.columns-1')).toBeVisible();
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
      await expect(page.locator('text=No widgets yet')).not.toBeVisible();
    });
  }
});
