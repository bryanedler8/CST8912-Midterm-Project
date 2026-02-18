// upload-manager.js - Core upload functionality

class UploadManager {
    constructor() {
        // Load configuration
        this.config = window.APP_CONFIG;
        
        if (!this.config.isValid()) {
            console.error('Invalid configuration. Please check your .env file');
            this.showToast('Configuration Error: Please set up Azure credentials', 'error');
        }
        
        // State management
        this.files = new Map(); // fileName -> File object
        this.uploads = new Map(); // fileName -> upload status
        this.isDragging = false;
        
        // DOM Elements
        this.initDOMElements();
        
        // Initialize
        this.bindEvents();
        this.render();
    }
    
    initDOMElements() {
        this.dropArea = document.getElementById('dropArea');
        this.fileInput = document.getElementById('fileInput');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.fileList = document.getElementById('fileList');
        this.fileSection = document.getElementById('fileSection');
        this.statsSection = document.getElementById('statsSection');
        this.toastContainer = document.getElementById('toastContainer');
        this.fileCountEl = document.getElementById('fileCount');
        this.totalFilesEl = document.getElementById('totalFiles');
        this.totalSizeEl = document.getElementById('totalSize');
        this.uploadedCountEl = document.getElementById('uploadedCount');
        this.successRateEl = document.getElementById('successRate');
    }
    
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
    
    handleDragOver(e) {
        e.preventDefault();
        if (!this.isDragging) {
            this.isDragging = true;
            this.dropArea.classList.add('drag-over');
        }
    }
    
    handleDragLeave(e) {
        e.preventDefault();
        this.isDragging = false;
        this.dropArea.classList.remove('drag-over');
    }
    
    handleDrop(e) {
        e.preventDefault();
        this.isDragging = false;
        this.dropArea.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }
    
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
        this.fileInput.value = ''; // Reset input
    }
    
    processFiles(newFiles) {
        const validFiles = [];
        const errors = [];
        
        // Check total files limit
        if (this.files.size + newFiles.length > this.config.maxFiles) {
            this.showToast(`Maximum ${this.config.maxFiles} files allowed`, 'error');
            return;
        }
        
        for (const file of newFiles) {
            // Check file type
            if (!this.config.allowedTypes.includes(file.type)) {
                errors.push(`${file.name}: Invalid file type`);
                continue;
            }
            
            // Check file size
            if (file.size > this.config.maxFileSize) {
                errors.push(`${file.name}: File too large (max ${this.config.maxFileSize / (1024*1024)}MB)`);
                continue;
            }
            
            // Check if file already exists
            if (this.files.has(file.name)) {
                errors.push(`${file.name}: Already added`);
                continue;
            }
            
            validFiles.push(file);
        }
        
        // Show errors
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
    
    generatePreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const upload = this.uploads.get(file.name);
            if (upload) {
                upload.preview = e.target.result;
                this.render();
            }
        };
        reader.readAsDataURL(file);
    }
    
    async uploadFile(file) {
        // Check if config is valid
        if (!this.config.isValid()) {
            this.showToast('Configuration Error: Missing Azure credentials', 'error');
            return;
        }
        
        const blobName = `${Date.now()}-${this.sanitizeFileName(file.name)}`;
        const url = `https://${this.config.storageAccount}.blob.core.windows.net/${this.config.containerName}/${blobName}?${this.config.sasToken}`;
        
        try {
            // Update status
            this.updateFileStatus(file.name, 'uploading', 0);
            
            // Upload with XHR for progress tracking
            await this.uploadWithXHR(file, url);
            
            // Update to success
            this.updateFileStatus(file.name, 'success', 100);
            this.showToast(`${file.name} uploaded successfully!`, 'success');
            
        } catch (error) {
            // Update to error
            this.updateFileStatus(file.name, 'error', 0, error.message);
            this.showToast(`Failed to upload ${file.name}: ${error.message}`, 'error');
            throw error;
        } finally {
            this.updateStats();
        }
    }
    
    uploadWithXHR(file, url) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const progress = Math.round((e.loaded / e.total) * 100);
                    this.updateFileProgress(file.name, progress);
                }
            });
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(xhr.response);
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            });
            
            xhr.addEventListener('error', () => reject(new Error('Network error occurred')));
            xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
            
            xhr.open('PUT', url, true);
            xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
            xhr.setRequestHeader('Content-Type', file.type);
            xhr.send(file);
        });
    }
    
    updateFileProgress(fileName, progress) {
        const upload = this.uploads.get(fileName);
        if (upload && upload.status === 'uploading') {
            upload.progress = progress;
            this.render();
        }
    }
    
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
    
    async uploadAll() {
        this.uploadBtn.disabled = true;
        
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
        
        this.showToast(`Uploading ${filesToUpload.length} file(s)...`, 'info');
        
        // Upload files concurrently (max 3 at a time)
        const batchSize = 3;
        for (let i = 0; i < filesToUpload.length; i += batchSize) {
            const batch = filesToUpload.slice(i, i + batchSize);
            await Promise.allSettled(
                batch.map(([_, file]) => this.uploadFile(file))
            );
        }
        
        const hasPending = Array.from(this.uploads.values())
            .some(u => u.status === 'pending' || u.status === 'error');
        
        this.uploadBtn.disabled = !hasPending;
        
        if (!hasPending) {
            this.showToast('All files processed!', 'success');
        }
    }
    
    removeFile(fileName) {
        if (confirm(`Remove ${fileName} from upload queue?`)) {
            this.files.delete(fileName);
            this.uploads.delete(fileName);
            this.render();
            this.updateStats();
            this.showToast(`${fileName} removed`, 'info');
        }
    }
    
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
    
    render() {
        if (this.files.size === 0) {
            this.fileSection.style.display = 'none';
            this.statsSection.style.display = 'none';
            return;
        }
        
        this.fileSection.style.display = 'block';
        this.statsSection.style.display = 'block';
        this.fileCountEl.textContent = this.files.size;
        
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
                            <button class="remove-btn" onclick="window.uploadManager.removeFile('${fileName}')" 
                                    title="Remove file">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
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
    }
    
    getStatusHTML(upload) {
        switch(upload.status) {
            case 'uploading':
                return `
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${upload.progress}%"></div>
                    </div>
                    <span>${upload.progress}%</span>
                `;
            case 'success':
                return `
                    <svg class="status-icon success" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M5 13l4 4L19 7"/>
                    </svg>
                `;
            case 'error':
                return `
                    <svg class="status-icon error" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M12 8v4m0 4h.01"/>
                    </svg>
                `;
            default:
                return `
                    <svg class="status-icon pending" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M12 6v6l4 2"/>
                    </svg>
                `;
        }
    }
    
    updateStats() {
        const totalFiles = this.files.size;
        const totalSize = Array.from(this.files.values()).reduce((sum, file) => sum + file.size, 0);
        const uploadsList = Array.from(this.uploads.values());
        const uploadedCount = uploadsList.filter(u => u.status === 'success').length;
        const successRate = uploadsList.length > 0 
            ? Math.round((uploadedCount / uploadsList.length) * 100) 
            : 0;
        
        if (this.totalFilesEl) this.totalFilesEl.textContent = totalFiles;
        if (this.totalSizeEl) this.totalSizeEl.textContent = this.formatFileSize(totalSize);
        if (this.uploadedCountEl) this.uploadedCountEl.textContent = uploadedCount;
        if (this.successRateEl) this.successRateEl.textContent = `${successRate}%`;
        
        const hasPending = uploadsList.some(u => u.status === 'pending' || u.status === 'error');
        this.uploadBtn.disabled = !hasPending;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    truncateFileName(fileName, maxLength = 25) {
        if (fileName.length <= maxLength) return fileName;
        const ext = fileName.split('.').pop();
        const name = fileName.substring(0, fileName.lastIndexOf('.'));
        return name.substring(0, maxLength - ext.length - 4) + '...' + ext;
    }
    
    sanitizeFileName(fileName) {
        return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    }
    
    getPlaceholderImage() {
        return 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'50\' height=\'50\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23cbd5e0\' stroke-width=\'2\'%3E%3Crect x=\'2\' y=\'2\' width=\'20\' height=\'20\' rx=\'2.18\'/%3E%3Cpath d=\'M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5\'/%3E%3C/svg%3E';
    }
    
    showToast(message, type = 'info', duration = 3000) {
        if (!this.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        
        toast.innerHTML = `
            <span class="toast-message">${icons[type] || 'ℹ'} ${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
        `;
        
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.uploadManager = new UploadManager();
});