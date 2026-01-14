# One-Click Netlify Deployment

## Quick Deploy

Deploy the Verifier UI to Netlify with a single click:

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/drosser895-eng/precisionpaintpartners-website)

## Manual Deployment Steps

### Prerequisites
- Netlify account (sign up at https://netlify.com)
- GitHub repository access

### Step 1: Connect Repository

1. Log in to [Netlify](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **"GitHub"** as your Git provider
4. Authorize Netlify to access your GitHub account
5. Select repository: `drosser895-eng/precisionpaintpartners-website`

### Step 2: Configure Build Settings

Use these settings for deployment:

| Setting | Value |
|---------|-------|
| **Base directory** | `verifier-ui` |
| **Build command** | `npm run build` |
| **Publish directory** | `verifier-ui/build` |
| **Node version** | `16` (or higher) |

### Step 3: Environment Variables (Optional)

If your Verifier UI requires environment variables, add them in the Netlify dashboard:

1. Go to **Site settings** → **Build & deploy** → **Environment**
2. Click **"Add environment variable"**
3. Add required variables:
   - `REACT_APP_RPC_URL` - Blockchain RPC endpoint
   - `REACT_APP_ANCHOR_CONTRACT` - AnchorRegistry contract address
   - `REACT_APP_NETWORK` - Network name (e.g., "mainnet", "sepolia")

### Step 4: Deploy

1. Click **"Deploy site"**
2. Wait for build to complete (typically 2-5 minutes)
3. Your site will be available at: `https://[random-name].netlify.app`

### Step 5: Custom Domain (Optional)

1. Go to **Site settings** → **Domain management**
2. Click **"Add custom domain"**
3. Follow the instructions to configure DNS
4. Enable HTTPS (automatic with Let's Encrypt)

## Configuration File

The repository includes a `netlify.toml` configuration file with optimized settings. The one-click deploy will use these settings automatically.

## Continuous Deployment

Once connected, Netlify will automatically deploy when:
- Changes are pushed to the main branch
- Pull requests are merged

### Deploy Previews

Netlify automatically creates preview deployments for pull requests:
- Each PR gets a unique preview URL
- Test changes before merging
- Automatically deleted after PR is closed

## Build Status Badge

Add this badge to your README to show deployment status:

```markdown
[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR-SITE-ID/deploy-status)](https://app.netlify.com/sites/YOUR-SITE-NAME/deploys)
```

Replace `YOUR-SITE-ID` and `YOUR-SITE-NAME` with your actual Netlify site details.

## Troubleshooting

### Build Fails

Check the build logs in Netlify dashboard:
1. Go to **Deploys** tab
2. Click on the failed deploy
3. Review error messages
4. Common issues:
   - Missing dependencies (check `package.json`)
   - Wrong Node version (set in Netlify dashboard)
   - Build command errors (verify `npm run build` works locally)

### Environment Variables Not Working

- Ensure variable names start with `REACT_APP_` for Create React App
- Variables are set before deployment
- Redeploy after adding new variables

### Site Not Found

- Verify publish directory is correct: `verifier-ui/build`
- Check that build command completed successfully
- Ensure `index.html` exists in publish directory

## Alternative: Netlify CLI

Deploy via command line:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy from project root
netlify deploy --dir=verifier-ui/build --prod
```

## Support

- **Netlify Documentation**: https://docs.netlify.com
- **Netlify Community**: https://answers.netlify.com
- **Status Page**: https://www.netlifystatus.com

---

**Last Updated**: 2026-01-14  
**Repository**: https://github.com/drosser895-eng/precisionpaintpartners-website
