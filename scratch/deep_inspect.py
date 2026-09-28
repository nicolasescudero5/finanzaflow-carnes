import openpyxl

wb = openpyxl.load_workbook('./cuenta_corriente_franco.xlsx', data_only=False)

def inspect_sheet(name):
    ws = wb[name]
    print(f"\n===================== SHEET: {name} =====================")
    # Row 1 headers
    headers = [ws.cell(1, c).value for c in range(1, ws.max_column + 1)]
    print("Headers:", [(openpyxl.utils.get_column_letter(i+1), headers[i]) for i in range(len(headers)) if headers[i] is not None])
    
    # Check first 15 rows
    for r in range(2, 20):
        c_val = ws.cell(r, 2).value # CONCEPTO
        if not c_val and not ws.cell(r, 1).value:
            continue
        vals = []
        for c in range(1, ws.max_column + 1):
            val = ws.cell(r, c).value
            if val is not None:
                vals.append((openpyxl.utils.get_column_letter(c), val))
        print(f"Row {r}: {vals}")

inspect_sheet('BATY')
inspect_sheet('MAURO')
inspect_sheet('ESPAÑOLA NUEVO')
