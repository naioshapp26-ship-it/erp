/**
 * React Hook لإدارة الصلاحيات
 * استخدام: const { permissions, checkPermission, canApprove } = usePermissions();
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export const usePermissions = () => {
    const [permissions, setPermissions] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // جلب صلاحيات المستخدم عند التحميل
    useEffect(() => {
        fetchPermissions();
    }, []);

    const fetchPermissions = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/permissions/my-permissions');
            
            if (response.data.success) {
                setPermissions(response.data.permissions);
                setUserRole(response.data.user_role);
            }
        } catch (err) {
            setError(err.message);
            console.error('خطأ في جلب الصلاحيات:', err);
        } finally {
            setLoading(false);
        }
    };

    // التحقق من صلاحية محددة
    const checkPermission = useCallback((systemCode, action) => {
        if (!permissions || !permissions[systemCode]) {
            return false;
        }

        const systemPermission = permissions[systemCode];

        switch (action) {
            case 'view':
                return systemPermission.can_view;
            case 'create':
                return systemPermission.can_create;
            case 'edit':
                return systemPermission.can_edit;
            case 'delete':
                return systemPermission.can_delete;
            case 'approve':
                return systemPermission.can_approve;
            default:
                return false;
        }
    }, [permissions]);

    // التحقق من حد الموافقة المالية
    const canApprove = useCallback(async (amount) => {
        try {
            const response = await axios.post('/api/permissions/check-approval', { amount });
            return response.data.can_approve;
        } catch (err) {
            console.error('خطأ في التحقق من حد الموافقة:', err);
            return false;
        }
    }, []);

    // الحصول على الأنظمة المتاحة
    const getAvailableSystems = useCallback(async () => {
        try {
            const response = await axios.get('/api/permissions/available-systems');
            return response.data.systems || [];
        } catch (err) {
            console.error('خطأ في جلب الأنظمة:', err);
            return [];
        }
    }, []);

    return {
        permissions,
        userRole,
        loading,
        error,
        checkPermission,
        canApprove,
        getAvailableSystems,
        refetch: fetchPermissions
    };
};

/**
 * مكون React لإخفاء/إظهار العناصر حسب الصلاحية
 * 
 * الاستخدام:
 * <PermissionGuard system="FINANCE" action="create">
 *   <button>إنشاء قيد جديد</button>
 * </PermissionGuard>
 */
export const PermissionGuard = ({ system, action, children, fallback = null }) => {
    const { checkPermission, loading } = usePermissions();

    if (loading) {
        return null;
    }

    const hasPermission = checkPermission(system, action);

    if (!hasPermission) {
        return fallback;
    }

    return children;
};

/**
 * مكون لعرض معلومات دور المستخدم
 */
export const UserRoleDisplay = () => {
    const [roleInfo, setRoleInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRoleInfo = async () => {
            try {
                const response = await axios.get('/api/permissions/my-role');
                if (response.data.success) {
                    setRoleInfo(response.data.role);
                }
            } catch (err) {
                console.error('خطأ في جلب معلومات الدور:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchRoleInfo();
    }, []);

    if (loading) {
        return <div>جاري التحميل...</div>;
    }

    if (!roleInfo) {
        return <div>لا توجد معلومات</div>;
    }

    return (
        <div className="user-role-card">
            <h3>{roleInfo.title_ar}</h3>
            <p>المستوى: {roleInfo.hierarchy_name}</p>
            <p>
                حد الموافقة المالية: {' '}
                {roleInfo.approval_limit.is_unlimited 
                    ? 'غير محدود' 
                    : `${roleInfo.approval_limit.max?.toLocaleString()} ريال`
                }
            </p>
        </div>
    );
};
