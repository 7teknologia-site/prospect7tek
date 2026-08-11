
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.niches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  default_message text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.niches TO authenticated;
GRANT ALL ON public.niches TO service_role;
ALTER TABLE public.niches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own niches" ON public.niches FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_niches_user ON public.niches(user_id);

CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche_id uuid REFERENCES public.niches(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own templates" ON public.message_templates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_templates_user ON public.message_templates(user_id);
CREATE INDEX idx_templates_niche ON public.message_templates(niche_id);

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company text NOT NULL,
  niche_id uuid REFERENCES public.niches(id) ON DELETE SET NULL,
  segment text,
  subsegment text,
  region text,
  neighborhood text,
  address text,
  city text DEFAULT 'São Paulo',
  state text DEFAULT 'SP',
  zip text,
  phone text,
  whatsapp text,
  google_maps_url text,
  reviews_count integer DEFAULT 0,
  rating numeric(2,1),
  website text,
  website_status text NOT NULL DEFAULT 'nao_verificado',
  instagram text,
  linkedin text,
  facebook text,
  priority text NOT NULL DEFAULT 'C',
  score integer NOT NULL DEFAULT 0,
  opportunity_reason text,
  message text,
  status text NOT NULL DEFAULT 'novo',
  collected_at timestamptz NOT NULL DEFAULT now(),
  contacted_at timestamptz,
  followup_at timestamptz,
  result text,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  independent_local boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own leads" ON public.leads FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_leads_user ON public.leads(user_id);
CREATE INDEX idx_leads_phone ON public.leads(phone);
CREATE INDEX idx_leads_company ON public.leads(company);
CREATE INDEX idx_leads_neighborhood ON public.leads(neighborhood);
CREATE INDEX idx_leads_niche ON public.leads(niche_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_priority ON public.leads(priority);
CREATE INDEX idx_leads_score ON public.leads(score);

CREATE TABLE public.lead_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  response text,
  result text,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  next_followup_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_interactions TO authenticated;
GRANT ALL ON public.lead_interactions TO service_role;
ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own interactions" ON public.lead_interactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_interactions_lead ON public.lead_interactions(lead_id);
CREATE INDEX idx_interactions_user ON public.lead_interactions(user_id);

CREATE TABLE public.search_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'manual_import',
  source text,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'concluido',
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  duplicated_rows integer NOT NULL DEFAULT 0,
  invalid_rows integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_jobs TO authenticated;
GRANT ALL ON public.search_jobs TO service_role;
ALTER TABLE public.search_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own jobs" ON public.search_jobs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_jobs_user ON public.search_jobs(user_id);

CREATE TABLE public.settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  score_weights jsonb NOT NULL DEFAULT '{"no_website":30,"phone":15,"whatsapp":10,"reviews_50":15,"reviews_20":10,"rating_45":10,"instagram":5,"linkedin":5,"independent":10}'::jsonb,
  default_city text NOT NULL DEFAULT 'São Paulo',
  default_region text NOT NULL DEFAULT 'Zona Norte',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER t_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_niches_upd BEFORE UPDATE ON public.niches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_templates_upd BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_leads_upd BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_interactions_upd BEFORE UPDATE ON public.lead_interactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_jobs_upd BEFORE UPDATE ON public.search_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_settings_upd BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n record;
  v_estetica uuid;
  v_pet uuid;
  v_oficina uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.settings (user_id) VALUES (NEW.id);

  FOR n IN
    SELECT * FROM (VALUES
      ('Estética / Beleza', 'Salões, clínicas de estética e beleza'),
      ('Oficinas / Automotivo', 'Oficinas mecânicas e serviços automotivos'),
      ('Pet / Banho e Tosa', 'Pet shops e serviços para animais'),
      ('Barbearias', 'Barbearias e cuidados masculinos'),
      ('Clínicas', 'Clínicas médicas e terapêuticas'),
      ('Marcenarias / Móveis Planejados', 'Marcenarias e móveis sob medida'),
      ('Assistência Técnica', 'Assistência técnica de eletrônicos'),
      ('Odontologia', 'Consultórios e clínicas odontológicas'),
      ('Imobiliárias / Corretores', 'Imobiliárias e corretores autônomos'),
      ('Restaurantes / Pizzarias', 'Restaurantes, pizzarias e delivery')
    ) AS t(nome, descr)
  LOOP
    INSERT INTO public.niches (user_id, name, description, default_message)
    VALUES (
      NEW.id, n.nome, n.descr,
      'Olá! Tudo bem? Falo com o responsável pela {{empresa}}?' || chr(10) || chr(10) ||
      'Estamos selecionando alguns negócios de ' || lower(n.nome) || ' em {{bairro}}, {{cidade}}, para uma proposta de presença digital mais profissional.' || chr(10) || chr(10) ||
      'A {{empresa}} ainda não possui um site próprio, e acreditamos que uma apresentação digital sob medida pode valorizar os serviços, elevar a percepção da marca e facilitar novos contatos.' || chr(10) || chr(10) ||
      'Posso te apresentar a proposta?'
    );
  END LOOP;

  UPDATE public.niches SET default_message =
    'Olá! Tudo bem? Falo com a responsável pela {{empresa}}?' || chr(10) || chr(10) ||
    'Estamos selecionando alguns negócios de estética da região de {{bairro}} para uma proposta de presença digital mais sofisticada.' || chr(10) || chr(10) ||
    'A {{empresa}} ainda não possui um site próprio, e acreditamos que uma apresentação digital elegante e sob medida pode valorizar os serviços, elevar a percepção da marca e facilitar novos contatos.' || chr(10) || chr(10) ||
    'Posso te apresentar a proposta?'
  WHERE user_id = NEW.id AND name = 'Estética / Beleza';

  INSERT INTO public.message_templates (user_id, niche_id, title, content)
  SELECT NEW.id, id, 'Abordagem inicial - ' || name, default_message FROM public.niches WHERE user_id = NEW.id;

  SELECT id INTO v_estetica FROM public.niches WHERE user_id = NEW.id AND name = 'Estética / Beleza';
  SELECT id INTO v_pet FROM public.niches WHERE user_id = NEW.id AND name = 'Pet / Banho e Tosa';
  SELECT id INTO v_oficina FROM public.niches WHERE user_id = NEW.id AND name = 'Oficinas / Automotivo';

  INSERT INTO public.leads (user_id, company, niche_id, segment, region, neighborhood, city, state, phone, whatsapp, reviews_count, rating, website_status, instagram, priority, score, opportunity_reason, status, is_demo)
  VALUES
    (NEW.id, '[DEMONSTRAÇÃO] Studio Bella Estética', v_estetica, 'Estética / Beleza', 'Zona Norte', 'Santana', 'São Paulo', 'SP', '11987650001', '11987650001', 87, 4.8, 'sem_site_confirmado', 'https://instagram.com/exemplo_demo', 'A+', 95, 'Empresa com 87 avaliações Google e sem site confirmado.', 'novo', true),
    (NEW.id, '[DEMONSTRAÇÃO] Pet Amigo Banho e Tosa', v_pet, 'Pet / Banho e Tosa', 'Zona Norte', 'Tucuruvi', 'São Paulo', 'SP', '11987650002', '11987650002', 34, 4.6, 'sem_site_confirmado', NULL, 'A', 75, 'Empresa com boa reputação local, mas sem site próprio.', 'novo', true),
    (NEW.id, '[DEMONSTRAÇÃO] Oficina Norte Motors', v_oficina, 'Oficinas / Automotivo', 'Zona Norte', 'Casa Verde', 'São Paulo', 'SP', '11987650003', NULL, 12, 4.2, 'nao_verificado', NULL, 'B', 45, 'Empresa possui presença no Google e oportunidade de fortalecer presença digital própria.', 'novo', true);

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
