const escoService = require('./services/escoService');

async function testAll() {
  console.log('=====================================================');
  console.log('TESTING ESCO SKILL AUTOCOMPLETE SEARCH ENDPOINT');
  console.log('=====================================================');

  const testQueries = [
    'py',
    'jav',
    'react',
    'node',
    'sql',
    'aws',
    'machine',
    'docker'
  ];

  for (const q of testQueries) {
    const start = Date.now();
    const results = await escoService.search(q, 8);
    const duration = Date.now() - start;

    console.log(`\n-----------------------------------------------------`);
    console.log(`Query: "${q}" (${results.length} results, ${duration}ms)`);
    console.log(`-----------------------------------------------------`);
    results.forEach((r, i) => {
      const aliasNote = r.matchedAlias ? ` (matched alias: "${r.matchedAlias}")` : '';
      console.log(`  ${i + 1}. ${r.name}`);
      console.log(`     Category: ${r.category}${aliasNote}`);
    });
  }

  console.log(`\n=====================================================`);
  console.log('TESTING DUPLICATE NORMALIZATION');
  console.log('=====================================================');
  const variations = ['React', 'React.js', 'React JS', 'ReactJS'];
  variations.forEach(v => {
    const canonical = escoService.getCanonical(v);
    console.log(`Variant: "${v}" -> Canonical Name: "${canonical?.canonicalName || canonical?.name}" [Category: ${canonical?.category}]`);
  });

  const nodeVariations = ['Node', 'Node.js', 'Node JS', 'NodeJS'];
  nodeVariations.forEach(v => {
    const canonical = escoService.getCanonical(v);
    console.log(`Variant: "${v}" -> Canonical Name: "${canonical?.canonicalName || canonical?.name}" [Category: ${canonical?.category}]`);
  });

  console.log(`\n=====================================================`);
  console.log('TESTING ERROR / EDGE CASE HANDLING');
  console.log('=====================================================');
  console.log('Empty query "":', await escoService.search(''));
  console.log('Whitespace query "   ":', await escoService.search('   '));
  console.log('Special characters "!@#$":', await escoService.search('!@#$'));
  console.log('Non-existent string "xyzqwe12345":', await escoService.search('xyzqwe12345'));

  console.log('\nAll tests completed successfully!');
}

testAll().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
