'use strict';

const HR_HOME_MODULES = [
  { key: 'employees', href: '/hr/employees', label: 'النظام الإداري والموارد البشرية', icon: 'fa-briefcase', category: 'تشغيل', manager: true },
  { key: 'operations', href: '/hr/operations', label: 'بوابة العمليات والطلبات', icon: 'fa-diagram-project', category: 'طلبات', manager: true },
  { key: 'policies', href: '/hr/policies', label: 'السياسات والاجراءات', icon: 'fa-scale-balanced', category: 'تشغيل' },
  { key: 'accepted-employees', href: '/hr/accepted-employees', label: 'الموظفون المقبولون', icon: 'fa-user-check', category: 'موظفون', manager: true },
  { key: 'new-hires', href: '/hr/new-hires', label: 'تعيين الموظفين الجداد', icon: 'fa-user-plus', category: 'موظفون', manager: true },
  { key: 'requests', href: '/hr/requests', label: 'معالجة الطلبات', icon: 'fa-inbox', category: 'طلبات', manager: true },
  { key: 'my-requests', href: '/hr/my-requests', label: 'تقديم ومتابعة الطلبات', icon: 'fa-file-signature', category: 'طلبات', manager: true },
  { key: 'pending-actions', href: '/hr/pending-actions', label: 'عمليات بانتظار إجراء', icon: 'fa-bell', category: 'طلبات', manager: true },
  { key: 'assets-custodies', href: '/hr/assets-custodies', label: 'إدارة العهد والأصول', icon: 'fa-boxes-stacked', category: 'تشغيل', manager: true },
  { key: 'attendance-departure', href: '/hr/attendance-departure', label: 'سجلات الحضور والانصراف', icon: 'fa-clock', category: 'حضور' },
  { key: 'attendance-hub', href: '/hr/attendance-hub', label: 'مركز الحضور والنوبات الذكي', icon: 'fa-stopwatch', category: 'حضور' },
  { key: 'payroll', href: '/hr/payroll', label: 'تبسيط ادارة الرواتب', icon: 'fa-sack-dollar', category: 'مالية', manager: true },
  { key: 'employee-360', href: '/hr/employee-360', label: 'ملف الموظف 360°', icon: 'fa-id-card', category: 'موظفون' },
  { key: 'payroll-hub', href: '/hr/payroll-hub', label: 'مركز الرواتب والتعويضات', icon: 'fa-wallet', category: 'مالية' },
  { key: 'performance', href: '/hr/performance', label: 'مختبر الأداء والتقييم', icon: 'fa-chart-line', category: 'تحليلات' },
  { key: 'learning', href: '/hr/learning', label: 'أكاديمية التطوير والتدريب', icon: 'fa-graduation-cap', category: 'موظفون', manager: true },
  { key: 'integrations-erp', href: '/hr/integrations-erp', label: 'تكاملات ERP', icon: 'fa-link', category: 'تكامل' },
  { key: 'integrations-comms', href: '/hr/integrations-comms', label: 'تكاملات البريد والتنبيهات', icon: 'fa-envelope-open-text', category: 'تكامل' },
  { key: 'integrations-sso', href: '/hr/integrations-sso', label: 'تكاملات SSO والدخول الموحد', icon: 'fa-shield-halved', category: 'تكامل' },
  { key: 'strategic-analytics', href: '/hr/strategic-analytics', label: 'لوحة التحليلات الاستراتيجية', icon: 'fa-chart-pie', category: 'تحليلات' },
  { key: 'workforce-planning', href: '/hr/workforce-planning', label: 'تخطيط القوى العاملة', icon: 'fa-people-group', category: 'تحليلات' },
  { key: 'succession-planning', href: '/hr/succession-planning', label: 'تخطيط التعاقب الإداري', icon: 'fa-chess-king', category: 'تحليلات' },
  { key: 'satisfaction-analytics', href: '/hr/satisfaction-analytics', label: 'تحليل رضا الموظفين', icon: 'fa-face-smile', category: 'تحليلات' },
  { key: 'talent-management', href: '/hr/talent-management', label: 'إدارة المواهب', icon: 'fa-star', category: 'تحليلات' },
  { key: 'human-risk', href: '/hr/human-risk', label: 'إدارة المخاطر البشرية', icon: 'fa-triangle-exclamation', category: 'تحليلات' },
  { key: 'skills-management', href: '/hr/skills-management', label: 'إدارة المهارات', icon: 'fa-layer-group', category: 'تحليلات' },
  { key: 'innovation-management', href: '/hr/innovation-management', label: 'إدارة الابتكارات', icon: 'fa-lightbulb', category: 'تحليلات' },
  { key: 'experience-management', href: '/hr/experience-management', label: 'إدارة الخبرات', icon: 'fa-book-open', category: 'تحليلات' },
  { key: 'cost-optimization', href: '/hr/cost-optimization', label: 'إدارة خفض التكاليف التشغيلية', icon: 'fa-chart-line', category: 'تحليلات' },
  { key: 'productivity-comparison', href: '/hr/productivity-comparison', label: 'مقارنة ساعات العمل بالإنتاجية', icon: 'fa-wave-square', category: 'تحليلات' },
  { key: 'process-automation', href: '/hr/process-automation', label: 'أتمتة الإجراءات إلكترونيًا', icon: 'fa-gears', category: 'أدوات' },
  { key: 'admin-circulars', href: '/hr/admin-circulars', label: 'إدارة التعاميم الإدارية واللوائح', icon: 'fa-bullhorn', category: 'تشغيل' },
  { key: 'notifications-center', href: '/hr/notifications-center', label: 'نظام التنبيهات والإشعارات', icon: 'fa-bell', category: 'أدوات' },
  { key: 'smartsheet-bundle', href: '/hr/smartsheet-bundle', label: 'حزمة سمارت شيت', icon: 'fa-table', category: 'أدوات' },
  { key: 'e-archive', href: '/hr/e-archive', label: 'الأرشفة الإلكترونية', icon: 'fa-archive', category: 'أدوات' },
  { key: 'inbound-outbound-mail', href: '/hr/inbound-outbound-mail', label: 'إدارة مراسلات الصادر والوارد', icon: 'fa-envelope-open-text', category: 'أدوات' },
  { key: 'reporting-suite', href: '/hr/reporting-suite', label: 'حزمة بناء التقارير', icon: 'fa-chart-bar', category: 'أدوات' },
  { key: 'ocr-suite', href: '/hr/ocr-suite', label: 'حزمة OCR', icon: 'fa-file-lines', category: 'أدوات' },
  { key: 'workflow-engine', href: '/hr/workflow-engine', label: 'محرك سير العمل', icon: 'fa-diagram-project', category: 'أدوات', manager: true },
  { key: 'tasks-management', href: '/hr/tasks-management', label: 'إدارة المهام', icon: 'fa-list-check', category: 'تشغيل', manager: true },
  { key: 'cybersecurity', href: '/hr/cybersecurity', label: 'الأمن السيبراني', icon: 'fa-shield-halved', category: 'أدوات' },
  { key: 'api-library', href: '/hr/api-library', label: 'مكتبة الربط API', icon: 'fa-code', category: 'تكامل' },
  { key: 'no-code-builder', href: '/hr/no-code-builder', label: 'بناء الأنظمة بدون برمجة', icon: 'fa-puzzle-piece', category: 'أدوات' },
  { key: 'attachment-merge', href: '/hr/attachment-merge', label: 'دمج المرفقات عند التحميل', icon: 'fa-paperclip', category: 'أدوات' },
  { key: 'bulk-messaging', href: '/hr/bulk-messaging', label: 'نظام الرسائل الجماعية', icon: 'fa-comments', category: 'أدوات' },
  { key: 'scanner-integration', href: '/hr/scanner-integration', label: 'تكامل مع الماسح الضوئي', icon: 'fa-barcode', category: 'أدوات' },
  { key: 'quality-scoring', href: '/hr/quality-scoring', label: 'محرك تقييم الجودة', icon: 'fa-star-half-stroke', category: 'أدوات' },
  { key: 'text-chat', href: '/hr/text-chat', label: 'نظام الدردشة الكتابية', icon: 'fa-comment-dots', category: 'أدوات' }
];

const HR_MODULE_CATEGORIES = ['الكل', 'طلبات', 'تشغيل', 'موظفون', 'حضور', 'مالية', 'تحليلات', 'تكامل', 'أدوات'];

function listHrHomeModules() {
  return HR_HOME_MODULES.map((item) => ({ ...item }));
}

function findHrModuleByPath(pathname) {
  const clean = String(pathname || '').replace(/\/$/, '') || '/hr';
  return HR_HOME_MODULES.find((item) => item.href === clean) || null;
}

module.exports = {
  HR_HOME_MODULES,
  HR_MODULE_CATEGORIES,
  listHrHomeModules,
  findHrModuleByPath
};
