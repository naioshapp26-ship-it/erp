const db = require('./db');

const ENTITY_ID = process.env.SEED_ENTITY_ID || 'HQ001';
const ENTITY_TYPE = process.env.SEED_ENTITY_TYPE || 'HQ';

const employees = [
  {
    employee_code: 'EMP-1001',
    full_name_ar: 'Khaled Nasser',
    full_name_en: 'Khaled Nasser',
    employment_type: 'EMPLOYEE',
    hire_date: '2023-02-10',
    base_salary: 14500,
    bank_name: 'Saudi National Bank',
    bank_iban: 'SA4400000000000000001001',
    bank_account: '1001001001',
    social_insurance_number: 'GOSI-1001',
    insurance_number: 'INS-1001',
    is_active: true,
    notes: 'Finance manager'
  },
  {
    employee_code: 'EMP-1002',
    full_name_ar: 'Sara Alotaibi',
    full_name_en: 'Sara Alotaibi',
    employment_type: 'EMPLOYEE',
    hire_date: '2022-07-03',
    base_salary: 11800,
    bank_name: 'Al Rajhi Bank',
    bank_iban: 'SA4400000000000000001002',
    bank_account: '1001001002',
    social_insurance_number: 'GOSI-1002',
    insurance_number: 'INS-1002',
    is_active: true,
    notes: 'HR specialist'
  },
  {
    employee_code: 'EMP-1003',
    full_name_ar: 'Maha Alshammari',
    full_name_en: 'Maha Alshammari',
    employment_type: 'EMPLOYEE',
    hire_date: '2021-11-20',
    base_salary: 13250,
    bank_name: 'Riyad Bank',
    bank_iban: 'SA4400000000000000001003',
    bank_account: '1001001003',
    social_insurance_number: 'GOSI-1003',
    insurance_number: 'INS-1003',
    is_active: true,
    notes: 'Operations lead'
  },
  {
    employee_code: 'EMP-1004',
    full_name_ar: 'Yousef Alharbi',
    full_name_en: 'Yousef Alharbi',
    employment_type: 'EMPLOYEE',
    hire_date: '2020-05-14',
    base_salary: 16500,
    bank_name: 'BSF',
    bank_iban: 'SA4400000000000000001004',
    bank_account: '1001001004',
    social_insurance_number: 'GOSI-1004',
    insurance_number: 'INS-1004',
    is_active: true,
    notes: 'IT lead'
  },
  {
    employee_code: 'EMP-1005',
    full_name_ar: 'Noura Alzahrani',
    full_name_en: 'Noura Alzahrani',
    employment_type: 'EMPLOYEE',
    hire_date: '2024-01-08',
    base_salary: 9800,
    bank_name: 'SNB',
    bank_iban: 'SA4400000000000000001005',
    bank_account: '1001001005',
    social_insurance_number: 'GOSI-1005',
    insurance_number: 'INS-1005',
    is_active: true,
    notes: 'Payroll analyst'
  },
  {
    employee_code: 'EMP-1006',
    full_name_ar: 'Rami Alqahtani',
    full_name_en: 'Rami Alqahtani',
    employment_type: 'CONTRACTOR',
    hire_date: '2025-01-15',
    end_date: '2025-12-31',
    base_salary: 8200,
    bank_name: 'Alinma Bank',
    bank_iban: 'SA4400000000000000001006',
    bank_account: '1001001006',
    social_insurance_number: 'GOSI-1006',
    insurance_number: 'INS-1006',
    is_active: true,
    notes: 'Contracted developer'
  },
  {
    employee_code: 'EMP-1007',
    full_name_ar: 'Hanan Alshehri',
    full_name_en: 'Hanan Alshehri',
    employment_type: 'EMPLOYEE',
    hire_date: '2019-09-01',
    base_salary: 17500,
    bank_name: 'SABB',
    bank_iban: 'SA4400000000000000001007',
    bank_account: '1001001007',
    social_insurance_number: 'GOSI-1007',
    insurance_number: 'INS-1007',
    is_active: true,
    notes: 'Procurement manager'
  },
  {
    employee_code: 'EMP-1008',
    full_name_ar: 'Faisal Almutairi',
    full_name_en: 'Faisal Almutairi',
    employment_type: 'EMPLOYEE',
    hire_date: '2023-06-18',
    base_salary: 11000,
    bank_name: 'Bank AlJazira',
    bank_iban: 'SA4400000000000000001008',
    bank_account: '1001001008',
    social_insurance_number: 'GOSI-1008',
    insurance_number: 'INS-1008',
    is_active: true,
    notes: 'Marketing specialist'
  },
  {
    employee_code: 'EMP-1009',
    full_name_ar: 'Reem Alanzi',
    full_name_en: 'Reem Alanzi',
    employment_type: 'EMPLOYEE',
    hire_date: '2022-03-22',
    base_salary: 10400,
    bank_name: 'SNB',
    bank_iban: 'SA4400000000000000001009',
    bank_account: '1001001009',
    social_insurance_number: 'GOSI-1009',
    insurance_number: 'INS-1009',
    is_active: true,
    notes: 'Customer success'
  },
  {
    employee_code: 'EMP-1010',
    full_name_ar: 'Adel Alsharif',
    full_name_en: 'Adel Alsharif',
    employment_type: 'CONTRACTOR',
    hire_date: '2024-08-01',
    end_date: '2026-07-31',
    base_salary: 9000,
    bank_name: 'Riyad Bank',
    bank_iban: 'SA4400000000000000001010',
    bank_account: '1001001010',
    social_insurance_number: 'GOSI-1010',
    insurance_number: 'INS-1010',
    is_active: true,
    notes: 'Data analyst'
  },
  {
    employee_code: 'EMP-1011',
    full_name_ar: 'Lamia Alsalem',
    full_name_en: 'Lamia Alsalem',
    employment_type: 'EMPLOYEE',
    hire_date: '2020-12-12',
    base_salary: 15200,
    bank_name: 'Al Rajhi Bank',
    bank_iban: 'SA4400000000000000001011',
    bank_account: '1001001011',
    social_insurance_number: 'GOSI-1011',
    insurance_number: 'INS-1011',
    is_active: true,
    notes: 'Quality lead'
  },
  {
    employee_code: 'EMP-1012',
    full_name_ar: 'Omar Alhazmi',
    full_name_en: 'Omar Alhazmi',
    employment_type: 'EMPLOYEE',
    hire_date: '2018-04-02',
    base_salary: 19000,
    bank_name: 'BSF',
    bank_iban: 'SA4400000000000000001012',
    bank_account: '1001001012',
    social_insurance_number: 'GOSI-1012',
    insurance_number: 'INS-1012',
    is_active: false,
    notes: 'On long leave'
  }
];

async function seedPayrollEmployees() {
  try {
    await db.query('BEGIN');

    for (const emp of employees) {
      await db.query(
        `INSERT INTO finance_payroll_employees (
          employee_code,
          full_name_ar,
          full_name_en,
          employment_type,
          hire_date,
          end_date,
          base_salary,
          bank_name,
          bank_iban,
          bank_account,
          social_insurance_number,
          insurance_number,
          entity_type,
          entity_id,
          is_active,
          notes,
          created_at,
          updated_at,
          created_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW(),$17
        )
        ON CONFLICT (employee_code) DO UPDATE SET
          full_name_ar = EXCLUDED.full_name_ar,
          full_name_en = EXCLUDED.full_name_en,
          employment_type = EXCLUDED.employment_type,
          hire_date = EXCLUDED.hire_date,
          end_date = EXCLUDED.end_date,
          base_salary = EXCLUDED.base_salary,
          bank_name = EXCLUDED.bank_name,
          bank_iban = EXCLUDED.bank_iban,
          bank_account = EXCLUDED.bank_account,
          social_insurance_number = EXCLUDED.social_insurance_number,
          insurance_number = EXCLUDED.insurance_number,
          entity_type = EXCLUDED.entity_type,
          entity_id = EXCLUDED.entity_id,
          is_active = EXCLUDED.is_active,
          notes = EXCLUDED.notes,
          updated_at = NOW()`,
        [
          emp.employee_code,
          emp.full_name_ar,
          emp.full_name_en,
          emp.employment_type,
          emp.hire_date || null,
          emp.end_date || null,
          emp.base_salary,
          emp.bank_name,
          emp.bank_iban,
          emp.bank_account,
          emp.social_insurance_number,
          emp.insurance_number,
          ENTITY_TYPE,
          ENTITY_ID,
          emp.is_active,
          emp.notes || null,
          'SEED'
        ]
      );
    }

    await db.query('COMMIT');
    const count = await db.query(
      'SELECT COUNT(*) FROM finance_payroll_employees WHERE entity_id = $1',
      [ENTITY_ID]
    );
    console.log(`Seeded payroll employees for ${ENTITY_ID}. Total rows: ${count.rows[0].count}`);
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Failed to seed payroll employees:', error.message);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

seedPayrollEmployees();
