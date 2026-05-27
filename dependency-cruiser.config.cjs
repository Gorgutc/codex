module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Classic scripts should stay acyclic when imports are introduced.',
      from: {},
      to: {
        circular: true
      }
    },
    {
      name: 'no-node-modules-in-shipped-js',
      severity: 'error',
      comment: 'The shipped site is vanilla static JS and must not import npm runtime packages.',
      from: {
        path: '^js/(?!vendor/)'
      },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer']
      }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules|js/vendor'
    },
    enhancedResolveOptions: {
      extensions: ['.js', '.mjs']
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+'
      }
    }
  }
};
