# Firebase Hosting Setup Guide

This guide will help you set up Firebase Hosting deployment for the GlennEHS website.

## Overview

The GlennEHS website is configured to automatically deploy to Firebase Hosting whenever changes are pushed to the `main` branch. The site is hosted at:

**🌐 https://glenn-ehs-website.firebaseapp.com/**

## Prerequisites

- Node.js installed on your local machine (v14 or higher)
- Access to the Firebase project: `glenn-ehs-website`
- Admin access to this GitHub repository

## Initial Setup

### Step 1: Install Firebase Tools

Open your terminal and install the Firebase CLI globally:

```bash
npm install -g firebase-tools
```

### Step 2: Generate a Firebase Token

1. Run the following command in your terminal:

```bash
firebase login:ci
```

2. This will open a browser window asking you to sign in to your Google account
3. Sign in with the account that has access to the `glenn-ehs-website` Firebase project
4. Grant the necessary permissions when prompted
5. After successful authentication, the terminal will display a token like:
   ```
   ✔  Success! Use this token to login on a CI server:
   
   1//0abc123def456ghi789jkl0mnopqr...
   ```
6. **Copy this entire token** - you'll need it in the next step

### Step 3: Add Token to GitHub Secrets

1. Go to your repository on GitHub: https://github.com/Gurutej11-web/GlennEHS

2. Click on **Settings** (top navigation bar)

3. In the left sidebar, click on **Secrets and variables** → **Actions**

4. Click the **New repository secret** button

5. Fill in the secret details:
   - **Name:** `FIREBASE_TOKEN`
   - **Value:** Paste the token you copied from Step 2

6. Click **Add secret**

### Step 4: Verify the Setup

1. Push any change to the `main` branch or manually trigger the workflow

2. Go to the **Actions** tab in your GitHub repository

3. You should see the "Deploy to Firebase Hosting" workflow running

4. Once complete, visit https://glenn-ehs-website.firebaseapp.com/ to see your deployed site

## How It Works

### Automatic Deployment

Every time you push to the `main` branch:
1. GitHub Actions workflow is triggered
2. The workflow checks if `FIREBASE_TOKEN` is set
3. It installs Firebase tools
4. Deploys your site to Firebase Hosting
5. Your site is immediately live at https://glenn-ehs-website.firebaseapp.com/

### Manual Deployment

You can also deploy manually from your local machine:

```bash
# Make sure you're logged in
firebase login

# Deploy to hosting
firebase deploy --only hosting --project glenn-ehs-website
```

## Firebase Project Configuration

The project configuration is stored in two files:

### `.firebaserc`
```json
{
  "projects": {
    "default": "glenn-ehs-website"
  }
}
```

This file specifies the Firebase project ID.

### `firebase.json`
```json
{
  "hosting": {
    "public": ".",
    "ignore": [...],
    "headers": [...],
    "rewrites": [...]
  }
}
```

This file configures:
- **public**: The directory to deploy (`.` means root directory)
- **ignore**: Files/folders to exclude from deployment
- **headers**: Custom HTTP headers (e.g., caching rules)
- **rewrites**: URL rewrites for SPA-like behavior

## Troubleshooting

### ❌ Error: "FIREBASE_TOKEN secret is not set"

**Problem:** The GitHub Actions workflow can't find the Firebase token.

**Solution:**
1. Follow Steps 2-3 above to generate and add the token
2. Make sure the secret name is exactly `FIREBASE_TOKEN` (case-sensitive)
3. Re-run the failed workflow

### ❌ Error: "Failed to authenticate"

**Problem:** The Firebase token is invalid or expired.

**Solutions:**
1. Generate a new token using `firebase login:ci`
2. Update the `FIREBASE_TOKEN` secret in GitHub with the new token
3. Tokens can expire after a year - regenerate if needed

### ❌ Error: "HTTP Error: 403, Permission denied"

**Problem:** Your Google account doesn't have access to the Firebase project.

**Solutions:**
1. Contact the Firebase project owner
2. Ask them to add your Google account to the project
3. Go to [Firebase Console](https://console.firebase.google.com/project/glenn-ehs-website/settings/iam) and verify your permissions

### ❌ Deployment succeeds but site doesn't update

**Problem:** Browser caching or deployment delay.

**Solutions:**
1. Wait 1-2 minutes for changes to propagate
2. Clear your browser cache (Ctrl+Shift+R or Cmd+Shift+R)
3. Try opening the site in an incognito/private window

### ❌ Error: "Project glenn-ehs-website not found"

**Problem:** The project ID doesn't exist or you don't have access.

**Solutions:**
1. Verify the project exists at: https://console.firebase.google.com/
2. Check that `.firebaserc` has the correct project ID
3. Ensure your account has access to the project

## Additional Resources

### Firebase Console
- **Project Dashboard:** https://console.firebase.google.com/project/glenn-ehs-website
- **Hosting Dashboard:** https://console.firebase.google.com/project/glenn-ehs-website/hosting
- **Usage & Billing:** https://console.firebase.google.com/project/glenn-ehs-website/usage

### Documentation
- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [GitHub Actions for Firebase](https://github.com/marketplace/actions/deploy-to-firebase-hosting)

### Useful Commands

```bash
# Check Firebase CLI version
firebase --version

# Login to Firebase
firebase login

# Logout from Firebase
firebase logout

# List all Firebase projects you have access to
firebase projects:list

# Check what will be deployed (dry run)
firebase deploy --only hosting --dry-run

# View deployment history
firebase hosting:channel:list

# Deploy to a preview channel (for testing)
firebase hosting:channel:deploy preview
```

## Getting Help

If you're still having issues:

1. Check the [Actions tab](https://github.com/Gurutej11-web/GlennEHS/actions) for detailed error logs
2. Review the [Firebase status page](https://status.firebase.google.com/)
3. Check if GitHub Actions is experiencing issues: https://www.githubstatus.com/

## Security Notes

⚠️ **Important Security Information:**

1. **Never commit the Firebase token to your repository** - always use GitHub Secrets
2. The `FIREBASE_TOKEN` secret is only accessible to GitHub Actions runners
3. Keep your Firebase token secure - it grants deployment access to your project
4. Regenerate your token immediately if you suspect it's been compromised
5. Only add trusted collaborators who need deployment access

## Next Steps

Once your Firebase deployment is working:

1. ✅ Set up a custom domain (optional)
2. ✅ Configure SSL/TLS settings in Firebase Console
3. ✅ Set up deployment notifications
4. ✅ Monitor usage and performance in Firebase Console
5. ✅ Consider setting up preview channels for testing

---

**Last Updated:** January 6, 2026  
**Firebase Project:** glenn-ehs-website  
**Deployment URL:** https://glenn-ehs-website.firebaseapp.com/
