import { execSync } from 'child_process';
import { existsSync, statSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
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
  const uploadFile = async (localPath, remotePath, fileName, maxRetries = 3) => {
    console.log(`  📤 Uploading ${fileName}...`);
    
    // First, try to remove existing file (use same format for rm)
    try {
      execSync(`supabase storage rm ${remotePath} --experimental --linked --yes`, { 
        stdio: 'ignore',
        encoding: 'utf-8'
      });
      console.log(`  ✓ Removed existing ${fileName}`);
      await sleep(1000); // Wait for deletion to process
    } catch (e) {
      // File might not exist, ignore error
    }
    
    // Try to upload with retry logic for network errors
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Capture stderr to check for errors
        const result = execSync(`supabase storage cp ${localPath} ${remotePath} --experimental --linked 2>&1`, { 
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });
        
        // Check if output contains error indicators
        if (result.includes('409') || result.includes('Duplicate') || result.includes('already exists') || result.includes('Error status')) {
          throw new Error(result);
        }
        
        // Check for network/connection errors
        if (result.includes('connection reset') || result.includes('read tcp') || result.includes('timeout') || result.includes('ECONNRESET')) {
          throw new Error(`Network error: ${result}`);
        }
        
        console.log(`  ✓ Uploaded ${fileName}${attempt > 1 ? ` (attempt ${attempt})` : ''}`);
        return; // Success!
      } catch (error) {
        const errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message || error.toString() || '';
        lastError = error;
        
        // Check for duplicate/409 error
        const isDuplicateError = 
          errorOutput.includes('409') || 
          errorOutput.includes('Duplicate') || 
          errorOutput.includes('already exists') ||
          errorOutput.includes('resource already exists') ||
          errorOutput.includes('Error status');
        
        // Check for network errors
        const isNetworkError = 
          errorOutput.includes('connection reset') || 
          errorOutput.includes('read tcp') || 
          errorOutput.includes('timeout') ||
          errorOutput.includes('ECONNRESET') ||
          errorOutput.includes('connection reset by peer');
        
        if (isDuplicateError && attempt < maxRetries) {
          console.log(`  ⚠️  ${fileName} already exists, force removing and retrying (attempt ${attempt + 1}/${maxRetries})...`);
          try {
            // Force remove the file
            execSync(`supabase storage rm ${remotePath} --experimental --linked --yes`, { 
              stdio: 'ignore',
              encoding: 'utf-8'
            });
            await sleep(2000 * attempt); // Longer delay on each retry
            continue; // Retry the upload
          } catch (rmError) {
            // If removal fails, still try to upload
            await sleep(1000);
            continue;
          }
        } else if (isNetworkError && attempt < maxRetries) {
          console.log(`  ⚠️  Network error, retrying (attempt ${attempt + 1}/${maxRetries})...`);
          await sleep(2000 * attempt); // Exponential backoff
          continue; // Retry the upload
        } else if (attempt < maxRetries) {
          // Other error, but we have retries left
          console.log(`  ⚠️  Upload failed, retrying (attempt ${attempt + 1}/${maxRetries})...`);
          await sleep(1000 * attempt);
          continue;
        } else {
          // No more retries
          throw new Error(`Failed to upload ${fileName} after ${maxRetries} attempts: ${errorOutput}`);
        }
      }
    }
    
    // Should never reach here, but just in case
    if (lastError) {
      throw lastError;
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
        // Generate accurate commit message based on changes
        const changedFiles = status.trim().split('\n').filter(f => f.trim());
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        
        // Get widget file sizes for reference
        let widgetInfo = '';
        try {
          const widgetJsStats = statSync(widgetJsPath);
          const widgetCssStats = statSync(widgetCssPath);
          widgetInfo = ` (widget.js: ${(widgetJsStats.size / 1024).toFixed(1)}KB, widget.css: ${(widgetCssStats.size / 1024).toFixed(1)}KB)`;
        } catch (e) {
          // Ignore if we can't get stats
        }
        
        // Categorize changes
        const widgetRelated = changedFiles.filter(f => 
          f.includes('widget') || f.includes('BotBuilder') || f.includes('ChatPlayground')
        );
        const configRelated = changedFiles.filter(f => 
          f.includes('config') || f.includes('package') || f.includes('.json')
        );
        const otherFiles = changedFiles.filter(f => 
          !widgetRelated.includes(f) && !configRelated.includes(f)
        );
        
        // Build descriptive commit message
        let commitMessage = `Deploy widget update to Supabase storage${widgetInfo}\n\n`;
        commitMessage += `Deployed at: ${timestamp}\n\n`;
        
        if (widgetRelated.length > 0) {
          commitMessage += `Widget-related changes:\n`;
          widgetRelated.forEach(f => commitMessage += `  - ${f}\n`);
          commitMessage += '\n';
        }
        
        if (configRelated.length > 0) {
          commitMessage += `Configuration changes:\n`;
          configRelated.forEach(f => commitMessage += `  - ${f}\n`);
          commitMessage += '\n';
        }
        
        if (otherFiles.length > 0) {
          commitMessage += `Other changes:\n`;
          otherFiles.slice(0, 10).forEach(f => commitMessage += `  - ${f}\n`);
          if (otherFiles.length > 10) {
            commitMessage += `  ... and ${otherFiles.length - 10} more file(s)\n`;
          }
        }
        
        commitMessage += '\nWidget files uploaded to Supabase storage (Assets/public)';
        
        // Write commit message to temporary file for safe handling of special characters
        const commitMsgFile = join(tmpdir(), `widget-deploy-commit-${Date.now()}.txt`);
        try {
          writeFileSync(commitMsgFile, commitMessage, 'utf-8');
          
          // Commit using the message file (more reliable for multi-line messages)
          execSync(`git commit -F "${commitMsgFile}"`, { stdio: 'inherit' });
          
          // Clean up temporary file
          unlinkSync(commitMsgFile);
        } catch (commitError) {
          // Clean up temporary file even on error
          try {
            unlinkSync(commitMsgFile);
          } catch (e) {
            // Ignore cleanup errors
          }
          throw commitError;
        }
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
