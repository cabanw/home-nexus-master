-- Update handle_new_user trigger to validate username server-side
-- This provides defense-in-depth alongside client-side validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _username TEXT;
BEGIN
  _username := NEW.raw_user_meta_data->>'username';
  
  -- Server-side username validation (defense-in-depth with client validation)
  IF _username IS NULL OR length(_username) < 3 THEN
    RAISE EXCEPTION 'Username must be at least 3 characters';
  END IF;
  
  IF length(_username) > 50 THEN
    RAISE EXCEPTION 'Username must be less than 50 characters';
  END IF;
  
  IF _username !~ '^[a-zA-Z0-9_-]+$' THEN
    RAISE EXCEPTION 'Username can only contain letters, numbers, underscores, and hyphens';
  END IF;

  INSERT INTO public.profiles (id, username, email)
  VALUES (NEW.id, _username, NEW.email);
  
  -- First user gets admin role
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;