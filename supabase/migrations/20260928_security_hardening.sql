-- =========================================================================
-- MIGRACIÓN DE SEGURIDAD Y ENDURECIMIENTO (TRAIL OF BITS REMEDIATION)
-- Fecha: 2026-09-28
-- Proyecto: finanzaflow-carnes (ID: shzmwgrwbpscsuxqwzvg)
-- =========================================================================

-- 1. Habilitar extensión pgcrypto para soporte de hashes seguros
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Función segura de autenticación en servidor (SECURITY DEFINER)
-- Evita transferir contraseñas o hashes al cliente y comprueba credenciales de forma atómica.
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
  SELECT id, email, password, nombre, rol, socio_asignado, estado, creado_el, ultimo_acceso
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
      'estado', v_user.estado,
      'creadoEl', v_user.creado_el,
      'ultimoAcceso', to_char(now(), 'YYYY-MM-DD HH24:MI')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.autenticar_usuario(text, text) TO anon, authenticated;

-- 3. Vista pública de usuarios sin la columna sensible 'password'
CREATE OR REPLACE VIEW public.usuarios_publicos AS
SELECT id, email, nombre, rol, socio_asignado, estado, creado_el, ultimo_acceso
FROM public.usuarios_whitelist;

GRANT SELECT ON public.usuarios_publicos TO anon, authenticated;
