/**
 * أمثلة عملية لاستخدام نظام الصلاحيات في React
 */

import React, { useState } from 'react';
import { usePermissions, PermissionGuard, UserRoleDisplay } from './frontend-permissions-hook';

/**
 * مثال 1: قائمة جانبية تعرض فقط الأنظمة المتاحة للمستخدم
 */
export const Sidebar = () => {
    const { permissions, loading } = usePermissions();

    if (loading) {
        return <div>جاري التحميل...</div>;
    }

    return (
        <nav className="sidebar">
            <h2>الأنظمة</h2>
            <ul>
                {permissions?.HR?.can_view && (
                    <li><a href="/hr">الموارد البشرية</a></li>
                )}
                {permissions?.FINANCE?.can_view && (
                    <li><a href="/finance">الحسابات</a></li>
                )}
                {permissions?.PROCUREMENT?.can_view && (
                    <li><a href="/procurement">المشتريات</a></li>
                )}
                {permissions?.SALES?.can_view && (
                    <li><a href="/sales">المبيعات</a></li>
                )}
                {permissions?.MARKETING?.can_view && (
                    <li><a href="/marketing">التسويق</a></li>
                )}
                {permissions?.SUPPLY_CHAIN?.can_view && (
                    <li><a href="/supply-chain">سلسلة التوريد</a></li>
                )}
                {permissions?.SAFETY?.can_view && (
                    <li><a href="/safety">السلامة</a></li>
                )}
                {permissions?.WAREHOUSE?.can_view && (
                    <li><a href="/warehouse">المستودعات</a></li>
                )}
            </ul>
        </nav>
    );
};

/**
 * مثال 2: صفحة الحسابات مع أزرار مشروطة حسب الصلاحية
 */
export const FinancePage = () => {
    const { checkPermission } = usePermissions();

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>الحسابات</h1>
                <div className="action-buttons">
                    {/* زر الإنشاء يظهر فقط للذين لديهم صلاحية الإنشاء */}
                    <PermissionGuard system="FINANCE" action="create">
                        <button className="btn-primary">
                            إنشاء قيد جديد
                        </button>
                    </PermissionGuard>
                </div>
            </div>

            <div className="content">
                {/* جدول البيانات */}
                <FinanceTable />
            </div>
        </div>
    );
};

/**
 * مثال 3: جدول مع أزرار تحرير/حذف مشروطة
 */
export const FinanceTable = () => {
    const { checkPermission } = usePermissions();
    const [entries, setEntries] = useState([
        { id: 1, description: 'قيد مبيعات', amount: 5000 },
        { id: 2, description: 'قيد مشتريات', amount: 3000 },
    ]);

    const canEdit = checkPermission('FINANCE', 'edit');
    const canDelete = checkPermission('FINANCE', 'delete');

    return (
        <table>
            <thead>
                <tr>
                    <th>الرقم</th>
                    <th>الوصف</th>
                    <th>المبلغ</th>
                    {(canEdit || canDelete) && <th>الإجراءات</th>}
                </tr>
            </thead>
            <tbody>
                {entries.map(entry => (
                    <tr key={entry.id}>
                        <td>{entry.id}</td>
                        <td>{entry.description}</td>
                        <td>{entry.amount.toLocaleString()} ريال</td>
                        {(canEdit || canDelete) && (
                            <td>
                                {canEdit && (
                                    <button className="btn-edit">تعديل</button>
                                )}
                                {canDelete && (
                                    <button className="btn-delete">حذف</button>
                                )}
                            </td>
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

/**
 * مثال 4: نموذج الموافقة المالية
 */
export const ApprovalForm = () => {
    const { canApprove, userRole } = usePermissions();
    const [amount, setAmount] = useState('');
    const [canApproveAmount, setCanApproveAmount] = useState(false);
    const [checking, setChecking] = useState(false);

    const handleAmountChange = async (e) => {
        const value = e.target.value;
        setAmount(value);

        if (value) {
            setChecking(true);
            const result = await canApprove(parseFloat(value));
            setCanApproveAmount(result);
            setChecking(false);
        }
    };

    return (
        <div className="approval-form">
            <h2>طلب موافقة مالية</h2>
            
            <div className="form-group">
                <label>المبلغ (ريال):</label>
                <input
                    type="number"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="أدخل المبلغ"
                />
            </div>

            {amount && !checking && (
                <div className={`approval-status ${canApproveAmount ? 'success' : 'error'}`}>
                    {canApproveAmount ? (
                        <p>✓ لديك صلاحية الموافقة على هذا المبلغ</p>
                    ) : (
                        <p>✗ هذا المبلغ يتجاوز حد الموافقة الخاص بك</p>
                    )}
                </div>
            )}

            <button 
                className="btn-submit" 
                disabled={!canApproveAmount || checking}
            >
                {checking ? 'جاري التحقق...' : 'إرسال للموافقة'}
            </button>
        </div>
    );
};

/**
 * مثال 5: لوحة التحكم الرئيسية
 */
export const Dashboard = () => {
    const { permissions, userRole, loading } = usePermissions();
    const [stats, setStats] = useState([]);

    if (loading) {
        return <div className="loading">جاري التحميل...</div>;
    }

    return (
        <div className="dashboard">
            <div className="user-info">
                <UserRoleDisplay />
            </div>

            <div className="stats-grid">
                {permissions?.FINANCE?.can_view && (
                    <div className="stat-card">
                        <h3>الحسابات</h3>
                        <p className="stat-value">125</p>
                        <p className="stat-label">قيد محاسبي</p>
                    </div>
                )}

                {permissions?.HR?.can_view && (
                    <div className="stat-card">
                        <h3>الموارد البشرية</h3>
                        <p className="stat-value">58</p>
                        <p className="stat-label">موظف</p>
                    </div>
                )}

                {permissions?.SALES?.can_view && (
                    <div className="stat-card">
                        <h3>المبيعات</h3>
                        <p className="stat-value">342</p>
                        <p className="stat-label">فاتورة</p>
                    </div>
                )}

                {permissions?.WAREHOUSE?.can_view && (
                    <div className="stat-card">
                        <h3>المستودعات</h3>
                        <p className="stat-value">1,247</p>
                        <p className="stat-label">صنف</p>
                    </div>
                )}
            </div>

            <div className="quick-actions">
                <h2>الإجراءات السريعة</h2>
                <div className="actions-grid">
                    <PermissionGuard system="FINANCE" action="create">
                        <button className="action-btn">إنشاء قيد محاسبي</button>
                    </PermissionGuard>

                    <PermissionGuard system="HR" action="create">
                        <button className="action-btn">إضافة موظف جديد</button>
                    </PermissionGuard>

                    <PermissionGuard system="SALES" action="create">
                        <button className="action-btn">إنشاء فاتورة مبيعات</button>
                    </PermissionGuard>

                    <PermissionGuard system="PROCUREMENT" action="create">
                        <button className="action-btn">طلب شراء جديد</button>
                    </PermissionGuard>
                </div>
            </div>

            {/* قسم الموافقات - يظهر فقط للمديرين */}
            {userRole?.hierarchy_level <= 2 && (
                <div className="pending-approvals">
                    <h2>الموافقات المعلقة</h2>
                    <PendingApprovalsList />
                </div>
            )}
        </div>
    );
};

/**
 * مثال 6: قائمة الموافقات المعلقة
 */
const PendingApprovalsList = () => {
    const { checkPermission } = usePermissions();
    const [approvals, setApprovals] = useState([
        { id: 1, type: 'طلب شراء', amount: 15000, requester: 'أحمد محمد' },
        { id: 2, type: 'إجازة موظف', amount: 0, requester: 'فاطمة علي' },
    ]);

    const canApproveFinance = checkPermission('FINANCE', 'approve');
    const canApproveHR = checkPermission('HR', 'approve');

    return (
        <div className="approvals-list">
            {approvals.map(approval => (
                <div key={approval.id} className="approval-item">
                    <div className="approval-info">
                        <h4>{approval.type}</h4>
                        <p>الطالب: {approval.requester}</p>
                        {approval.amount > 0 && (
                            <p>المبلغ: {approval.amount.toLocaleString()} ريال</p>
                        )}
                    </div>
                    <div className="approval-actions">
                        {((approval.type.includes('شراء') && canApproveFinance) ||
                          (approval.type.includes('إجازة') && canApproveHR)) && (
                            <>
                                <button className="btn-approve">موافقة</button>
                                <button className="btn-reject">رفض</button>
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Dashboard;
