/**
 * RBAC System - Role-Based Access Control
 * نظام الأدوار والصلاحيات والحوكمة وسجل المراجعات
 */

class RBACSystem {
    constructor() {
        this.userRoles = [];
        this.userPermissions = [];
        this.governanceRules = [];
        this.initialized = false;
    }

    /**
     * تهيئة النظام للمستخدم الحالي
     */
    async initialize(userId, entityId) {
        try {
            console.log('🔐 Initializing RBAC System...');
            
            // جلب أدوار المستخدم
            this.userRoles = await this.fetchUserRoles(userId, entityId);
            
            // جلب صلاحيات المستخدم
            this.userPermissions = await this.fetchUserPermissions(userId);
            
            // جلب قواعد الحوكمة
            this.governanceRules = await this.fetchGovernanceRules();
            
            this.initialized = true;
            console.log('✅ RBAC System initialized', {
                roles: this.userRoles.length,
                permissions: this.userPermissions.length,
                rules: this.governanceRules.length
            });
            
            return true;
        } catch (error) {
            console.error('❌ RBAC initialization failed:', error);
            return false;
        }
    }

    /**
     * التحقق من وجود صلاحية معينة
     */
    hasPermission(permission) {
        if (!this.initialized) {
            console.warn('⚠️ RBAC not initialized');
            return false;
        }
        
        // Super Admin له كل الصلاحيات
        if (this.hasRole('SUPER_ADMIN')) {
            return true;
        }
        
        return this.userPermissions.some(p => p.name === permission);
    }

    /**
     * التحقق من وجود دور معين
     */
    hasRole(roleName) {
        if (!this.initialized) {
            console.warn('⚠️ RBAC not initialized');
            return false;
        }
        
        return this.userRoles.some(r => r.name === roleName && r.is_active);
    }

    /**
     * التحقق من صلاحية على مورد معين
     */
    can(action, resource, entityId = null) {
        const permissionName = `${resource}.${action}`;
        
        if (!this.hasPermission(permissionName)) {
            console.log(`🚫 Permission denied: ${permissionName}`);
            return false;
        }
        
        // التحقق من النطاق إذا كان محدد
        if (entityId) {
            return this.hasAccessToEntity(entityId);
        }
        
        return true;
    }

    /**
     * التحقق من الوصول لكيان معين
     */
    hasAccessToEntity(entityId) {
        // Super Admin له وصول لكل شيء
        if (this.hasRole('SUPER_ADMIN')) {
            return true;
        }
        
        // التحقق من أن المستخدم له صلاحية على هذا الكيان
        return this.userRoles.some(r => 
            r.is_active && (r.entity_id === entityId || r.entity_id === null)
        );
    }

    /**
     * التحقق من قواعد الحوكمة
     */
    async checkGovernance(action, resource, data = {}) {
        const applicableRules = this.governanceRules.filter(rule => 
            rule.resource === resource && rule.is_active
        );
        
        for (const rule of applicableRules) {
            const conditions = JSON.parse(rule.conditions || '{}');
            
            // التحقق من الشروط
            if (this.matchesConditions(conditions, data)) {
                console.log(`🔒 Governance rule triggered: ${rule.name_ar}`);
                
                if (rule.action_required === 'APPROVE') {
                    return {
                        requiresApproval: true,
                        rule: rule,
                        approversRequired: rule.approvers_required
                    };
                } else if (rule.action_required === 'BLOCK') {
                    return {
                        blocked: true,
                        reason: rule.name_ar
                    };
                }
            }
        }
        
        return { requiresApproval: false, blocked: false };
    }

    /**
     * مطابقة الشروط
     */
    matchesConditions(conditions, data) {
        // التحقق من المبالغ المالية
        if (conditions.amount_greater_than && data.amount) {
            if (parseFloat(data.amount) <= conditions.amount_greater_than) {
                return false;
            }
        }
        
        // التحقق من نوع العملية
        if (conditions.action && conditions.action !== data.action) {
            return false;
        }
        
        return true;
    }

    /**
     * تسجيل في Audit Log
     */
    async logAction(action, resourceType, resourceId, data = {}) {
        try {
            const auditEntry = {
                user_id: currentUser?.id,
                user_name: currentUser?.name,
                entity_id: currentUser?.entityId,
                action: action,
                resource_type: resourceType,
                resource_id: resourceId,
                old_value: data.oldValue ? JSON.stringify(data.oldValue) : null,
                new_value: data.newValue ? JSON.stringify(data.newValue) : null,
                ip_address: data.ipAddress || null,
                user_agent: navigator.userAgent,
                reason: data.reason || null,
                status: data.status || 'SUCCESS'
            };
            
            // إرسال إلى السيرفر
            await fetch(`${API_BASE_URL}/audit-logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(auditEntry)
            });
            
            console.log('✅ Audit log recorded:', action);
        } catch (error) {
            console.error('❌ Failed to log action:', error);
        }
    }

    /**
     * طلب موافقة
     */
    async requestApproval(resourceType, resourceId, action, reason = null) {
        try {
            const approvalRequest = {
                resource_type: resourceType,
                resource_id: resourceId,
                action: action,
                requested_by: currentUser?.id,
                comments: reason,
                status: 'PENDING'
            };
            
            const response = await fetch(`${API_BASE_URL}/approvals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(approvalRequest)
            });
            
            if (response.ok) {
                console.log('✅ Approval requested');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ Failed to request approval:', error);
            return false;
        }
    }

    /**
     * جلب أدوار المستخدم من الـ Mock Data أو API
     */
    async fetchUserRoles(userId, entityId) {
        // Mock data للتطوير
        if (currentUser?.role === 'Super Admin') {
            return [
                { name: 'SUPER_ADMIN', is_active: true, entity_id: null }
            ];
        } else if (currentUser?.role === 'Manager') {
            return [
                { name: 'MANAGER', is_active: true, entity_id: entityId }
            ];
        } else {
            return [
                { name: 'EMPLOYEE', is_active: true, entity_id: entityId }
            ];
        }
    }

    /**
     * جلب صلاحيات المستخدم
     */
    async fetchUserPermissions(userId) {
        // Mock data - في الواقع يجب جلبها من API
        if (currentUser?.role === 'Super Admin') {
            return [
                { name: 'users.create' },
                { name: 'users.read' },
                { name: 'users.update' },
                { name: 'users.delete' },
                { name: 'entities.create' },
                { name: 'entities.read' },
                { name: 'entities.update' },
                { name: 'entities.delete' },
                { name: 'invoices.create' },
                { name: 'invoices.read' },
                { name: 'invoices.update' },
                { name: 'invoices.delete' },
                { name: 'invoices.approve' },
                { name: 'transactions.create' },
                { name: 'transactions.read' },
                { name: 'transactions.approve' },
                { name: 'employees.create' },
                { name: 'employees.read' },
                { name: 'employees.update' },
                { name: 'employees.delete' },
                { name: 'reports.read' },
                { name: 'reports.export' },
                { name: 'audit.read' },
                { name: 'settings.read' },
                { name: 'settings.update' },
                { name: 'roles.manage' },
                { name: 'permissions.manage' }
            ];
        } else if (currentUser?.role === 'Manager') {
            return [
                { name: 'users.read' },
                { name: 'entities.read' },
                { name: 'invoices.read' },
                { name: 'invoices.create' },
                { name: 'invoices.update' },
                { name: 'employees.read' },
                { name: 'employees.update' },
                { name: 'reports.read' }
            ];
        } else {
            return [
                { name: 'invoices.read' },
                { name: 'reports.read' }
            ];
        }
    }

    /**
     * جلب قواعد الحوكمة
     */
    async fetchGovernanceRules() {
        // Mock data
        return [
            {
                name: 'INVOICE_APPROVAL_10K',
                name_ar: 'الموافقة على الفواتير أكبر من 10,000 ريال',
                resource: 'invoices',
                conditions: JSON.stringify({ amount_greater_than: 10000 }),
                action_required: 'APPROVE',
                approvers_required: 1,
                is_active: true
            },
            {
                name: 'INVOICE_APPROVAL_50K',
                name_ar: 'الموافقة على الفواتير أكبر من 50,000 ريال',
                resource: 'invoices',
                conditions: JSON.stringify({ amount_greater_than: 50000 }),
                action_required: 'APPROVE',
                approvers_required: 2,
                is_active: true
            },
            {
                name: 'TRANSACTION_DUAL_CONTROL',
                name_ar: 'رقابة ثنائية على المعاملات المالية',
                resource: 'transactions',
                conditions: JSON.stringify({ amount_greater_than: 5000 }),
                action_required: 'APPROVE',
                approvers_required: 2,
                is_active: true
            }
        ];
    }

    /**
     * دوال مساعدة للاستخدام السهل
     */
    canCreate(resource) { return this.can('create', resource); }
    canRead(resource) { return this.can('read', resource); }
    canUpdate(resource) { return this.can('update', resource); }
    canDelete(resource) { return this.can('delete', resource); }
    canApprove(resource) { return this.can('approve', resource); }
    canExport(resource) { return this.can('export', resource); }
}

// تهيئة النظام عند تحميل الصفحة
const rbac = new RBACSystem();

// دالة للتهيئة التلقائية عند تسجيل الدخول
window.initializeRBAC = async function() {
    if (currentUser) {
        await rbac.initialize(currentUser.id, currentUser.entityId);
        
        // تسجيل تسجيل الدخول
        await rbac.logAction('LOGIN', 'user', currentUser.id, {
            status: 'SUCCESS'
        });
    }
};

// تصدير للاستخدام العام
window.rbac = rbac;

console.log('🔐 RBAC System loaded');
