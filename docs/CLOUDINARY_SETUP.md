# Cloudinary Setup Guide

## Problem: "Upload preset not found" Error

If you're seeing the error `POST https://api.cloudinary.com/v1_1/doac4uem2/image/upload 400 (Bad Request)` with message "Upload preset not found", it means the Cloudinary upload preset doesn't exist or isn't configured correctly.

## Solution

### Step 1: Create a Cloudinary Account

1. Go to [Cloudinary](https://cloudinary.com) and sign up for a free account
2. After signing up, you'll be taken to your dashboard

### Step 2: Get Your Cloud Name

1. In your Cloudinary dashboard, you'll see your **Cloud Name** (e.g., `doac4uem2`)
2. Note this down - you'll need it for environment variables

### Step 3: Create an Upload Preset

1. In your Cloudinary dashboard, go to **Settings** (gear icon in top right)
2. Click on **Upload** in the left sidebar
3. Scroll down to **Upload presets** section
4. Click **Add upload preset**
5. Configure the preset:
   - **Preset name**: Enter a name (e.g., `jsm_imaginify` or `imaginify_upload`)
   - **Signing mode**: Choose **Unsigned** (for client-side uploads)
   - **Folder**: (Optional) Set a folder name to organize uploads (e.g., `imaginify`)
   - **Resource type**: Select **Image**
   - **Upload manipulation**: (Optional) Configure any image transformations you want
   - **Access mode**: Select **Public** (so images can be accessed via URL)
6. Click **Save**

### Step 4: Configure Environment Variables

Add these to your `.env.local` file:

```env
# Cloudinary Configuration
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name-here
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=jsm_imaginify
```

**Important Notes:**
- Replace `your-cloud-name-here` with your actual Cloudinary cloud name
- Replace `jsm_imaginify` with the exact preset name you created in Step 3
- The `NEXT_PUBLIC_` prefix is required for client-side access

### Step 5: Restart Your Development Server

After adding the environment variables:

```bash
# Stop your current dev server (Ctrl+C)
# Then restart it
npm run dev
```

### Step 6: Test the Upload

1. Navigate to a transformation page (e.g., `/transformations/add/fill`)
2. Click "Click here to upload image"
3. Select an image
4. The upload should now work without errors

## Troubleshooting

### Still Getting "Upload preset not found"?

1. **Check preset name**: Make sure the preset name in `.env.local` exactly matches the one in Cloudinary (case-sensitive)
2. **Check preset is unsigned**: The preset must be set to "Unsigned" mode for client-side uploads
3. **Check preset is active**: In Cloudinary dashboard, make sure the preset is enabled
4. **Restart dev server**: Environment variables are only loaded when the server starts

### Getting "Invalid API key" Error?

- Make sure `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is set correctly
- The cloud name is usually visible in your Cloudinary dashboard URL: `https://console.cloudinary.com/console/c/[cloud-name]/`

### Images Not Displaying?

- Check that the upload preset has **Access mode** set to **Public**
- Verify the `next.config.mjs` includes Cloudinary in the image domains (already configured)

## Current Configuration

The upload preset is configured in `components/shared/MediaUploader.tsx`:

```typescript
const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "jsm_imaginify";
```

If the environment variable is not set, it defaults to `"jsm_imaginify"`. Make sure this preset exists in your Cloudinary account, or set the environment variable to match your preset name.

## Additional Resources

- [Cloudinary Upload Presets Documentation](https://cloudinary.com/documentation/upload_presets)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)



