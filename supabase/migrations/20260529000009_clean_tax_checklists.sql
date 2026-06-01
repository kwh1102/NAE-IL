DO $$ 
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'woohyun6191102@gmail.com';
  
  IF target_user_id IS NOT NULL THEN
    DELETE FROM public.tax_checklists WHERE store_id = target_user_id;
  END IF;
END $$;
