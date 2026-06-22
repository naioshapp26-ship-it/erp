const fs = require('fs');
const path = require('path');
const {
  OFFICE_ROUTE_PARENTS,
  ROUTE_TO_PATH,
  PAGE_LABELS,
  buildPermissionRegistry,
  getPagesForSystem
} = require('./page-permissions-registry');

const PRODUCTS_SYSTEM_MAP = {
  'finance-reports': { kind: 'finance-all' },
  hr: { kind: 'hr-all' },
  'records-archive': { kind: 'archive-all' },
  'strategic-mgmt': { kind: 'registry', key: 'strategic-management' },
  'payment-system': { kind: 'payment-all' },
  'sales-system': { kind: 'registry', key: 'sales' },
  'employee-portal': { kind: 'employee-menu' },
  services: { kind: 'registry', key: 'services' },
  'tasks-management': { kind: 'registry', key: 'tasks-management' },
  'supply-chain': { kind: 'registry', key: 'supply-chain' },
  'occupational-health': { kind: 'registry', key: 'occupational-health' },
  'facilities-mgmt': { kind: 'registry', key: 'facilities' },
  'internet-automation': { kind: 'registry', key: 'internet-automation' },
  'e-offices': { kind: 'registry', key: 'e-offices' },
  platforms: { kind: 'registry', key: 'platforms' },
  branches: { kind: 'registry', key: 'branches-hub' },
  'incubators-hub': { kind: 'registry', key: 'incubators-hub' },
  'education-incubators': { kind: 'registry', key: 'education-training-incubators' },
  'naiosh-sectors': { kind: 'registry', key: 'naiosh-sectors' },
  'operational-policies': { kind: 'registry', key: 'operational-policies' },
  'requests-hub': { kind: 'registry', key: 'requests' },
  'tenants-hub': { kind: 'registry', key: 'tenants' },
  'saas-platform': { kind: 'registry', key: 'saas' },
  'ads-center': { kind: 'registry', key: 'ads' },
  'marketing-campaigns': { kind: 'registry', key: 'marketing-campaigns-studio' },
  'events-studio': { kind: 'registry', key: 'events-studio-main' },
  employees: { kind: 'registry', key: 'employees' }
};

const SUPPLEMENTAL_ROUTE_PATHS = {
  'flexible-salary': '/employee/flexible-salary',
  resignations: '/employee/resignations',
  'employee-settlement': '/employee/employee-settlement',
  'invoices-enhanced': '/finance/payments/smart-invoices.html',
  'payment-methods': '/finance/payments/',
  'installment-plans': '/finance/payment-plans.html',
  'payment-tracking': '/finance/payments/tracking.html',
  'tax-settings': '/finance/multiple-taxes.html',
  'collection-rules': '/finance/payments/collection-rules.html',
  'payment-reminders': '/finance/payments/reminders.html',
  'overdue-management': '/finance/payments/arrears.html',
  'payment-analytics': '/finance/payments/analytics.html',
  'gateway-payments': '/gateway-payments',
  'credit-topup': '/credit-topup',
  'online-store': '/online-store',
  'payment-menu': '/finance/payments/'
};

function parseHubFromFile(relativeFile, containerId, hrefPrefix) {
  const filePath = path.join(__dirname, relativeFile);
  if (!fs.existsSync(filePath)) return [];
  const html = fs.readFileSync(filePath, 'utf8');
  const blockMatch = html.match(new RegExp(`id="${containerId}"[\\s\\S]*?(?=</div>\\s*</div>|</main>|</body>)`));
  if (!blockMatch) return [];

  const modules = [];
  const seen = new Set();
  const linkRe = /href="([^"]+)"[\s\S]*?<span class="flex-1 text-right">([^<]+)<\/span>/g;
  let match;
  while ((match = linkRe.exec(blockMatch[0])) !== null) {
    const href = match[1].trim();
    const name = match[2].replace(/\s+/g, ' ').trim();
    if (!href.startsWith(hrefPrefix) || href.includes('#') || !name || seen.has(href)) continue;
    seen.add(href);
    modules.push({ name, href });
  }
  return modules;
}

function dedupeModules(modules) {
  const seen = new Set();
  return modules.filter((item) => {
    if (!item?.href || seen.has(item.href)) return false;
    seen.add(item.href);
    return Boolean(item.name);
  });
}

function labelForKey(key) {
  return PAGE_LABELS[key] || key.replace(/__/g, ' / ').replace(/-/g, ' ');
}

let scriptRoutePaths = null;

function loadScriptRoutePaths() {
  if (scriptRoutePaths) return scriptRoutePaths;
  const content = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

  function extractBlock(startMarker) {
    const start = content.indexOf(startMarker);
    if (start < 0) return {};
    let depth = 0;
    let end = start;
    const openBrace = content.indexOf('{', start);
    for (let i = openBrace; i < content.length; i += 1) {
      if (content[i] === '{') depth += 1;
      if (content[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    const paths = {};
    [...content.slice(start, end).matchAll(/'([^']+)':\s*'([^']+)'/g)].forEach((match) => {
      paths[match[1]] = match[2];
    });
    return paths;
  }

  scriptRoutePaths = {
    ...extractBlock('const routeToPath = {'),
    ...extractBlock('Object.assign(routeToPath, {')
  };
  return scriptRoutePaths;
}

function pathForKey(key) {
  buildPermissionRegistry();
  return (
    ROUTE_TO_PATH[key] ||
    SUPPLEMENTAL_ROUTE_PATHS[key] ||
    loadScriptRoutePaths()[key] ||
    null
  );
}

function parseNavLinksFromFile(relativeFile, hrefPrefix) {
  const filePath = path.join(__dirname, relativeFile);
  if (!fs.existsSync(filePath)) return [];
  const html = fs.readFileSync(filePath, 'utf8');
  const modules = [];
  const seen = new Set();
  const linkRe = /href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = linkRe.exec(html)) !== null) {
    const href = match[1].trim();
    if (!href.startsWith(hrefPrefix)) continue;
    const name = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name || name.length > 80 || seen.has(href)) continue;
    seen.add(href);
    modules.push({ name, href });
  }
  return modules;
}

function modulesFromParentKey(parentKey) {
  buildPermissionRegistry();
  const childKeys = Object.entries(OFFICE_ROUTE_PARENTS)
    .filter(([, parent]) => parent === parentKey)
    .map(([child]) => child);

  return dedupeModules(
    childKeys.map((key) => ({
      name: labelForKey(key),
      href: pathForKey(key) || `/home#${key}`
    }))
  );
}

function modulesFromRegistry(systemKey, includeRoot = false) {
  buildPermissionRegistry();
  const childModules = modulesFromParentKey(systemKey);
  if (childModules.length) return childModules;

  const pages = getPagesForSystem(systemKey);
  return dedupeModules(
    pages
      .filter((page) => includeRoot || page.key !== systemKey)
      .map((page) => ({
        name: page.label || labelForKey(page.key),
        href: pathForKey(page.key)
      }))
      .filter((page) => page.href)
  );
}

function buildFinanceModules() {
  return parseHubFromFile('finance/index.html', 'finance-cards', '/finance');
}

function buildHrModules() {
  return parseHubFromFile('finance/hr-home.html', 'hr-cards', '/hr');
}

function buildArchiveModules() {
  return parseHubFromFile('finance/archive-home.html', 'archive-cards', '/hr');
}

function buildPaymentModules() {
  buildPermissionRegistry();
  const parentModules = modulesFromParentKey('payment-menu');
  const navModules = parseNavLinksFromFile('finance/payments/index.html', '/finance/payments');
  const financePaymentLinks = buildFinanceModules().filter((item) =>
    item.href.includes('/finance/payments') ||
    item.href.includes('/gateway-payments') ||
    item.href.includes('/credit-topup') ||
    item.href.includes('/online-store')
  );
  return dedupeModules([...parentModules, ...navModules, ...financePaymentLinks]);
}

function buildModulesForProductSystem(productSystemId) {
  const config = PRODUCTS_SYSTEM_MAP[productSystemId];
  if (!config) return null;

  switch (config.kind) {
    case 'finance-all':
      return buildFinanceModules();
    case 'hr-all':
      return buildHrModules();
    case 'archive-all':
      return buildArchiveModules();
    case 'payment-all':
      return buildPaymentModules();
    case 'employee-menu':
      return modulesFromParentKey('employee-menu');
    case 'registry':
      return modulesFromRegistry(config.key, false);
    default:
      return null;
  }
}

function buildProductsModulesBundle() {
  const modulesBySystem = {};
  Object.keys(PRODUCTS_SYSTEM_MAP).forEach((productSystemId) => {
    const modules = buildModulesForProductSystem(productSystemId);
    if (modules?.length) {
      modulesBySystem[productSystemId] = modules;
    }
  });
  return {
    generatedAt: new Date().toISOString(),
    modulesBySystem
  };
}

module.exports = {
  PRODUCTS_SYSTEM_MAP,
  buildProductsModulesBundle,
  buildModulesForProductSystem
};
