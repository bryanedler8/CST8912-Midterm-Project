

## Step 1: Create Storage Accounts

You need two storage accounts (or one account with separate containers):
- **Image storage**: Stores original and resized images
- **Function storage**: Used internally by Azure Functions 

### Create the Storage Account


1. Go to "Storage accounts" → "Create"
2. Choose a globally unique name (resizedimages12)
3. Select "Standard" performance and "Locally-redundant storage (LRS)"
4. Create or select a resource group `image-resize-rg`

### Create Containers

Create two containers in your image storage account :
- **`images`** - for original uploads
- **`thumbnails`** - for resized outputs

Of course! I'll walk you through creating the Function App and Storage Account using the Azure Portal step by step. This is much easier with visual guidance, and I'll provide all the details you need.

## Step 1: Create the Storage Account (for images)

First, let's create the storage account that will hold your original images and resized thumbnails.

**Portal Navigation:**
1. Go to [Azure Portal](https://portal.azure.com) and sign in with your student account
2. In the search bar at the top, type "Storage accounts" and select it 
3. Click **"+ Create"** button 

**Basics Tab:**
| Setting | What to enter |
|---------|---------------|
| **Subscription** | Select your student subscription  |
| **Resource group** | Click "Create new" → Enter `image-resize-rg`  |
| **Storage account name** | Enter a unique name (imageresizecst12 ) |
| **Region** | Select a region close to you (e.g., "East US")  |
| **Performance** | Select **Standard**  |
| **Redundancy** | Select **Locally-redundant storage (LRS)**  |

Click **"Review + create"** then **"Create"** . Wait for deployment to complete (usually 30-60 seconds).

## Step 2: Create Containers in Your Storage Account

Once your storage account is deployed:

1. Click **"Go to resource"** 
2. In the left menu, under **"Data storage"**, click **"Containers"** 
3. Click **"+ Container"** and create:
   - **First container**: Name = `images` (Public access level = Private) 
   - **Second container**: Name = `thumbnails` (Public access level = Blob - for downloading later)
4. Click **"Create"** for each

## Step 3: Create the Function App (and its Storage Account)

Now we'll create the Function App that will process your images. **Important:** This automatically creates a separate storage account just for Functions' internal use. 

**Portal Navigation:**
1. In the Azure Portal search bar, type "Function App" and select it 
2. Click **"+ Create"** button 

**Basics Tab (first page):**
| Setting | What to enter |
|---------|---------------|
| **Subscription** | Select your student subscription  |
| **Resource group** | Select `image-resize-rg` (the same one we created)  |
| **Function App name** | Enter a globally unique name (e.g., `ResizeFunction[YourInitials]`) - this becomes part of your app's URL  |
| **Do you want to deploy code or container image?** | Select **Code**  |
| **Runtime stack** | Choose  **Python** |
| **Version** | Select the latest version (usually preselected)  |
| **Region** | Choose the **same region** as your storage account  |
| **Operating System** | Select **Linux**  |
| **Hosting options and plans** | Select **Consumption (Serverless)** - this is free tier friendly!  |

**Storage Tab (second page):**
- Under **"Storage account"**, you'll see an option to **"Create new"** 
- This will create a separate storage account for Functions' internal use (like managing triggers and logging) 
- Click **"Create new"** and give it a name like `customerimages` 
- **This is different from your image storage account** - Functions needs its own storage to operate 

**Monitoring Tab (third page):**
- **Enable Application Insights**: Select **"Yes"** (helps with debugging) 
- This will create an Application Insights resource for monitoring your function

**Review + Create Tab:**
- Review all your settings and click **"Create"** 
- Deployment takes 2-3 minutes




**list of storages created will be:**

- **Storage 1**: `customerimages` - This is your **Function App's internal storage** (created by you during Function App creation)
- **Storage 2**: `imageresizecst12` - This is your **image storage** with the `images` and `thumbnails` containers ✅



## Configure Function App Settings 

1. In your Function App, go to **"Environment variables"** (under Settings)

2. You'll see the existing settings (these are correct and point to your **customerimages** storage):

| Existing Setting | Points To |
|-----------------|-----------|
| `AzureWebJobsStorage` | **customerimages12** (Function's internal storage) ✅ |
| `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING` | **customerimages12** (Function's internal storage) ✅ |

3. **Add NEW settings** for your image storage (click "+ Add"):

| Setting Name | Value | Purpose |
|--------------|-------|---------|
| `IMAGE_STORAGE_CONNECTION` | *Connection string from **imageresizecst12*** | Connects to your **image storage** |
| `THUMBNAIL_CONTAINER_NAME` | `thumbnails` | Where to save resized images |
| `THUMBNAIL_WIDTH` | `300` | Desired width in pixels |

**Get the connection string from imageresizecst12:**
1. Go to your **imageresizecst12** storage account
2. In left menu, under **"Security + networking"**, click **"Access keys"** 
3. Click **"Show"** next to "Connection string" for key1
4. Click the **copy icon** to copy the entire connection string
5. Return to your Function App's "Environment variables" and paste it for `IMAGE_STORAGE_CONNECTION`

4. After adding all three settings, click **"Apply"** and then **"Confirm"** to save.

## Final Environment Variables Check

After adding, your settings should look like:

| Name | Value | Purpose |
|------|-------|---------|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | (auto-generated) | Monitoring |
| `AzureWebJobsStorage` | (points to **customerimages**) | **Function internal storage** ✅ |
| `FUNCTIONS_EXTENSION_VERSION` | ~4 | Runtime version |
| `FUNCTIONS_WORKER_RUNTIME` | python/node | Your chosen language |
| `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING` | (points to **customerimages**) | **Function code storage** ✅ |
| `WEBSITE_CONTENTSHARE` | (auto-generated) | File share for code |
| **`IMAGE_STORAGE_CONNECTION`** | (points to **imageresizecst12**) | **YOUR IMAGE STORAGE** ✅ |
| **`THUMBNAIL_CONTAINER_NAME`** | `thumbnails` | Output container ✅ |
| **`THUMBNAIL_WIDTH`** | `300` | Resize setting ✅ |






##  Enable Managed Identity on Your Function App

1. Go to your **Function App** in Azure Portal
2. In the left menu, under **"Settings"**, click **"Identity"** 
3. On the **"System assigned"** tab, you'll see:
   - **Status**: Toggle it to **"On"** 
   - Click **"Save"** 
   - Confirm by clicking **"Yes"** when prompted

4. After saving, you'll see:
   - An **Object (principal) ID** is generated (this is your function's identity)
   - This may take a minute to propagate




##  IAM Permissions (Important!)

Now set up permissions for your **imageresizecst12** storage account:

1. Go to **imageresizecst12** storage account
2. Click **"Access Control (IAM)"** 
3. Click **"+ Add"** → **"Add role assignment"** 

**First Role Assignment (Reader for reading original images):**
- **Role**: search for **"Storage Blob Data Reader"** 
- **Assign access to**: Select **"Managed identity"**
- **Click "+ Select members"**
- **Managed identity**: Select your Function App (it should appear in the list)
- Click **"Select"** then **"Review + assign"**

**Second Role Assignment (Contributor for saving thumbnails):**
- Repeat the process, but this time select **"Storage Blob Data Contributor"** 



Great! Let's create the actual resize function. I'll show you how to create it using the Azure Portal's code editor - no local development needed.

## Step 1: Create a New Function in the Portal

1. Go to your **Function App** in Azure Portal
2. In the left menu, click **"Functions"** 
3. Click **"+ Create"** button at the top

**In the "Create Function" panel:**

| Setting | Value |
|---------|-------|
| **Development environment** | Select **"Develop in portal"** |
| **Template** | Search for and select **"Azure Blob Storage trigger"** |
| **New Function** | Name it `ImageResizer` (or any name you like) |
| **Path** | Enter `images/{name}` (this watches the images container) |
| **Storage account connection** | Select **"AzureWebJobsStorage"** (this is the connection setting name) |

Click **"Create"** 

> **Note**: We use `AzureWebJobsStorage` here because that's the connection string for your Function's internal storage. But in our code, we'll use the `IMAGE_STORAGE_CONNECTION` we created earlier to actually access the images.

## Step 2: Replace with the Resize Code

After creation, you'll see the default function code. Replace it with the code below based on your runtime stack:



```python
import logging
import azure.functions as func
import os
from PIL import Image
import io
from azure.storage.blob import BlobServiceClient

def main(myblob: func.InputStream):
    logging.info(f"Python blob trigger function processed blob: {myblob.name}")
    
    try:
        # Get settings
        image_storage_connection = os.environ["IMAGE_STORAGE_CONNECTION"]
        thumbnail_container = os.environ["THUMBNAIL_CONTAINER_NAME"]
        thumbnail_width = int(os.environ.get("THUMBNAIL_WIDTH", "300"))
        
        # Open and resize image
        img = Image.open(myblob)
        logging.info(f"Original size: {img.width}x{img.height}")
        
        # Calculate new height maintaining aspect ratio
        ratio = thumbnail_width / img.width
        new_height = int(img.height * ratio)
        
        # Resize image
        img_resized = img.resize((thumbnail_width, new_height), Image.Resampling.LANCZOS)
        
        # Save to bytes
        output = io.BytesIO()
        
        # Preserve original format, default to JPEG if unknown
        img_format = img.format if img.format else 'JPEG'
        
        # Handle PNG transparency if needed
        if img_format == 'PNG' and img.mode == 'RGBA':
            # Create white background for transparency
            background = Image.new('RGBA', img_resized.size, (255, 255, 255))
            img_resized = Image.alpha_composite(background, img_resized)
            img_resized = img_resized.convert('RGB')
            img_format = 'JPEG'
        
        img_resized.save(output, format=img_format, quality=85)
        output.seek(0)
        
        # Get blob name from path
        blob_name = myblob.name.split('/')[-1]
        
        # Create blob name with size indicator (optional)
        name_parts = blob_name.rsplit('.', 1)
        if len(name_parts) > 1:
            output_name = f"{name_parts[0]}_thumb.{name_parts[1]}"
        else:
            output_name = f"{blob_name}_thumb.jpg"
        
        # Upload to thumbnails container
        blob_service = BlobServiceClient.from_connection_string(image_storage_connection)
        container_client = blob_service.get_container_client(thumbnail_container)
        
        # Upload the resized image
        container_client.upload_blob(
            name=output_name,
            data=output,
            overwrite=True
        )
        
        logging.info(f"✅ Successfully resized and saved: {output_name}")
        logging.info(f"Resized size: {thumbnail_width}x{new_height}")
        
    except Exception as e:
        logging.error(f"❌ Error processing image: {str(e)}")
        raise e
```



## Step 3: Add Requirements 

If using Python, you need to add the required packages:

1. In your Function App, go to **"App Files"** (left menu)
2. Click on **"requirements.txt"** 
3. Add these lines:
```
azure-functions
Pillow
azure-storage-blob
```
4. Click **"Save"** 

## Step 4: Test Your Function

Now let's test if everything works:

1. Go to your **imageresizecst12** storage account
2. Click **"Containers"** → **"images"** 
3. Click **"Upload"** and select any image file (JPG, PNG, etc.)
4. Wait a few seconds
5. Go to the **"thumbnails"** container
6. You should see a resized version of your image (with "_thumb" in the name)

## Step 5: Monitor the Function

To see if it's working:

1. Go back to your Function App
2. Click **"Functions"** → **"ImageResizer"** 
3. Click **"Monitor"** 
4. You should see execution logs showing success or any errors

## Troubleshooting Common Issues

| Issue | Likely Fix |
|-------|------------|
| "No module named 'PIL'" | Make sure you saved requirements.txt and wait for install |
| "Access denied" | Check IAM permissions on imageresizecst12 |
| Function not triggering | Verify blob path is `images/{name}` and container exists |
| No thumbnail created | Check Monitor logs for errors |

## How It Works

1. You upload an image to `images` container
2. The Blob Storage trigger activates your function
3. Function reads the image using `IMAGE_STORAGE_CONNECTION`
4. Image is resized (maintaining aspect ratio)
5. Resized image is saved to `thumbnails` container
6. User can download the thumbnail

## Optional Enhancements

Want to make it better? We could:
- Add support for more image formats
- Create multiple sizes (small, medium, large)
- Add watermark
- Optimize compression based on image type

Test it out with a sample image and let me know if you hit any issues!


