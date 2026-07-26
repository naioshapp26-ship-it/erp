// Accordion-based Hierarchy Functions for script.js

// دالة لتبديل عرض محتوى الفرع (Accordion Toggle)
window.toggleBranchAccordion = async function(branchId) {
    const contentDiv = document.getElementById(`branch-content-${branchId}`);
    const icon = document.getElementById(`branch-icon-${branchId}`);
    
    // إذا كان مفتوحاً، أغلقه
    if (contentDiv.classList.contains('hidden')) {
        // فتح الـ accordion
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
        contentDiv.classList.remove('hidden');
        
        // تحميل البيانات إذا لم تُحمل بعد
        if (!contentDiv.dataset.loaded) {
            contentDiv.innerHTML = `
                <div class="flex justify-center items-center py-8">
                    <i class="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
                    <p class="mr-3 text-slate-600">جاري تحميل الحاضنات والمنصات...</p>
                </div>
            `;
            
            try {
                // تحميل الحاضنات والمنصات والمكاتب لهذا الفرع
                const [incubators, platforms, offices] = await Promise.all([
                    fetchAPI(`/api/branches/${branchId}/incubators`),
                    fetchAPI(`/api/branches/${branchId}/platforms`),
                    fetchAPI(`/api/branches/${branchId}/offices`).catch(() => []),
                ]);
                const incubatorList = Array.isArray(incubators) ? incubators : [];
                const platformList = Array.isArray(platforms) ? platforms : [];
                const officeList = Array.isArray(offices) ? offices : [];
                
                // عرض الحاضنات والمنصات والمكاتب
                contentDiv.innerHTML = `
                    <div class="space-y-4 p-4">
                        <!-- Incubators Section -->
                        <div>
                            <div class="flex items-center justify-between mb-3">
                                <h5 class="font-bold text-sm text-slate-700 flex items-center gap-2">
                                    <i class="fas fa-seedling text-green-600"></i>
                                    الحاضنات (${incubatorList.length})
                                </h5>
                                <button onclick="toggleIncubatorsView(${branchId})" 
                                        class="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition">
                                    <i id="inc-toggle-${branchId}" class="fas fa-chevron-down ml-1"></i>
                                    <span id="inc-text-${branchId}">عرض</span>
                                </button>
                            </div>
                            <div id="incubators-list-${branchId}" class="hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                ${incubatorList.map(inc => `
                                    <div class="bg-green-50 border border-green-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                                        <div class="flex items-start justify-between">
                                            <div class="flex-1">
                                                <p class="font-semibold text-sm text-slate-800">${inc.name}</p>
                                                <p class="text-xs text-slate-500 mt-1">${inc.program_type || 'MIXED'}</p>
                                                <p class="text-xs text-slate-400">السعة: ${inc.capacity || 0}</p>
                                            </div>
                                            <i class="fas fa-seedling text-green-400 text-lg"></i>
                                        </div>
                                    </div>
                                `).join('') || '<p class="text-sm text-slate-400 italic col-span-full">لا توجد حاضنات</p>'}
                            </div>
                        </div>
                        
                        <!-- Platforms Section -->
                        <div>
                            <div class="flex items-center justify-between mb-3">
                                <h5 class="font-bold text-sm text-slate-700 flex items-center gap-2">
                                    <i class="fas fa-server text-orange-600"></i>
                                    المنصات (${platformList.length})
                                </h5>
                                <button onclick="togglePlatformsView(${branchId})" 
                                        class="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition">
                                    <i id="plat-toggle-${branchId}" class="fas fa-chevron-down ml-1"></i>
                                    <span id="plat-text-${branchId}">عرض</span>
                                </button>
                            </div>
                            <div id="platforms-list-${branchId}" class="hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                ${platformList.map(plat => `
                                    <div class="bg-orange-50 border border-orange-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                                        <div class="flex items-start justify-between">
                                            <div class="flex-1">
                                                <p class="font-semibold text-sm text-slate-800">${plat.name}</p>
                                                <p class="text-xs text-slate-500 mt-1">${plat.platform_type || 'WEB'}</p>
                                                <p class="text-xs text-slate-400">${plat.pricing_model || 'FREE'} - ${plat.base_price || 0} ${plat.currency || 'SAR'}</p>
                                            </div>
                                            <i class="fas fa-server text-orange-400 text-lg"></i>
                                        </div>
                                    </div>
                                `).join('') || '<p class="text-sm text-slate-400 italic col-span-full">لا توجد منصات</p>'}
                            </div>
                        </div>

                        <!-- Offices Section -->
                        <div>
                            <div class="flex items-center justify-between mb-3">
                                <h5 class="font-bold text-sm text-slate-700 flex items-center gap-2">
                                    <i class="fas fa-building text-sky-600"></i>
                                    المكاتب (${officeList.length})
                                </h5>
                                <button onclick="toggleOfficesView(${branchId})"
                                        class="text-xs px-3 py-1 bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 transition">
                                    <i id="off-toggle-${branchId}" class="fas fa-chevron-down ml-1"></i>
                                    <span id="off-text-${branchId}">عرض</span>
                                </button>
                            </div>
                            <div id="offices-list-${branchId}" class="hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                ${officeList.map(off => `
                                    <div class="bg-sky-50 border border-sky-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                                        <div class="flex items-start justify-between">
                                            <div class="flex-1">
                                                <p class="font-semibold text-sm text-slate-800">${off.name}</p>
                                                <p class="text-xs text-slate-500 mt-1">${off.office_type || 'Office'}</p>
                                                <p class="text-xs text-slate-400">${off.incubator_name || ''} · السعة: ${off.capacity || 0}</p>
                                            </div>
                                            <i class="fas fa-building text-sky-400 text-lg"></i>
                                        </div>
                                    </div>
                                `).join('') || '<p class="text-sm text-slate-400 italic col-span-full">لا توجد مكاتب</p>'}
                            </div>
                        </div>
                    </div>
                `;
                
                contentDiv.dataset.loaded = 'true';
                console.log(`✅ تحميل بيانات الفرع ${branchId}: ${incubatorList.length} حاضنة، ${platformList.length} منصة، ${officeList.length} مكتب`);
                
            } catch (error) {
                console.error('خطأ في تحميل بيانات الفرع:', error);
                contentDiv.innerHTML = `
                    <div class="text-center py-8">
                        <i class="fas fa-exclamation-triangle text-3xl text-red-500 mb-2"></i>
                        <p class="text-sm text-red-600">فشل تحميل البيانات</p>
                    </div>
                `;
            }
        }
    } else {
        // إغلاق الـ accordion
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
        contentDiv.classList.add('hidden');
    }
};

// تبديل عرض الحاضنات
window.toggleIncubatorsView = function(branchId) {
    const list = document.getElementById(`incubators-list-${branchId}`);
    const icon = document.getElementById(`inc-toggle-${branchId}`);
    const text = document.getElementById(`inc-text-${branchId}`);
    
    if (list.classList.contains('hidden')) {
        list.classList.remove('hidden');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
        text.textContent = 'إخفاء';
    } else {
        list.classList.add('hidden');
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
        text.textContent = 'عرض';
    }
};

// تبديل عرض المنصات
window.togglePlatformsView = function(branchId) {
    const list = document.getElementById(`platforms-list-${branchId}`);
    const icon = document.getElementById(`plat-toggle-${branchId}`);
    const text = document.getElementById(`plat-text-${branchId}`);
    
    if (list.classList.contains('hidden')) {
        list.classList.remove('hidden');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
        text.textContent = 'إخفاء';
    } else {
        list.classList.add('hidden');
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
        text.textContent = 'عرض';
    }
};

// تبديل عرض المكاتب
window.toggleOfficesView = function(branchId) {
    const list = document.getElementById(`offices-list-${branchId}`);
    const icon = document.getElementById(`off-toggle-${branchId}`);
    const text = document.getElementById(`off-text-${branchId}`);
    if (!list) return;

    if (list.classList.contains('hidden')) {
        list.classList.remove('hidden');
        if (icon) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        }
        if (text) text.textContent = 'إخفاء';
    } else {
        list.classList.add('hidden');
        if (icon) {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
        if (text) text.textContent = 'عرض';
    }
};

console.log('✅ تم تحميل دوال Accordion للهيكل الهرمي');
