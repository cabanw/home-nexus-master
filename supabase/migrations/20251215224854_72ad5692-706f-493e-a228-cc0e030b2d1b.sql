-- Add INSERT policy to profiles table for authenticated users
-- The handle_new_user() trigger uses SECURITY DEFINER so it will bypass RLS
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);