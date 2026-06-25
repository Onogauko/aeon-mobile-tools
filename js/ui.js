/**
 * UI Module - Handles UI components and page loading
 * @module ui
 */

/**
 * Load a page from the pages directory
 * @param {string} pageName - Name of the page to load
 * @returns {Promise<DocumentFragment>}
 */
export async function loadPage(pageName) {
    try {
        const response = await fetch(`pages/${pageName}.html`);
        if (!response.ok) {
            throw new Error(`Page not found: ${pageName}`);
        }
        const html = await response.text();
        
        // Create a document fragment from the HTML
        const template = document.createElement('template');
        template.innerHTML = html;
        
        template.content.querySelectorAll('script').forEach(script => script.remove());
        
        return template.content;
        
    } catch (error) {
        console.error('[UI] Error loading page:', error);
        return createErrorPage(pageName);
    }
}

/**
 * Create an error page
 * @param {string} pageName - The page that failed to load
 * @returns {DocumentFragment}
 */
function createErrorPage(pageName) {
    const template = document.createElement('template');
    template.innerHTML = `
        <div class="flex items-center justify-center min-h-screen p-4" style="background: #F5F5F5;">
            <div class="card p-8 text-center max-w-md w-full">
                <span class="material-icons text-6xl text-red-500">error_outline</span>
                <h2 class="text-xl font-bold mt-4 text-gray-800">Page Not Found</h2>
                <p class="text-gray-500 mt-2">The page "${pageName}" could not be loaded.</p>
                <button onclick="window.router.navigate('/dashboard')" 
                        class="mt-6 btn btn-primary">
                    <span class="material-icons">home</span>
                    Go to Dashboard
                </button>
            </div>
        </div>
    `;
    return template.content;
}

/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {string} type - Toast type (success, error, warning, info)
 * @param {number} duration - Duration in milliseconds
 */
export function showToast(message, type = 'info', duration = 3000) {
    // Remove existing toasts
    const existingContainer = document.querySelector('.toast-container');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    // Create container
    const container = document.createElement('div');
    container.className = 'toast-container';
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icon mapping
    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };
    
    toast.innerHTML = `
        <span class="material-icons">${icons[type] || 'info'}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    document.body.appendChild(container);
    
    // Auto dismiss
    setTimeout(() => {
        if (container.parentNode) {
            container.remove();
        }
    }, duration);
}

/**
 * Show a loading indicator
 * @param {string} message - Loading message
 * @returns {HTMLElement} Loading element
 */
export function showLoading(message = 'Loading...') {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    overlay.id = 'loading-overlay';
    
    overlay.innerHTML = `
        <div class="bg-white rounded-2xl p-8 text-center max-w-sm w-full mx-4 shadow-2xl">
            <div class="spinner mx-auto"></div>
            <p class="mt-4 text-gray-600 font-medium">${message}</p>
        </div>
    `;
    
    document.body.appendChild(overlay);
    return overlay;
}

/**
 * Hide loading indicator
 */
export function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

/**
 * Create a confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {string} confirmText - Confirm button text
 * @param {string} cancelText - Cancel button text
 * @returns {Promise<boolean>}
 */
export function confirmDialog(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        // Remove existing modals
        const existing = document.querySelector('.modal-overlay');
        if (existing) existing.remove();
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay open';
        
        overlay.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                <div class="modal-body">
                    <p class="text-gray-600">${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="dialog-cancel">${cancelText}</button>
                    <button class="btn btn-primary" id="dialog-confirm">${confirmText}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Handle button clicks
        overlay.querySelector('#dialog-cancel').addEventListener('click', () => {
            overlay.remove();
            resolve(false);
        });
        
        overlay.querySelector('#dialog-confirm').addEventListener('click', () => {
            overlay.remove();
            resolve(true);
        });
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        });
    });
}

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @param {string} format - Format string
 * @returns {string}
 */
export function formatDate(date, format = 'default') {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    
    const options = {
        default: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
        date: { year: 'numeric', month: 'short', day: 'numeric' },
        time: { hour: '2-digit', minute: '2-digit' },
        full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    };
    
    return d.toLocaleDateString('id-ID', options[format] || options.default);
}

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default {
    loadPage,
    showToast,
    showLoading,
    hideLoading,
    confirmDialog,
    formatDate,
    formatFileSize
};
