# Deployment Guide — GlennEHS

This file documents how to host and update the static site (HTML/CSS/JS) in this repository.

## 🔥 Firebase Hosting (Primary Deployment)

**The GlennEHS website is automatically deployed to Firebase Hosting!**

- **Live Site:** https://glenn-ehs-website.firebaseapp.com/
- **Status:** ✅ Configured and ready (requires `FIREBASE_TOKEN` secret)
- **Auto-Deploy:** Every push to `main` branch triggers automatic deployment

### Quick Start

If this is your first time setting up Firebase deployment, follow these steps:

1. **Generate Firebase Token** (one-time setup):
   ```bash
   npm install -g firebase-tools
   firebase login:ci
   ```
   This will give you a token like `1//0abc123def...`

2. **Add Token to GitHub**:
   - Go to https://github.com/Gurutej11-web/GlennEHS/settings/secrets/actions
   - Click "New repository secret"
   - Name: `FIREBASE_TOKEN`
   - Value: (paste your token from step 1)
   - Click "Add secret"

3. **That's it!** Your site will now auto-deploy on every push to `main`

📖 **For detailed instructions, troubleshooting, and more information, see [FIREBASE_SETUP.md](FIREBASE_SETUP.md)**

### Manual Deployment

You can also deploy manually from your local machine:

```bash
firebase login
firebase deploy --only hosting --project glenn-ehs-website
```

### How It Works

- GitHub Actions workflow (`.github/workflows/firebase-hosting-deploy.yml`) automatically deploys on push
- The workflow checks if `FIREBASE_TOKEN` is set and provides helpful error messages if not
- Deployment takes ~30 seconds
- Site is immediately live at https://glenn-ehs-website.firebaseapp.com/

---

## Alternative: GitHub Pages


## Alternative: GitHub Pages

GitHub Pages is also available as a backup deployment option.

- Why: It's built into GitHub, requires no external service, and automatically redeploys when you push to `main`. For a static site (no server code), it's a simple, reliable option.

Quick steps to enable GitHub Pages
1. Open your repo on GitHub: https://github.com/Gurutej11-web/GlennEHS
2. Go to Settings → Pages.
3. Under "Build and deployment" → "Source" choose:
   - Branch: `main`
   - Folder: `/ (root)`
4. Click Save and wait a minute. Your site will be available at:
   https://Gurutej11-web.github.io/GlennEHS/

Updating the site
- Edit files locally, then run:

  git add .
  git commit -m "Describe changes"
  git push origin main

GitHub Pages will automatically deploy the new changes.

Optional: Custom domain
- To use your own domain, create a file named `CNAME` in the repo root that contains your domain (one line), e.g. `www.example.com`, commit and push. Then configure your DNS per GitHub Pages docs.

Alternative option: Netlify (if you want more features)
- Why choose Netlify: deploy previews, easy redirects, headers, instant rollbacks, built-in functions, and simple drag-and-drop deploys.
- How to set up:
  1. Sign up at https://app.netlify.com/ and connect your GitHub account.
  2. Click "New site from Git" → Choose GitHub → select the `Gurutej11-web/GlennEHS` repo.
  3. Configure: leave build command blank; publish directory: `/` (root).
  4. Deploy. Netlify will provide a `*.netlify.app` domain and automatic HTTPS.
- Updating the site: edit → commit → push. Netlify rebuilds on push.

Local testing (before pushing)
- Quick static server (Python):
  python -m http.server 8000
  # open http://localhost:8000

- Or use VS Code Live Server for an iterative dev experience.

Security & Firebase notes
- The site uses Firebase client config. That config is safe to be public (it’s not a secret). But ensure your Firestore security rules permit only authenticated/admin writes. If you want, I can draft a recommended minimal set of Firestore rules for admin-only writes.

If you want me to perform the next step for you, pick one:
- (A) I will enable GitHub Pages for the repo (I will give step-by-step and add a `CNAME` if you provide a domain). Note: enabling Pages requires a settings click in the GitHub web UI (I can’t toggle it via this environment without your GitHub credentials).
- (B) I will prepare a Netlify-ready `_redirects` and `_headers` file and instructions.
- (C) I will add a `CNAME` or other minor repo changes and commit them for you.

Which would you like me to do next?

---

## Summary

**✅ Primary deployment:** Firebase Hosting (https://glenn-ehs-website.firebaseapp.com/)  
**🔑 Setup required:** Add `FIREBASE_TOKEN` secret to GitHub - see [FIREBASE_SETUP.md](FIREBASE_SETUP.md)  
**📋 Alternative options:** GitHub Pages or Netlify are also available if needed  

For complete Firebase setup instructions, troubleshooting, and more details, see **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)**.
