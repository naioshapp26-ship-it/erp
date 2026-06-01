import pandas as pd
import sys

# قراءة ملف Excel
file_path = '/workspaces/-------------------1767723379340-y21rmmxm-6lgb7m/صلاحيات.xlsx'

try:
    # قراءة جميع الأوراق
    excel_file = pd.ExcelFile(file_path)
    
    print("=" * 80)
    print(f"عدد الأوراق: {len(excel_file.sheet_names)}")
    print(f"أسماء الأوراق: {excel_file.sheet_names}")
    print("=" * 80)
    
    for sheet_name in excel_file.sheet_names:
        print(f"\n{'=' * 80}")
        print(f"الورقة: {sheet_name}")
        print("=" * 80)
        
        df = pd.read_excel(file_path, sheet_name=sheet_name)
        
        # عرض المحتوى
        print(df.to_string())
        print("\n")
        
except Exception as e:
    print(f"خطأ في قراءة الملف: {e}")
    sys.exit(1)
