import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

// Helper function to sleep/delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function deployWidget() {
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

  // Helper function to upload a file with retry logic
  const uploadFile = async (localPath, remotePath, fileName) => {
    console.log(`  📤 Uploading ${fileName}...`);
    
    // First, try to remove existing file (use same format for rm)
    try {
      execSync(`supabase storage rm ${remotePath} --experimental --linked --yes`, { 
        stdio: 'ignore',
        encoding: 'utf-8'
      });
      console.log(`  ✓ Removed existing ${fileName}`);
    } catch (e) {
      // File might not exist, ignore error
    }
    
    // Small delay to ensure deletion is processed
    await sleep(1000);
    
    // Try to upload
    try {
      execSync(`supabase storage cp ${localPath} ${remotePath} --experimental --linked`, { 
        stdio: 'inherit',
        encoding: 'utf-8'
      });
      console.log(`  ✓ Uploaded ${fileName}`);
    } catch (error) {
      // Check for duplicate/409 error in various error properties
      const errorOutput = error.stderr?.toString() || error.stdout?.toString() || error.message || error.toString() || '';
      const isDuplicateError = 
        errorOutput.includes('409') || 
        errorOutput.includes('Duplicate') || 
        errorOutput.includes('already exists') ||
        errorOutput.includes('resource already exists');
      
      if (isDuplicateError) {
        console.log(`  ⚠️  ${fileName} already exists, removing and retrying...`);
        try {
          // Force remove the file
          execSync(`supabase storage rm ${remotePath} --experimental --linked --yes`, { 
            stdio: 'ignore',
            encoding: 'utf-8'
          });
          await sleep(1500); // Longer delay to ensure deletion is processed
          
          // Try upload again
          execSync(`supabase storage cp ${localPath} ${remotePath} --experimental --linked`, { 
            stdio: 'inherit',
            encoding: 'utf-8'
          });
          console.log(`  ✓ Uploaded ${fileName} (after retry)`);
        } catch (retryError) {
          const retryErrorOutput = retryError.stderr?.toString() || retryError.stdout?.toString() || retryError.message || retryError.toString() || '';
          throw new Error(`Failed to upload ${fileName} after retry: ${retryErrorOutput}`);
        }
      } else {
        // Not a duplicate error, re-throw
        const errorOutput = error.stderr?.toString() || error.stdout?.toString() || error.message || error.toString() || '';
        throw new Error(`Failed to upload ${fileName}: ${errorOutput}`);
      }
    }
  };

  try {
    // Upload files - use ss:/// format for remote paths
    await uploadFile('public/widget.js', 'ss:///Assets/public/widget.js', 'widget.js');
    await uploadFile('public/widget.css', 'ss:///Assets/public/widget.css', 'widget.css');
    
    console.log('✅ Files uploaded to Supabase storage\n');
  } catch (error) {
    console.error('❌ Error uploading to Supabase storage:', error.message);
    console.error('   Make sure you are logged in: supabase login');
    console.error('   And linked to your project: supabase link');
    console.error('   And that the Assets bucket exists in your Supabase project');
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
}

// Run the deployment
deployWidget().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
