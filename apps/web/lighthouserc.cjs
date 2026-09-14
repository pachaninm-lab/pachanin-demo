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
        'categories:performance': ['error', { minScore: 0.85, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 0.95, aggregationMethod: 'median-run' }],
        'categories:best-practices': ['error', { minScore: 0.95, aggregationMethod: 'median-run' }],
        'categories:seo': ['error', { minScore: 0.95, aggregationMethod: 'median-run' }],
        'first-contentful-paint': ['error', { maxNumericValue: 2500, aggregationMethod: 'median-run' }],
        'largest-contentful-paint': ['error', { maxNumericValue: 3000, aggregationMethod: 'median-run' }],
        'total-blocking-time': ['error', { maxNumericValue: 300, aggregationMethod: 'median-run' }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.05, aggregationMethod: 'median-run' }],
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
