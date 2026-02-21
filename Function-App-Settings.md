

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
| **Storage account name** | Enter a unique name (e.g., `imageresize[YourInitials]`) - must be 3-24 characters, lowercase letters/numbers only  |
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
- Click **"Create new"** and give it a name like `funcstorage[YourInitials]` 
- **This is different from your image storage account** - Functions needs its own storage to operate 

**Monitoring Tab (third page):**
- **Enable Application Insights**: Select **"Yes"** (helps with debugging) 
- This will create an Application Insights resource for monitoring your function

**Review + Create Tab:**
- Review all your settings and click **"Create"** 
- Deployment takes 2-3 minutes

