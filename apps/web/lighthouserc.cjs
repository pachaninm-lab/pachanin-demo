const mode = process.env.LHCI_FORM_FACTOR === 'desktop' ? 'desktop' : 'mobile';
const isDesktop = mode === 'desktop';

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm start',
      startServerReadyPattern: 'Ready in',
      startServerReadyTimeout: 120_000,
      url: ['http://127.0.0.1:3000/platform-v7?lang=ru'],
      numberOfRuns: 3,
      settings: {
        ...(isDesktop ? { preset: 'desktop' } : {}),
        chromeFlags: '--headless=new --no-sandbox --disable-dev-shm-usage',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      assertions: {
        // Assert each audit against the statistical median of all three runs.
        // `median-run` can select one globally representative run whose individual
        // audit is a runner outlier; `median` keeps the same thresholds without
        // allowing one noisy shared-CI sample to fail an otherwise stable result.
        'categories:performance': ['error', { minScore: 0.85, aggregationMethod: 'median' }],
        'categories:accessibility': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
        'categories:best-practices': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
        'categories:seo': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
        'first-contentful-paint': ['error', { maxNumericValue: 2500, aggregationMethod: 'median' }],
        'largest-contentful-paint': ['error', { maxNumericValue: 3000, aggregationMethod: 'median' }],
        'total-blocking-time': ['error', { maxNumericValue: 300, aggregationMethod: 'median' }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.05, aggregationMethod: 'median' }],
        'document-title': 'error',
        'meta-description': 'error',
        'html-has-lang': 'error',
        'viewport': 'error',
        'is-crawlable': 'error',
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: `./lighthouseci-artifacts/${mode}`,
      reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%.%%EXTENSION%%',
    },
  },
};
