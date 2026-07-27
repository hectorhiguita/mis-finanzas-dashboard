# Handoff

## State
Dashboard en GitHub Pages (hectorhiguita/mis-finanzas-dashboard, master, último commit 1f29ac2).
Pestaña Campaña + Pestaña Presupuesto funcionales con localStorage. BBVA TC ya tiene datos reales ($25.9M, 26.73% EA). Endoso HDI → BdO ya enviado por correo; esperando respuesta.

## Next
1. **Agregar autenticación**: overlay login con SHA-256. Usuario va a proveer la contraseña o el hash. Implementar en `index.html` + commit/push.
2. **Cancelar SBS** (póliza 1054169, placa CHJ10H): esperar confirmación de BdO primero. Carta lista en `/home/hahiguit/Mis Finanzas/Carta_Cancelacion_SBS_CHJ10H.txt`.
3. **Firebase sync** (opcional, acordado pero no iniciado): sincronización cross-device del JSON de progreso.

## Context
- El usuario va a dar la contraseña o el hash SHA-256 (`echo -n "pass" | sha256sum`) para el auth overlay — no asumir ningún valor por defecto.
- localStorage keys: campaña = `cdd_v2`, presupuesto = `budget_v1`.
- Remote es SSH: `git@github.com:hectorhiguita/mis-finanzas-dashboard.git`.
