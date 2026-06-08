const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const projectRoot = path.resolve(__dirname);

const ENV_FILES = ['.env.local', '.env', 'env'];

for (const fileName of ENV_FILES) {
  const filePath = path.join(projectRoot, fileName);
  if (!fs.existsSync(filePath)) continue;
  dotenv.config({ path: filePath, override: false });
}

module.exports = { projectRoot, ENV_FILES };
