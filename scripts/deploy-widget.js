import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

console.log('🚀 Starting widget deployment process...\n');

// Step 1: Generate widget files
console.log('📦 Step 1: Generating widget files...');
try {
  execSync('npm run generate-widget', { stdio: 'inherit' });
  console.log('✅ Widget files generated successfully\n');
} catch (error) {
  console.error('❌ Error generating widget files:', error.message);
  process.exit(1);
}

// Step 2: Check if files were generated
const widgetJsPath = join(publicDir, 'widget.js');
const widgetCssPath = join(publicDir, 'widget.css');

if (!existsSync(widgetJsPath) || !existsSync(widgetCssPath)) {
  console.error('❌ Error: Widget files were not generated');
  process.exit(1);
}

// Step 3: Upload to Supabase storage
console.log('☁️  Step 2: Uploading to Supabase storage...');

// Check if Supabase CLI is installed
try {
  execSync('supabase --version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ Supabase CLI not found. Please install it first:');
  console.error('   npm install -g supabase');
  process.exit(1);
}

try {
  // Upload widget.js
  console.log('  📤 Uploading widget.js...');
  execSync('supabase storage cp public/widget.js Assets/public/widget.js --experimental --linked', { stdio: 'inherit' });
  
  // Upload widget.css
  console.log('  📤 Uploading widget.css...');
  execSync('supabase storage cp public/widget.css Assets/public/widget.css --experimental --linked', { stdio: 'inherit' });
  
  console.log('✅ Files uploaded to Supabase storage\n');
} catch (error) {
  console.error('❌ Error uploading to Supabase storage:', error.message);
  console.error('   Make sure you are logged in: supabase login');
  console.error('   And linked to your project: supabase link');
  process.exit(1);
}

// Step 4: Push to GitHub (excluding public folder)
console.log('📤 Step 3: Pushing to GitHub...');

try {
  // Stage all files except public folder
  execSync('git add -A', { stdio: 'inherit' });
  execSync('git reset -- public/', { stdio: 'inherit' });
  
  // Check if there are changes to commit
  try {
    const status = execSync('git diff --staged --name-only', { encoding: 'utf-8' });
    if (status.trim()) {
      execSync('git commit -m "Update widget files and deploy to Supabase storage"', { stdio: 'inherit' });
      execSync('git push', { stdio: 'inherit' });
      console.log('✅ Changes pushed to GitHub\n');
    } else {
      console.log('ℹ️  No changes to commit (widget files are in .gitignore)\n');
    }
  } catch (error) {
    // No changes to commit
    console.log('ℹ️  No changes to commit\n');
  }
} catch (error) {
  console.error('❌ Error pushing to GitHub:', error.message);
  console.error('   Make sure you have git configured and remote set up');
  process.exit(1);
}

console.log('🎉 Deployment complete!');
console.log('');
console.log('Summary:');
console.log('  ✅ Widget files generated');
console.log('  ✅ Files uploaded to Supabase storage (Assets/public)');
console.log('  ✅ Code pushed to GitHub for Netlify deployment');

