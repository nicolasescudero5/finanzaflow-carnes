-- =========================================================================
-- MIGRACIÓN DE ALCANCE POR SOCIO Y OPCIÓN CONSOLIDADO
-- Fecha: 2026-09-29
-- Proyecto: finanzaflow-carnes (ID: shzmwgrwbpscsuxqwzvg)
-- =========================================================================

-- 1. Agregar columna puede_consolidar a usuarios_whitelist
ALTER TABLE public.usuarios_whitelist
ADD COLUMN IF NOT EXISTS puede_consolidar BOOLEAN DEFAULT false;

-- 2. Configurar usuarios existentes
UPDATE public.usuarios_whitelist
SET puede_consolidar = true
WHERE id IN ('USR-ADMIN', 'USR-MESCUDERO')
   OR rol = 'admin'
   OR socio_asignado = 'todos';

UPDATE public.usuarios_whitelist
SET puede_consolidar = false
WHERE id IN ('USR-FRANCO', 'USR-LUCAS');

-- 3. Actualizar la vista pública de usuarios incluyendo puede_consolidar
DROP VIEW IF EXISTS public.usuarios_publicos CASCADE;

CREATE VIEW public.usuarios_publicos AS
SELECT id, email, nombre, rol, socio_asignado, puede_consolidar, estado, creado_el, ultimo_acceso
FROM public.usuarios_whitelist;

GRANT SELECT ON public.usuarios_publicos TO anon, authenticated;

-- 4. Actualizar función RPC autenticar_usuario para retornar puedeConsolidar
CREATE OR REPLACE FUNCTION public.autenticar_usuario(p_email text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user record;
  v_pass_ok boolean := false;
BEGIN
  SELECT id, email, password, nombre, rol, socio_asignado, puede_consolidar, estado, creado_el, ultimo_acceso
  INTO v_user
  FROM public.usuarios_whitelist
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El correo o usuario no se encuentra autorizado.');
  END IF;

  IF v_user.estado = 'inactivo' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este usuario ha sido dado de baja por el Administrador.');
  END IF;

  -- Comprobación estricta de contraseña (soporta texto plano o hash sha256)
  IF v_user.password = p_password OR v_user.password = encode(extensions.digest(p_password, 'sha256'), 'hex') THEN
    v_pass_ok := true;
  END IF;

  IF NOT v_pass_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Contraseña incorrecta. Verifica tus datos de acceso.');
  END IF;

  UPDATE public.usuarios_whitelist
  SET ultimo_acceso = now()
  WHERE id = v_user.id;

  RETURN jsonb_build_object(
    'ok', true,
    'usuario', jsonb_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'nombre', v_user.nombre,
      'rol', v_user.rol,
      'socioAsignado', v_user.socio_asignado,
      'puedeConsolidar', COALESCE(v_user.puede_consolidar, false),
      'estado', v_user.estado,
      'creadoEl', v_user.creado_el,
      'ultimoAcceso', to_char(now(), 'YYYY-MM-DD HH24:MI')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.autenticar_usuario(text, text) TO anon, authenticated;
