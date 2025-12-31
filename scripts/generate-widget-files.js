import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateWidgetCSS } from '../components/widgetStyles.ts';
import { generateWidgetJS } from '../components/widgetScript.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

// Create public directory if it doesn't exist
try {
  mkdirSync(publicDir, { recursive: true });
} catch (error) {
  // Directory might already exist, ignore error
  if (error.code !== 'EEXIST') {
    throw error;
  }
}

// Generate CSS file
const cssContent = generateWidgetCSS();
writeFileSync(join(publicDir, 'widget.css'), cssContent, 'utf-8');
console.log('✓ Generated public/widget.css');

// Generate JS file
const jsContent = generateWidgetJS();
writeFileSync(join(publicDir, 'widget.js'), jsContent, 'utf-8');
console.log('✓ Generated public/widget.js');

console.log('✓ Widget files generated successfully!');

