import fs from 'fs';
import path from 'path';

const lines = ['email,id,group'];
for (let i = 1; i <= 1000; i++) {
  lines.push(`stress_lead_${i}@reachinbox-loadtest.org,${i},batch1`);
}

fs.writeFileSync(path.resolve(process.cwd(), 'load-test-1000.csv'), lines.join('\n'));
console.log('Generated load-test-1000.csv with 1,000 recipient records');
