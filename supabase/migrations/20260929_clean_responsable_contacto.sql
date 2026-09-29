-- =========================================================================
-- LIMPIEZA DE "RESPONSABLE" EN PERSONA DE CONTACTO (TABLA CLIENTES)
-- Fecha: 2026-09-29
-- Proyecto: finanzaflow-carnes (ID: shzmwgrwbpscsuxqwzvg)
-- =========================================================================

-- 1. Actualizar registros existentes removiendo el prefijo "Responsable"
UPDATE public.clientes
SET contacto_nombre = COALESCE(NULLIF(TRIM(REGEXP_REPLACE(contacto_nombre, '^responsable\s*[:\-–]?\s*', '', 'i')), ''), razon_social)
WHERE contacto_nombre ILIKE '%responsable%';

-- 2. Función disparadora opcional para asegurar que futuros inserts/updates
-- no ingresen el prefijo "Responsable"
CREATE OR REPLACE FUNCTION public.limpiar_contacto_cliente()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.contacto_nombre IS NOT NULL AND NEW.contacto_nombre ILIKE 'responsable%' THEN
    NEW.contacto_nombre := COALESCE(NULLIF(TRIM(REGEXP_REPLACE(NEW.contacto_nombre, '^responsable\s*[:\-–]?\s*', '', 'i')), ''), NEW.razon_social);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limpiar_contacto_cliente ON public.clientes;

CREATE TRIGGER trg_limpiar_contacto_cliente
BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.limpiar_contacto_cliente();
