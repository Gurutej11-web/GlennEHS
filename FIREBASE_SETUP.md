# Firebase Hosting Setup Guide

This guide explains how to complete the Firebase Hosting setup for automatic deployments.

## Prerequisites

1. Firebase project already exists (`glenn-ehs-website` as per `.firebaserc`)
2. GitHub repository access with admin permissions

## Important: GitHub Pages Workflow Conflict

⚠️ **Note**: The repository currently has a GitHub Pages workflow (`.github/workflows/pages.yml`) that also triggers on pushes to the `main` branch. You should either:

1. **Disable/Remove the GitHub Pages workflow** (recommended if migrating to Firebase):
   ```bash
   git rm .github/workflows/pages.yml
   git commit -m "Remove GitHub Pages workflow"
   ```

2. **Or keep both** but disable GitHub Pages in repository settings:
   - Go to Settings → Pages
   - Set Source to "None"
   
Choose option 1 if you're fully migrating to Firebase Hosting.

## Step 1: Generate Firebase Service Account Token

You need to create a Firebase service account key and add it to GitHub secrets.

### Option A: Using Firebase CLI (Recommended)

1. Install Firebase CLI if not already installed:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Generate a service account key:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project `glenn-ehs-website`
   - Click the gear icon → Project Settings
   - Go to "Service Accounts" tab
   - Click "Generate New Private Key"
   - Download the JSON file

### Option B: Using Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to "IAM & Admin" → "Service Accounts"
4. Find or create a service account with Firebase Hosting Admin role
5. Click "Keys" → "Add Key" → "Create New Key"
6. Choose JSON format and download

## Step 2: Add Secret to GitHub Repository

1. Go to your GitHub repository: `https://github.com/Gurutej11-web/GlennEHS`
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `FIREBASE_TOKEN`
5. Value: Paste the entire contents of the JSON file you downloaded
6. Click "Add secret"

## Step 3: Test the Deployment

Once the secret is added:

1. Push any change to the `main` branch, or
2. Manually trigger the workflow from GitHub Actions tab

The workflow will:
- Checkout the code
- Copy all files to the `dist` directory
- Deploy to Firebase Hosting using the service account

## Configuration Files

### firebase.json
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

- `public`: Specifies `dist` as the deployment directory
- `rewrites`: Configures SPA routing (all routes serve index.html)

### .github/workflows/firebase-hosting-deploy.yml

Automatically deploys on push to `main` branch:
- Builds the site by copying files to `dist/`
- Deploys using Firebase service account
- Uses the `FIREBASE_TOKEN` secret for authentication

## Troubleshooting

### Error: "Missing FIREBASE_TOKEN secret"
- Ensure the secret is added to repository settings
- Verify the secret name is exactly `FIREBASE_TOKEN`

### Error: "Permission denied"
- Verify the service account has "Firebase Hosting Admin" role
- Check that the JSON key is valid and not expired

### Deployment succeeds but site doesn't update
- Check Firebase Console → Hosting to see deployment history
- Verify the correct project ID in `.firebaserc`
- Clear browser cache and try again

## Local Testing

To test the build process locally:

```bash
# Create dist directory and copy files
mkdir -p dist
cp *.html dist/
cp -r css js assets data archive dist/
cp _headers _redirects dist/

# Test with Firebase CLI
firebase serve
```

## Next Steps

After successful deployment:
1. Visit your Firebase Hosting URL to verify the site
2. Configure custom domain if needed in Firebase Console
3. Consider adding staging deployments for pull requests

## Support

For issues with:
- **Firebase**: Check [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- **GitHub Actions**: Check [GitHub Actions Documentation](https://docs.github.com/actions)
