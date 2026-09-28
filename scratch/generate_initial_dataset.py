import openpyxl
import json
import datetime
import re

wb = openpyxl.load_workbook('./cuenta_corriente_franco.xlsx', data_only=True)

vendedores = [
    { "id": "VEND-FRANCO", "nombre": "Franco", "activo": True, "color": "#2563eb" },
    { "id": "VEND-LUCAS", "nombre": "Lucas", "activo": True, "color": "#059669" }
]

def safe_parse_date(f_val, default="2024-09-15"):
    if not f_val:
        return default
    if isinstance(f_val, (datetime.datetime, datetime.date)):
        return f_val.strftime("%Y-%m-%d")
    s = str(f_val).strip()
    match = re.search(r'(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?', s)
    if match:
        day = int(match.group(1))
        month = int(match.group(2))
        yr = int(match.group(3)) if match.group(3) else 2024
        if yr < 100: yr += 2000
        if 1 <= month <= 12 and 1 <= day <= 31:
            return f"{yr:04d}-{month:02d}-{day:02d}"
    return default

all_clients = []
all_ventas = []
all_cobranzas = []

vta_counter = 1
cob_counter = 1

for sheet_idx, sheet_name in enumerate(wb.sheetnames):
    ws = wb[sheet_name]
    cli_id = f"CLI-F-{sheet_idx+1:03d}"
    client_name = str(sheet_name).strip()
    
    header_map = {}
    for c in range(1, min(26, ws.max_column + 1)):
        val = ws.cell(1, c).value
        if val:
            header_map[str(val).strip().upper()] = c
    
    c_fecha = 1
    c_concepto = 2
    c_corte = 3
    c_cortes = header_map.get('CANTIDAD DE CORTES')
    c_totalkg = header_map.get('TOTAL KG')
    c_precio = header_map.get('PRECIO')
    c_debe = header_map.get('DEBE')
    c_pago = header_map.get('PAGO')
    c_transf = header_map.get('TRANSFERENCIA')
    c_saldo = header_map.get('SALDO')
    
    if not c_totalkg: c_totalkg = 15
    if not c_cortes: c_cortes = c_totalkg - 1
    if not c_precio: c_precio = c_totalkg + 1
    if not c_debe: c_debe = c_totalkg + 3
    if not c_pago: c_pago = c_totalkg + 4
    if not c_transf: c_transf = c_totalkg + 5
    if not c_saldo: c_saldo = c_totalkg + 6
        
    client_ventas = []
    client_cobranzas = []
    
    # We take the most recent 120 rows per client to keep performance fast and snappy in DOM
    rows_data = []
    for r in range(2, min(500, ws.max_row + 1)):
        f_val = ws.cell(r, c_fecha).value
        concepto_raw = ws.cell(r, c_concepto).value
        if f_val or concepto_raw:
            rows_data.append(r)
            
    # keep last 80 rows if client has hundreds, to keep DOM lightning fast
    selected_rows = rows_data[-80:] if len(rows_data) > 80 else rows_data
    
    for r in selected_rows:
        f_val = ws.cell(r, c_fecha).value
        concepto_raw = ws.cell(r, c_concepto).value
        
        fecha_str = safe_parse_date(f_val)
        concepto_val = str(concepto_raw or '').strip().upper()
        
        if 'VENTA' in concepto_val:
            corte = str(ws.cell(r, c_corte).value or '1/2 RES').strip()
            pesos = []
            for col_k in range(4, c_cortes):
                w = ws.cell(r, col_k).value
                if w is not None and isinstance(w, (int, float)) and w > 0:
                    pesos.append(float(w))
            
            totalkg_val = ws.cell(r, c_totalkg).value
            try:
                totalkg = float(totalkg_val) if (totalkg_val is not None and str(totalkg_val).strip() != '') else sum(pesos)
            except:
                totalkg = sum(pesos)
            
            cant_cortes = len(pesos) if pesos else 1
            
            precio_val = ws.cell(r, c_precio).value
            try:
                precio = float(precio_val) if (precio_val is not None and str(precio_val).strip() != '') else 6500.0
            except:
                precio = 6500.0
                
            debe_val = ws.cell(r, c_debe).value
            try:
                total_venta = float(debe_val) if (debe_val is not None and str(debe_val).strip() != '') else (totalkg * precio)
            except:
                total_venta = totalkg * precio
                
            if total_venta > 0:
                vta_id = f"VTA-{vta_counter:04d}"
                vta_num = f"VTA-{vta_counter:06d}"
                vta_counter += 1
                client_ventas.append({
                    "id": vta_id,
                    "numero": vta_num,
                    "clienteId": cli_id,
                    "vendedorId": "VEND-FRANCO",
                    "fechaEmision": fecha_str,
                    "corte": corte,
                    "pesos": pesos,
                    "cantidadCortes": cant_cortes,
                    "totalKg": round(totalkg, 2),
                    "precioKg": round(precio, 2),
                    "total": round(total_venta, 2),
                    "saldoPendiente": round(total_venta, 2),
                    "montoCobrado": 0,
                    "estado": "pendiente",
                    "pagosAplicados": []
                })
        elif 'PAGO' in concepto_val:
            pago_efectivo = 0.0
            pago_transf = 0.0
            
            pe = ws.cell(r, c_pago).value
            if pe and isinstance(pe, (int, float)):
                pago_efectivo = float(pe)
            pt = ws.cell(r, c_transf).value
            if pt and isinstance(pt, (int, float)):
                pago_transf = float(pt)
                
            total_cobro = pago_efectivo + pago_transf
            if total_cobro > 0:
                cob_id = f"COB-{cob_counter:04d}"
                cob_num = f"REC-{cob_counter:06d}"
                cob_counter += 1
                metodo = "Mixto (Efectivo y Transf.)" if (pago_efectivo > 0 and pago_transf > 0) else ("Transferencia" if pago_transf > 0 else "Efectivo")
                client_cobranzas.append({
                    "id": cob_id,
                    "numero": cob_num,
                    "clienteId": cli_id,
                    "vendedorId": "VEND-FRANCO",
                    "fecha": fecha_str,
                    "totalCobrado": round(total_cobro, 2),
                    "efectivo": round(pago_efectivo, 2),
                    "transferencia": round(pago_transf, 2),
                    "metodo": metodo,
                    "observaciones": f"Pago Cta Cte ({metodo})"
                })
    
    total_v = sum(v["total"] for v in client_ventas)
    total_c = sum(c["totalCobrado"] for c in client_cobranzas)
    saldo_actual = total_v - total_c
    
    all_clients.append({
        "id": cli_id,
        "razonSocial": client_name,
        "vendedorId": "VEND-FRANCO",
        "telefono": f"+54 9 11 {4000 + (sheet_idx * 17) % 5000}-{1000 + (sheet_idx * 31) % 8999}",
        "contactoNombre": f"Responsable {client_name}",
        "direccion": f"Zona Comercial {sheet_idx+1}, Gran Buenos Aires",
        "limiteCredito": max(5000000.0, round(saldo_actual * 1.5, -5) if saldo_actual > 0 else 5000000.0),
        "plazoDias": 14,
        "estado": "activo",
        "fechaAlta": "2024-01-15"
    })
    all_ventas.extend(client_ventas)
    all_cobranzas.extend(client_cobranzas)

# Now add Lucas's clients
lucas_clients_data = [
    { "name": "Carnicería Los Álamos (Lucas)", "saldo": 3450000, "ventas": [
        { "corte": "1/2 RES", "pesos": [95.0, 96.0, 94.0], "precio": 6800.0, "dias": 10 },
        { "corte": "MOCHO", "pesos": [42.0, 43.0], "precio": 6100.0, "dias": 5 },
        { "corte": "1/2 RES", "pesos": [92.0, 93.0], "precio": 6900.0, "dias": 2 }
    ], "pagos": [
        { "monto": 500000, "metodo": "Transferencia", "dias": 4 }
    ]},
    { "name": "Distribuidora San Telmo Carnes (Lucas)", "saldo": 8900000, "ventas": [
        { "corte": "1/2 RES", "pesos": [110.0, 112.0, 108.0, 115.0, 114.0], "precio": 6700.0, "dias": 15 },
        { "corte": "PECHO", "pesos": [38.0, 39.0, 40.0], "precio": 4200.0, "dias": 8 },
        { "corte": "1/2 RES", "pesos": [105.0, 107.0, 106.0], "precio": 6850.0, "dias": 1 }
    ], "pagos": [
        { "monto": 1500000, "metodo": "Transferencia", "dias": 7 },
        { "monto": 800000, "metodo": "Efectivo", "dias": 3 }
    ]},
    { "name": "Supermercado Pampa Meat (Lucas)", "saldo": 5200000, "ventas": [
        { "corte": "1/2 RES", "pesos": [98.0, 99.0, 101.0, 100.0], "precio": 6800.0, "dias": 12 },
        { "corte": "ASADO", "pesos": [55.0, 56.0], "precio": 7200.0, "dias": 6 }
    ], "pagos": [
        { "monto": 800000, "metodo": "Transferencia", "dias": 5 }
    ]},
    { "name": "Parrilla Don Lucas (Lucas)", "saldo": 2100000, "ventas": [
        { "corte": "BIFE", "pesos": [45.0, 48.0, 46.0], "precio": 8500.0, "dias": 9 },
        { "corte": "ASADO", "pesos": [60.0, 62.0], "precio": 7400.0, "dias": 3 }
    ], "pagos": [
        { "monto": 600000, "metodo": "Efectivo", "dias": 2 }
    ]},
    { "name": "Carnicería El Hornero (Lucas)", "saldo": 1850000, "ventas": [
        { "corte": "1/2 RES", "pesos": [88.0, 89.0], "precio": 6900.0, "dias": 7 }
    ], "pagos": []}
]

today = datetime.date(2026, 9, 28)

for l_idx, lc in enumerate(lucas_clients_data):
    cli_id = f"CLI-L-{l_idx+1:03d}"
    all_clients.append({
        "id": cli_id,
        "razonSocial": lc["name"],
        "vendedorId": "VEND-LUCAS",
        "telefono": f"+54 9 11 5566-{7700 + l_idx}",
        "contactoNombre": f"Responsable {lc['name']}",
        "direccion": f"Zona Lucas {l_idx+1}, CABA",
        "limiteCredito": 10000000.0,
        "plazoDias": 14,
        "estado": "activo",
        "fechaAlta": "2024-03-01"
    })
    
    for v_info in lc["ventas"]:
        totalkg = sum(v_info["pesos"])
        tot_vta = totalkg * v_info["precio"]
        vta_d = today - datetime.timedelta(days=v_info["dias"])
        vta_id = f"VTA-{vta_counter:04d}"
        vta_num = f"VTA-{vta_counter:06d}"
        vta_counter += 1
        all_ventas.append({
            "id": vta_id,
            "numero": vta_num,
            "clienteId": cli_id,
            "vendedorId": "VEND-LUCAS",
            "fechaEmision": vta_d.strftime("%Y-%m-%d"),
            "corte": v_info["corte"],
            "pesos": v_info["pesos"],
            "cantidadCortes": len(v_info["pesos"]),
            "totalKg": round(totalkg, 2),
            "precioKg": round(v_info["precio"], 2),
            "total": round(tot_vta, 2),
            "saldoPendiente": round(tot_vta, 2),
            "montoCobrado": 0,
            "estado": "pendiente",
            "pagosAplicados": []
        })
        
    for p_info in lc["pagos"]:
        cob_d = today - datetime.timedelta(days=p_info["dias"])
        cob_id = f"COB-{cob_counter:04d}"
        cob_num = f"REC-{cob_counter:06d}"
        cob_counter += 1
        all_cobranzas.append({
            "id": cob_id,
            "numero": cob_num,
            "clienteId": cli_id,
            "vendedorId": "VEND-LUCAS",
            "fecha": cob_d.strftime("%Y-%m-%d"),
            "totalCobrado": round(p_info["monto"], 2),
            "efectivo": round(p_info["monto"] if p_info["metodo"] == "Efectivo" else 0, 2),
            "transferencia": round(p_info["monto"] if p_info["metodo"] == "Transferencia" else 0, 2),
            "metodo": p_info["metodo"],
            "observaciones": f"Pago Cta Cte ({p_info['metodo']})"
        })

# Apply FIFO allocations on initial dataset!
print("Applying FIFO allocations to sales...")
for cli in all_clients:
    cli_ventas = sorted([v for v in all_ventas if v["clienteId"] == cli["id"]], key=lambda x: x["fechaEmision"])
    cli_cobranzas = sorted([c for c in all_cobranzas if c["clienteId"] == cli["id"]], key=lambda x: x["fecha"])
    
    # Pool of payments
    for cob in cli_cobranzas:
        rem_cob = cob["totalCobrado"]
        for v in cli_ventas:
            if rem_cob <= 0:
                break
            if v["saldoPendiente"] > 0:
                imputar = min(rem_cob, v["saldoPendiente"])
                v["montoCobrado"] += imputar
                v["saldoPendiente"] -= imputar
                rem_cob -= imputar
                v["pagosAplicados"].append({
                    "pagoId": cob["id"],
                    "numeroRecibo": cob["numero"],
                    "fecha": cob["fecha"],
                    "monto": round(imputar, 2),
                    "metodo": cob["metodo"]
                })
                if v["saldoPendiente"] <= 0.01:
                    v["estado"] = "cobrado"
                else:
                    v["estado"] = "parcial"

output_dataset = {
    "vendedores": vendedores,
    "clientes": all_clients,
    "ventas": all_ventas,
    "cobranzas": all_cobranzas
}

with open("./js/initial_dataset.json", "w", encoding="utf-8") as f:
    json.dump(output_dataset, f, ensure_ascii=False, indent=2)

print(f"Generated ./js/initial_dataset.json successfully!")
print(f"Total Vendedores: {len(vendedores)}")
print(f"Total Clientes: {len(all_clients)}")
print(f"Total Ventas: {len(all_ventas)}")
print(f"Total Cobranzas: {len(all_cobranzas)}")
