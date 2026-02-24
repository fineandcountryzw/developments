import * as puppeteer from 'puppeteer';

const baseUrl = process.env.E2E_BASE_URL;

const describeOrSkip = baseUrl ? describe : describe.skip;

describeOrSkip('E2E Smoke', () => {
  it('loads the landing page', async () => {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.goto(baseUrl!, { waitUntil: 'domcontentloaded' });

      const title = await page.title();
      expect(title).toMatch(/Fine & Country/i);
    } finally {
      await browser.close();
    }
  }, 60_000);
});
