// Optimized Hierarchy View with Lazy Loading
// This code should replace the renderHierarchy function in script.js

const renderHierarchyOptimized = async () => {
    try {
        // جلب الإحصائيات فقط في البداية
        const stats = await fetchAPI('/hierarchy/stats');
        const branches = await fetchAPI('/branches');
        
        return `
        <div class="space-y-8 animate-fade-in">
            <!-- Header -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 class="text-2xl font-bold text-slate-800">الهيكل الهرمي للمنصة</h2>
                    <p class="text-slate-500">عرض شامل للمقرات → الفروع → الحاضنات → المنصات → المكاتب</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="app.refreshHierarchy()" class="bg-brand-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-brand-700 transition flex items-center gap-2">
                        <i class="fas fa-sync-alt"></i> تحديث
                    </button>
                </div>
            </div>

            <!-- Stats Cards -->
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                    <div class="flex items-center justify-between mb-2">
                        <i class="fas fa-building text-2xl opacity-80"></i>
                        <span class="text-3xl font-black">${stats.active_hqs || 0}</span>
                    </div>
                    <p class="text-xs font-semibold opacity-90">مقرات رئيسية</p>
                </div>
                <div class="bg-gradient-to-br from-red-500 to-blue-600 rounded-xl p-4 text-white">
                    <div class="flex items-center justify-between mb-2">
                        <i class="fas fa-map-marked-alt text-2xl opacity-80"></i>
                        <span class="text-3xl font-black">${stats.active_branches || 0}</span>
                    </div>
                    <p class="text-xs font-semibold opacity-90">فروع</p>
                </div>
                <div class="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
                    <div class="flex items-center justify-between mb-2">
                        <i class="fas fa-seedling text-2xl opacity-80"></i>
                        <span class="text-3xl font-black">${stats.active_incubators || 0}</span>
                    </div>
                    <p class="text-xs font-semibold opacity-90">حاضنات</p>
                </div>
                <div class="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
                    <div class="flex items-center justify-between mb-2">
                        <i class="fas fa-server text-2xl opacity-80"></i>
                        <span class="text-3xl font-black">${stats.active_platforms || 0}</span>
                    </div>
                    <p class="text-xs font-semibold opacity-90">منصات</p>
                </div>
                <div class="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white">
                    <div class="flex items-center justify-between mb-2">
                        <i class="fas fa-briefcase text-2xl opacity-80"></i>
                        <span class="text-3xl font-black">${stats.active_offices || 0}</span>
                    </div>
                    <p class="text-xs font-semibold opacity-90">مكاتب</p>
                </div>
                <div class="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-4 text-white">
                    <div class="flex items-center justify-between mb-2">
                        <i class="fas fa-link text-2xl opacity-80"></i>
                        <span class="text-3xl font-black">${stats.active_links || 0}</span>
                    </div>
                    <p class="text-xs font-semibold opacity-90">روابط</p>
                </div>
            </div>

            <!-- Entity Creation Buttons -->
            <div class="bg-white rounded-2xl shadow-lg border-2 border-slate-200 overflow-hidden">
                <div class="bg-gradient-to-r from-slate-700 to-slate-800 p-6 text-white">
                    <div class="flex items-center gap-4">
                        <div class="bg-white/20 rounded-full p-3">
                            <i class="fas fa-plus-circle text-2xl"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black">تعريف الكيانات</h3>
                            <p class="text-sm opacity-90">إنشاء وإضافة كيانات جديدة للهيكل التنظيمي</p>
                        </div>
                    </div>
                </div>
                
                <div class="p-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <!-- Create Office Button -->
                        <button onclick="openCreateOfficeModal()" 
                                class="group bg-gradient-to-br from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
                            <div class="flex flex-col items-center gap-3">
                                <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition">
                                    <i class="fas fa-briefcase text-3xl"></i>
                                </div>
                                <div class="text-center">
                                    <h4 class="font-black text-lg mb-1">إنشاء مكتب</h4>
                                    <p class="text-xs opacity-90">Office تابع لحاضنة/منصة</p>
                                </div>
                            </div>
                        </button>
                        
                        <!-- Create Platform Button -->
                        <button onclick="openCreatePlatformModal()" 
                                class="group bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
                            <div class="flex flex-col items-center gap-3">
                                <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition">
                                    <i class="fas fa-server text-3xl"></i>
                                </div>
                                <div class="text-center">
                                    <h4 class="font-black text-lg mb-1">إنشاء منصة</h4>
                                    <p class="text-xs opacity-90">Platform تابع لحاضنة</p>
                                </div>
                            </div>
                        </button>
                        
                        <!-- Create Incubator Button -->
                        <button onclick="openCreateIncubatorModal()" 
                                class="group bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
                            <div class="flex flex-col items-center gap-3">
                                <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition">
                                    <i class="fas fa-seedling text-3xl"></i>
                                </div>
                                <div class="text-center">
                                    <h4 class="font-black text-lg mb-1">إنشاء حاضنة</h4>
                                    <p class="text-xs opacity-90">Incubator تابع لفرع</p>
                                </div>
                            </div>
                        </button>
                        
                        <!-- Create Branch Button -->
                        <button onclick="openCreateBranchModal()" 
                                class="group bg-gradient-to-br from-red-500 to-blue-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
                            <div class="flex flex-col items-center gap-3">
                                <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition">
                                    <i class="fas fa-store text-3xl"></i>
                                </div>
                                <div class="text-center">
                                    <h4 class="font-black text-lg mb-1">إنشاء فرع</h4>
                                    <p class="text-xs opacity-90">Branch تابع للمقر الرئيسي</p>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Branches List with Expandable Content -->
            <div class="bg-white rounded-2xl shadow-lg border-2 border-purple-200 overflow-hidden">
                <div class="bg-gradient-to-r from-purple-600 to-purple-700 p-6 text-white">
                    <div class="flex items-center gap-4">
                        <div class="bg-white/20 rounded-full p-3">
                            <i class="fas fa-sitemap text-2xl"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black">الفروع والكيانات التابعة</h3>
                            <p class="text-sm opacity-90">انقر على أي فرع لعرض الحاضنات والمنصات التابعة له</p>
                        </div>
                    </div>
                </div>

                <div class="p-6 space-y-4">
                    ${branches.map(branch => `
                        <div class="border-2 border-blue-200 bg-blue-50 rounded-xl overflow-hidden">
                            <!-- Branch Header (Always Visible) -->
                            <div class="p-4 flex items-center justify-between cursor-pointer hover:bg-blue-100 transition-colors"
                                 onclick="toggleBranchContent(${branch.id})">
                                <div class="flex items-center gap-3">
                                    <i class="fas fa-map-marked-alt text-xl text-blue-600"></i>
                                    <div>
                                        <h4 class="font-bold text-slate-800">${branch.name}</h4>
                                        <p class="text-xs text-slate-500">${branch.code} | ${branch.city || ''}, ${branch.country || ''}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-3">
                                    <span class="text-xs font-bold px-3 py-1 rounded-full ${branch.is_active ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}">
                                        ${branch.is_active ? 'فعال' : 'معطل'}
                                    </span>
                                    <i class="fas fa-chevron-down transition-transform duration-300" id="chevron-${branch.id}"></i>
                                </div>
                            </div>

                            <!-- Branch Content (Lazy Loaded) -->
                            <div id="branch-content-${branch.id}" class="hidden p-4 pt-0 space-y-3">
                                <div class="text-center py-4">
                                    <i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i>
                                    <p class="text-sm text-slate-500 mt-2">جاري تحميل البيانات...</p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            ${branches.length === 0 ? `
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                    <i class="fas fa-inbox text-6xl text-slate-300 mb-4"></i>
                    <h3 class="text-xl font-bold text-slate-700 mb-2">لا توجد فروع</h3>
                    <p class="text-slate-500">لم يتم إنشاء أي فرع بعد</p>
                </div>
            ` : ''}
        </div>`;
    } catch (error) {
        console.error('Error loading hierarchy:', error);
        showToast('فشل تحميل الهيكل الهرمي', 'error');
        return `
        <div class="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
            <h3 class="text-xl font-bold text-red-700 mb-2">خطأ في التحميل</h3>
            <p class="text-red-600">${error.message}</p>
        </div>`;
    }
};

// Toggle Branch Content with Lazy Loading
async function toggleBranchContent(branchId) {
    const contentDiv = document.getElementById(`branch-content-${branchId}`);
    const chevron = document.getElementById(`chevron-${branchId}`);
    
    if (contentDiv.classList.contains('hidden')) {
        // إظهار المحتوى
        contentDiv.classList.remove('hidden');
        chevron.classList.add('rotate-180');
        
        // تحميل البيانات إذا لم تكن محملة
        if (contentDiv.dataset.loaded !== 'true') {
            await loadBranchDetails(branchId);
        }
    } else {
        // إخفاء المحتوى
        contentDiv.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }
}

// Load Branch Details (Incubators and Platforms)
async function loadBranchDetails(branchId) {
    const contentDiv = document.getElementById(`branch-content-${branchId}`);
    
    try {
        // جلب البيانات
        const incubators = await fetchAPI(`/branches/${branchId}/incubators`);
        
        // عرض أول 10 حاضنات فقط
        const displayLimit = 10;
        const limitedIncubators = incubators.slice(0, displayLimit);
        const hasMore = incubators.length > displayLimit;
        
        contentDiv.innerHTML = `
            <div class="space-y-3">
                <p class="text-xs font-bold text-slate-600 flex items-center gap-2">
                    <i class="fas fa-seedling text-green-500"></i> 
                    الحاضنات (عرض ${limitedIncubators.length} من ${incubators.length})
                </p>
                
                ${limitedIncubators.length > 0 ? limitedIncubators.map(inc => `
                    <div class="bg-green-50 border border-green-200 rounded-lg p-3 hover:bg-green-100 transition-colors cursor-pointer"
                         onclick="viewIncubatorDetails(${inc.id})">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-seedling text-green-600"></i>
                                <div>
                                    <p class="text-sm font-semibold text-slate-800">${inc.name}</p>
                                    <p class="text-xs text-slate-500">${inc.code} | ${inc.program_type || 'MIXED'}</p>
                                </div>
                            </div>
                            <i class="fas fa-chevron-left text-green-400"></i>
                        </div>
                    </div>
                `).join('') : '<p class="text-sm text-slate-400 italic">لا توجد حاضنات في هذا الفرع</p>'}
                
                ${hasMore ? `
                    <button onclick="loadAllIncubators(${branchId})" 
                            class="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition">
                        <i class="fas fa-plus ml-1"></i> عرض جميع الحاضنات (${incubators.length})
                    </button>
                ` : ''}
            </div>
        `;
        
        contentDiv.dataset.loaded = 'true';
    } catch (error) {
        console.error('Error loading branch details:', error);
        contentDiv.innerHTML = `
            <div class="text-center py-4 text-red-600">
                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                <p class="text-sm">فشل تحميل البيانات</p>
            </div>
        `;
    }
}

// View Incubator Details in Modal or New Page
function viewIncubatorDetails(incubatorId) {
    // TODO: Implement incubator details view
    console.log('View incubator:', incubatorId);
    showToast(`عرض تفاصيل الحاضنة رقم ${incubatorId}`, 'info');
}
