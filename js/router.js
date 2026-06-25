/**
 * Router Module - Handles page navigation
 * @module router
 */

import { loadPage } from './ui.js';
import { isAuthenticated } from './auth.js';

// Route definitions
const routes = {
    '/': 'splash',
    '/login': 'login',
    '/dashboard': 'dashboard',
    '/price-checker': 'price-checker',
    '/download': 'download',
    '/settings': 'settings',
    '/history': 'history',
    '/about': 'about'
};

// Protected routes that require authentication
const protectedRoutes = [
    '/dashboard',
    '/price-checker',
    '/download',
    '/settings',
    '/history',
    '/about'
];

export class Router {
    constructor() {
        this.currentRoute = null;
        this.currentPage = null;
        this.container = document.getElementById('router-view');
        this.initialized = false;
    }

    /**
     * Initialize router
     */
    async init() {
        if (this.initialized) return;
        
        // Listen to popstate events
        window.addEventListener('popstate', (event) => {
            this.navigate(event.state?.path || window.location.pathname, false);
        });
        
        // Handle initial load
        const path = window.location.pathname || '/';
        await this.navigate(path, false);
        
        this.initialized = true;
        console.log('[Router] Initialized');
    }

    /**
     * Navigate to a specific route
     * @param {string} path - Route path
     * @param {boolean} pushState - Whether to push to history
     */
    async navigate(path, pushState = true) {
        try {
            // Normalize path
            path = path || '/';
            const routeName = routes[path] || '404';
            
            // Check authentication for protected routes
            if (protectedRoutes.includes(path)) {
                const auth = isAuthenticated();
                if (!auth) {
                    console.log('[Router] Unauthorized access to:', path);
                    await this.navigate('/login', pushState);
                    return;
                }
            }
            
            // Load the page
            const pageContent = await loadPage(routeName);
            
            // Update the view
            if (this.container) {
                this.container.innerHTML = '';
                this.container.appendChild(pageContent);
            }
            
            // Update current route
            this.currentRoute = path;
            
            // Push state if requested
            if (pushState && window.location.pathname !== path) {
                window.history.pushState({ path }, '', path);
            }
            
            console.log('[Router] Navigated to:', path);
            
            // Dispatch navigation event
            window.dispatchEvent(new CustomEvent('route-change', {
                detail: { path, routeName }
            }));
            
        } catch (error) {
            console.error('[Router] Navigation error:', error);
            // Show error page
            if (this.container) {
                this.container.innerHTML = `
                    <div class="flex items-center justify-center min-h-screen p-4">
                        <div class="text-center">
                            <span class="material-icons text-6xl text-red-500">error</span>
                            <h2 class="text-xl font-bold mt-4">Page Not Found</h2>
                            <p class="text-gray-500 mt-2">The page you're looking for doesn't exist.</p>
                            <button onclick="window.router.navigate('/dashboard')" 
                                    class="mt-4 btn btn-primary">
                                Go to Dashboard
                            </button>
                        </div>
                    </div>
                `;
            }
        }
    }

    /**
     * Get current route
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * Navigate back
     */
    goBack() {
        window.history.back();
    }

    /**
     * Navigate forward
     */
    goForward() {
        window.history.forward();
    }
}

// Create router instance
export const router = new Router();

// Make router available globally for debugging
window.router = router;