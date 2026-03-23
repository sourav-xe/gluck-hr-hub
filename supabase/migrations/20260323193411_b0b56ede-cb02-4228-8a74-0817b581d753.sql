
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'Full Time',
  department TEXT DEFAULT '',
  job_title TEXT DEFAULT '',
  reporting_manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  joining_date TEXT DEFAULT '',
  date_of_birth TEXT DEFAULT '',
  salary_type TEXT NOT NULL DEFAULT 'Fixed Monthly',
  salary_amount NUMERIC NOT NULL DEFAULT 0,
  bank_name TEXT DEFAULT '',
  account_number TEXT DEFAULT '',
  account_holder_name TEXT DEFAULT '',
  address TEXT DEFAULT '',
  nationality TEXT DEFAULT 'Sri Lankan',
  passport_number TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read employees
CREATE POLICY "Authenticated users can read employees"
  ON public.employees FOR SELECT
  TO authenticated
  USING (true);

-- Admins/HR can insert employees
CREATE POLICY "Admins can insert employees"
  ON public.employees FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
  );

-- Admins/HR can update employees
CREATE POLICY "Admins can update employees"
  ON public.employees FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
  );

-- Admins can delete employees
CREATE POLICY "Admins can delete employees"
  ON public.employees FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
  );
