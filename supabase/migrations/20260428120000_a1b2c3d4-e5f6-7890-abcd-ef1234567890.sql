-- Create firewall_rules table
CREATE TABLE public.firewall_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source      TEXT NOT NULL DEFAULT 'any',
  destination TEXT NOT NULL DEFAULT 'any',
  port        TEXT NOT NULL DEFAULT 'any',
  action      TEXT NOT NULL CHECK (action IN ('allow', 'deny')),
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.firewall_rules ENABLE ROW LEVEL SECURITY;

-- Policy: users manage their own rules
CREATE POLICY "Users can manage own firewall rules"
  ON public.firewall_rules
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: admins manage all rules
CREATE POLICY "Admins can manage all firewall rules"
  ON public.firewall_rules
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Index for common lookup
CREATE INDEX firewall_rules_user_id_idx ON public.firewall_rules (user_id);
