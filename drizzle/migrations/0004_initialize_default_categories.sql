CREATE OR REPLACE FUNCTION public.default_category_names()
RETURNS TABLE(name text)
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ VALUES ('Groceries'), ('Dining'), ('Household'), ('Personal care'), ('Health'), ('Clothing'), ('Electronics'), ('Transport'), ('Utilities'), ('Entertainment'), ('Education'), ('Other') $$;

CREATE OR REPLACE FUNCTION public.initialize_profile_categories()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories(user_id, name)
  SELECT NEW.id, defaults.name FROM public.default_category_names() AS defaults
  ON CONFLICT (user_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.initialize_profile_categories() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_initialize_categories
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.initialize_profile_categories();