-- Claims Reference Portal: Document Types setup
-- Safe to run after the original portal SQL. It creates the table if needed,
-- seeds the choices from DocType.xlsx, and avoids duplicate names.

create table if not exists public.document_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.document_types enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_types' AND policyname='Anyone can read document types') THEN
    CREATE POLICY "Anyone can read document types" ON public.document_types FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_types' AND policyname='Admins can insert document types') THEN
    CREATE POLICY "Admins can insert document types" ON public.document_types FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_types' AND policyname='Admins can update document types') THEN
    CREATE POLICY "Admins can update document types" ON public.document_types FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_types' AND policyname='Admins can delete document types') THEN
    CREATE POLICY "Admins can delete document types" ON public.document_types FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));
  END IF;
END $$;

insert into public.document_types (name, sort_order) values
('Anesthesia Record',1),
('Clinical Abstract',2),
('Certification Of Approval/Agreement From The Employer',3),
('Claim Form 1',4),
('Claim Form 2',5),
('Claim Form 3',6),
('Claim Form 4',7),
('Claim Form 5',8),
('Claim Signature Form',9),
('Certificate Of Eligibility',10),
('Confirmatory Test Results By SACCL or RITM',11),
('Diagnostic Test Result',12),
('Hemodialysis Record',13),
('Member''s Birth Certificate',14),
('Proof Of  MDR With Payment Details',15),
('Member Empowerment Form',16),
('Member''s Marriage Contract',17),
('Philhealth Member Registration Form',18),
('Malarial Smear Results',19),
('Waiver Of Consent For Release Of Confidential Patient Health Information',20),
('NTP Registry Card',21),
('Operative Record',22),
('Official Receipts',23),
('Pre-Authorization Clearance',24),
('Patient''s Birth Certificate',25),
('Valid Philhealth Indigent ID',26),
('Philhealth Official Receipts',27),
('Philhealth Hemodialysis Benefit Package Agreement Form',28),
('Statement Of Account',29),
('E-SOA',30),
('HIV Screening Test Result',31),
('TB-Diagnostic Committee Certification (-) Sputum',32),
('Three Years Payment Of (2400 X 3 Years Of Proof Of Payment)',33),
('Others',34)
on conflict (name) do update set sort_order=excluded.sort_order;
