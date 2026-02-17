/**
 * Upload Manager - Azure Blob Storage Image Upload Client
 * Handles file selection, validation, uploads, and UI updates
 */

class UploadManager {
    constructor() {
        // Configuration
        this.config = {
            maxFileSize: 10 * 1024 * 1024, // 10MB
            allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            maxFiles: 10,
            containerName: 'raw-images',
            storageAccount: 'yourstorageaccount', // Update this
            sasToken: 'YOUR_SAS_TOKEN_HERE' // Get this from your backend
        };

        // State
        this.files = new Map(); // fileName -> File object
        this.uploads = new Map(); // fileName -> upload status
        this.isDragging = false;

        // DOM Elements
        this.initDOMElements();
        
        // Initialize
        this.bindEvents();
    }

    /**
     * Initialize DOM element references
     */
    initDOMElements() {
        this.dropArea = document.getElementById('dropArea');
        this.fileInput = document.getElementById('fileInput');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.fileList = document.getElementById('fileList');
        this.fileSection = document.getElementById('fileSection');
        this.statsSection = document.getElementById('statsSection');
        this.toastContainer = document.getElementById('toastContainer');
        
        // Stats elements
        this.totalFilesEl = document.getElementById('totalFiles');
        this.totalSizeEl = document.getElementById('totalSize');
        this.uploadedCountEl = document.getElementById('uploadedCount');
        this.successRateEl = document.getElementById('successRate');
        this.fileCountEl = document.getElementById('fileCount');
    }

    /**
     * Bind all event listeners
     */
    bindEvents() {
        // Drag & drop events
        this.dropArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.dropArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.dropArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Click to browse
        this.dropArea.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Button events
        this.uploadBtn.addEventListener('click', () => this.uploadAll());
        this.clearBtn.addEventListener('click', () => this.clearAll());
        
        // Window events
        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('drop', (e) => e.preventDefault());
    }

    /**
     * Handle drag over event
     */
    handleDragOver(e) {
        e.preventDefault();
        if (!this.isDragging) {
            this.isDragging = true;
            this.dropArea.classList.add('drag-over');
        }
    }

    /**
     * Handle drag leave event
     */
    handleDragLeave(e) {
        e.preventDefault();
        this.isDragging = false;
        this.dropArea.classList.remove('drag-over');
    }

    /**
     * Handle drop event
     */
    handleDrop(e) {
        e.preventDefault();
        this.isDragging = false;
        this.dropArea.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }

    /**
     * Handle file select from input
     */
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
        this.fileInput.value = ''; // Reset input
    }

    /**
     * Process and validate files
     */
    processFiles(newFiles) {
        const validFiles = [];
        const errors = [];

        newFiles.forEach(file => {
            // Check file type
            if (!this.config.allowedTypes.includes(file.type)) {
                errors.push(`${file.name}: Invalid file type. Allowed: ${this.config.allowedTypes.join(', ')}`);
                return;
            }

            // Check file size
            if (file.size > this.config.maxFileSize) {
                errors.push(`${file.name}: File too large. Max: ${this.config.maxFileSize / (1024 * 1024)}MB`);
                return;
            }

            // Check if file already exists
            if (this.files.has(file.name)) {
                errors.push(`${file.name}: File already added`);
                return;
            }

            validFiles.push(file);
        });

        // Check total files limit
        if (this.files.size + validFiles.length > this.config.maxFiles) {
            this.showToast(`Maximum ${this.config.maxFiles} files allowed`, 'error');
            return;
        }

        // Show validation errors
        if (errors.length > 0) {
            this.showToast(errors.join('\n'), 'error', 5000);
        }

        // Add valid files
        validFiles.forEach(file => {
            this.addFile(file);
        });

        this.render();
        this.updateStats();
    }

    /**
     * Add a single file to the upload queue
     */
    addFile(file) {
        this.files.set(file.name, file);
        this.uploads.set(file.name, {
            status: 'pending',
            progress: 0
        });

        // Generate preview for images
        if (file.type.startsWith('image/')) {
            this.generatePreview(file);
        }
    }

    /**
     * Generate image preview
     */
    generatePreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const upload = this.uploads.get(file.name);
            if (upload) {
                upload.preview = e.target.result;
                this.render(); // Re-render to show preview
            }
        };
        reader.readAsDataURL(file);
    }

    /**
     * Upload a single file to Azure Blob Storage
     */
    async uploadFile(file) {
        const blobName = `${Date.now()}-${this.sanitizeFileName(file.name)}`;
        const url = `https://${this.config.storageAccount}.blob.core.windows.net/${this.config.containerName}/${blobName}?${this.config.sasToken}`;

        try {
            // Update status to uploading
            this.updateFileStatus(file.name, 'uploading', 0);

            // Create upload promise with XHR for progress tracking
            const uploadResult = await this.uploadWithXHR(file, url);

            // Update to success
            this.updateFileStatus(file.name, 'success', 100);
            this.showToast(`${file.name} uploaded successfully!`, 'success');
            
            return uploadResult;

        } catch (error) {
            // Update to error
            this.updateFileStatus(file.name, 'error', 0, error.message);
            this.showToast(`Failed to upload ${file.name}: ${error.message}`, 'error');
            throw error;
        } finally {
            this.updateStats();
        }
    }

    /**
     * Upload file using XMLHttpRequest for progress tracking
     */
    uploadWithXHR(file, url) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            // Progress tracking
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const progress = Math.round((e.loaded / e.total) * 100);
                    this.updateFileProgress(file.name, progress);
                }
            });

            // Load event
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(xhr.response);
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            });

            // Error events
            xhr.addEventListener('error', () => reject(new Error('Network error occurred')));
            xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

            // Configure and send request
            xhr.open('PUT', url, true);
            xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
            xhr.setRequestHeader('Content-Type', file.type);
            xhr.send(file);
        });
    }

    /**
     * Update file upload progress
     */
    updateFileProgress(fileName, progress) {
        const upload = this.uploads.get(fileName);
        if (upload && upload.status === 'uploading') {
            upload.progress = progress;
            this.render(); // Re-render to update progress bar
        }
    }

    /**
     * Update file status
     */
    updateFileStatus(fileName, status, progress = 0, error = null) {
        const upload = this.uploads.get(fileName);
        if (upload) {
            upload.status = status;
            upload.progress = progress;
            if (error) {
                upload.error = error;
            }
            this.render();
        }
    }

    /**
     * Upload all pending files
     */
    async uploadAll() {
        // Disable upload button
        this.uploadBtn.disabled = true;
        
        // Get files that haven't been successfully uploaded
        const filesToUpload = Array.from(this.files.entries())
            .filter(([fileName]) => {
                const status = this.uploads.get(fileName)?.status;
                return status !== 'success';
            });

        if (filesToUpload.length === 0) {
            this.showToast('No files to upload', 'info');
            this.uploadBtn.disabled = false;
            return;
        }

        // Show uploading notification
        this.showToast(`Uploading ${filesToUpload.length} file(s)...`, 'info');

        // Upload files concurrently (max 3 at a time)
        const batchSize = 3;
        for (let i = 0; i < filesToUpload.length; i += batchSize) {
            const batch = filesToUpload.slice(i, i + batchSize);
            await Promise.allSettled(
                batch.map(([_, file]) => this.uploadFile(file))
            );
        }

        // Re-enable upload button if there are still pending files
        const hasPending = Array.from(this.uploads.values())
            .some(u => u.status === 'pending' || u.status === 'error');
        
        this.uploadBtn.disabled = !hasPending;
        
        if (!hasPending) {
            this.showToast('All files processed!', 'success');
        }
    }

    /**
     * Remove a file from the queue
     */
    removeFile(fileName) {
        if (confirm(`Remove ${fileName} from upload queue?`)) {
            this.files.delete(fileName);
            this.uploads.delete(fileName);
            this.render();
            this.updateStats();
            
            // Show message
            this.showToast(`${fileName} removed`, 'info');
        }
    }

    /**
     * Clear all files
     */
    clearAll() {
        if (this.files.size === 0) return;
        
        if (confirm('Clear all files from upload queue?')) {
            this.files.clear();
            this.uploads.clear();
            this.render();
            this.updateStats();
            this.uploadBtn.disabled = true;
            this.showToast('All files cleared', 'info');
        }
    }

    /**
     * Render the file list
     */
    render() {
        if (this.files.size === 0) {
            this.fileSection.style.display = 'none';
            this.statsSection.style.display = 'none';
            return;
        }

        this.fileSection.style.display = 'block';
        this.statsSection.style.display = 'block';

        let html = '';
        for (const [fileName, file] of this.files) {
            const upload = this.uploads.get(fileName) || { status: 'pending', progress: 0 };
            
            html += `
                <div class="file-item" data-filename="${fileName}">
                    <div class="file-info">
                        <img class="file-preview" 
                             src="${upload.preview || this.getPlaceholderImage()}" 
                             alt="${fileName}"
                             onerror="this.src='${this.getPlaceholderImage()}'">
                        <div class="file-details">
                            <div class="file-name" title="${fileName}">${this.truncateFileName(fileName)}</div>
                            <div class="file-size">${this.formatFileSize(file.size)}</div>
                        </div>
                        <div class="file-status">
                            ${this.getStatusHTML(upload)}
                            <button class="remove-btn" onclick="uploadManager.removeFile('${fileName}')" 
                                    title="Remove file">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        this.fileList.innerHTML = html;
        this.fileCountEl.textContent = this.files.size;
    }

    /**
     * Get status HTML based on upload state
     */
    getStatusHTML(upload) {
        switch(upload.status) {
            case 'uploading':
                return `
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${upload.progress}%"></div>
                    </div>
                    <span class="status-text">${upload.progress}%</span>
                `;
            case 'success':
                return `
                    <svg class="status-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M5 13l4 4L19 7"/>
                    </svg>
                `;
            case 'error':
                return `
                    <svg class="status-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M12 8v4m0 4h.01"/>
                    </svg>
                `;
            default:
                return `
                    <svg class="status-icon pending" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M12 6v6l4 2"/>
                    </svg>
                `;
        }
    }

    /**
     * Update statistics
     */
    updateStats() {
        const totalFiles = this.files.size;
        const totalSize = Array.from(this.files.values()).reduce((sum, file) => sum + file.size, 0);
        const uploadsList = Array.from(this.uploads.values());
        const uploadedCount = uploadsList.filter(u => u.status === 'success').length;
        const successRate = uploadsList.length > 0 
            ? Math.round((uploadedCount / uploadsList.length) * 100) 
            : 0;

        this.totalFilesEl.textContent = totalFiles;
        this.totalSizeEl.textContent = this.formatFileSize(totalSize);
        this.uploadedCountEl.textContent = uploadedCount;
        this.successRateEl.textContent = `${successRate}%`;
        
        // Enable/disable upload button
        const hasPending = uploadsList.some(u => u.status === 'pending' || u.status === 'error');
        this.uploadBtn.disabled = !hasPending;
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // Add icon based on type
        const icon = this.getToastIcon(type);
        
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        `;

        this.toastContainer.appendChild(toast);

        // Auto remove after duration
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * Get toast icon based on type
     */
    getToastIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    /**
     * Utility: Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Utility: Truncate long file names
     */
    truncateFileName(fileName, maxLength = 30) {
        if (fileName.length <= maxLength) return fileName;
        const ext = fileName.split('.').pop();
        const name = fileName.substring(0, fileName.lastIndexOf('.'));
        return name.substring(0, maxLength - ext.length - 4) + '...' + ext;
    }

    /**
     * Utility: Sanitize file name for blob storage
     */
    sanitizeFileName(fileName) {
        return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    }

    /**
     * Utility: Get placeholder image
     */
    getPlaceholderImage() {
        return 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'50\' height=\'50\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23cbd5e0\' stroke-width=\'2\'%3E%3Crect x=\'2\' y=\'2\' width=\'20\' height=\'20\' rx=\'2.18\'/%3E%3Cpath d=\'M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5\'/%3E%3C/svg%3E';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.uploadManager = new UploadManager();
});