/**
 * Performance Optimization Module
 * Adds caching, lazy loading, and loading indicators
 */

(function() {
    // Cache for API responses
    const apiCache = {
        data: {},
        timestamps: {},
        TTL: 5 * 60 * 1000, // 5 minutes
        
        set(key, value) {
            this.data[key] = value;
            this.timestamps[key] = Date.now();
        },
        
        get(key) {
            if (!this.data[key]) return null;
            
            // Check if expired
            const age = Date.now() - this.timestamps[key];
            if (age > this.TTL) {
                delete this.data[key];
                delete this.timestamps[key];
                return null;
            }
            
            return this.data[key];
        },
        
        clear() {
            this.data = {};
            this.timestamps = {};
        },
        
        invalidate(pattern) {
            Object.keys(this.data).forEach(key => {
                if (key.includes(pattern)) {
                    delete this.data[key];
                    delete this.timestamps[key];
                }
            });
        }
    };
    
    // Expose cache globally
    window.apiCache = apiCache;
    
    // Loading indicator
    function showLoading(container) {
        if (!container) return;
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 gap-4">
                <div class="relative">
                    <div class="animate-spin rounded-full h-16 w-16 border-4 border-red-200"></div>
                    <div class="animate-spin rounded-full h-16 w-16 border-4 border-red-600 border-t-transparent absolute top-0 left-0" style="animation-direction: reverse;"></div>
                </div>
                <p class="text-slate-600 font-semibold animate-pulse">جاري التحميل...</p>
            </div>
        `;
    }
    
    // Enhanced fetchAPI with caching - This will be used by script.js
    window.cachedFetchAPI = async function(endpoint, options = {}, useCache = true) {
        const cacheKey = `${endpoint}_${JSON.stringify(options)}`;
        
        // Check cache first (only for GET requests)
        if (useCache && (!options.method || options.method === 'GET')) {
            const cached = apiCache.get(cacheKey);
            if (cached) {
                console.log(`📦 [Cache] Hit for ${endpoint}`);
                return cached;
            }
        }
        
        // Fetch from API using the global fetchAPI (defined in script.js)
        console.log(`🌐 [Cache] Miss for ${endpoint}, fetching...`);
        
        // Call the original fetchAPI from script.js app module
        const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3000/api'
            : '/api';
            
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        if (authToken && !headers.Authorization) {
            headers.Authorization = `Bearer ${authToken}`;
        }
        
        // إضافة headers عزل البيانات
        const user = window.currentUser || window.currentUserData;
        if (user) {
            const tenantType = user.tenantType || user.tenant_type;
            const entityId = user.entityId || user.entity_id;
            headers['x-entity-type'] = tenantType;
            headers['x-entity-id'] = entityId;
        }
        
        const normalizedEndpoint = endpoint.startsWith('/api/')
            ? endpoint.substring(4)
            : endpoint;
        const finalEndpoint = normalizedEndpoint.startsWith('/')
            ? normalizedEndpoint
            : `/${normalizedEndpoint}`;
        const url = `${API_BASE_URL}${finalEndpoint}`;
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`HTTP error! status: ${response.status} for ${endpoint} - ${body}`);
        }
        
        const data = await response.json();
        
        // Cache the result (only for GET requests)
        if (useCache && (!options.method || options.method === 'GET')) {
            apiCache.set(cacheKey, data);
        }
        
        return data;
    };
    
    // Debounce function for search/filter inputs
    window.debounce = function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };
    
    // Lazy load images
    function lazyLoadImages() {
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
    }
    
    // Initialize lazy loading when DOM changes
    const observer = new MutationObserver(debounce(lazyLoadImages, 200));
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Expose utilities
    window.performanceUtils = {
        showLoading,
        lazyLoadImages,
        cache: apiCache
    };
    
    console.log('✅ Performance optimization module loaded');
})();
