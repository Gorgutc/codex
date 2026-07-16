module.exports = {
  ci: {
    collect: {
      staticDistDir: '.',
      url: [
        'http://localhost/index.html',
        'http://localhost/free-assets.html',
        'http://localhost/index.html?design=specimen&lang=en',
        'http://localhost/index.html?design=specimen&lang=en#orbital-mk-ii',
        'http://localhost/free-assets.html?design=specimen&lang=en',
        'http://localhost/index.html?design=chamber&lang=en',
        'http://localhost/index.html?design=chamber&lang=en#orbital-mk-ii',
        'http://localhost/free-assets.html?design=chamber&lang=en',
        'http://localhost/index.html?design=hybrid&lang=en',
        'http://localhost/index.html?design=hybrid&lang=en#orbital-mk-ii',
        'http://localhost/free-assets.html?design=hybrid&lang=en'
      ],
      numberOfRuns: 1,
      settings: {
        chromeFlags: '--headless=new --no-sandbox --disable-dev-shm-usage'
      }
    },
    assert: {
      assertions: {
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.85 }],
        'categories:performance': ['warn', { minScore: 0.55 }],
        'categories:seo': ['warn', { minScore: 0.9 }]
      }
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci'
    }
  }
};
