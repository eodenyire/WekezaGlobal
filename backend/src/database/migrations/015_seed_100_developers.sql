-- ============================================================
--  WekezaGlobal Infrastructure (WGI) — Migration 015
--  Seed 100 Developer Accounts with API Keys
--
--  Creates 100 developer accounts spanning all account_type
--  segments, each with:
--    • A user record (role = 'user', kyc_status = 'verified')
--    • One active API key (name = '<first_name>'s Default Key')
--
--  The password hash corresponds to: WekezaDev@2026
--  (bcrypt, cost 10)
--
--  All INSERTs use ON CONFLICT DO NOTHING (idempotent).
-- ============================================================

DO $$
DECLARE
  dev_password_hash TEXT := '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LnImaS70M5i';
  -- ^ bcrypt hash of 'WekezaDev@2026' (cost 10)
  account_types TEXT[] := ARRAY['freelancer','sme','exporter','ecommerce','ngo','startup','individual'];
  names TEXT[][] := ARRAY[
    ARRAY['Alice','Mwangi'],    ARRAY['Brian','Ochieng'],   ARRAY['Catherine','Wanjiku'],
    ARRAY['David','Kamau'],     ARRAY['Esther','Otieno'],   ARRAY['Francis','Mutua'],
    ARRAY['Grace','Njeri'],     ARRAY['Henry','Oduya'],     ARRAY['Irene','Chebet'],
    ARRAY['James','Kariuki'],   ARRAY['Karen','Akinyi'],    ARRAY['Leonard','Maina'],
    ARRAY['Mary','Wambui'],     ARRAY['Nelson','Omondi'],   ARRAY['Olivia','Kerubo'],
    ARRAY['Patrick','Gitau'],   ARRAY['Queen','Nafula'],    ARRAY['Robert','Kirui'],
    ARRAY['Sandra','Chepkemoi'],ARRAY['Timothy','Ngugi'],   ARRAY['Ursula','Atieno'],
    ARRAY['Victor','Mugo'],     ARRAY['Winnie','Jeptoo'],   ARRAY['Xavier','Kiptoo'],
    ARRAY['Yvonne','Achieng'],  ARRAY['Zachary','Ndungu'],  ARRAY['Abigail','Wangari'],
    ARRAY['Benjamin','Onyango'],ARRAY['Clara','Kinyua'],    ARRAY['Dennis','Ogola'],
    ARRAY['Eleanor','Muthoni'], ARRAY['Felix','Owino'],     ARRAY['Gloria','Wanjiru'],
    ARRAY['Harrison','Kimani'], ARRAY['Isabella','Rotich'], ARRAY['Joel','Opiyo'],
    ARRAY['Kalani','Wekesa'],   ARRAY['Lillian','Moraa'],   ARRAY['Martin','Kibera'],
    ARRAY['Naomi','Atieno'],    ARRAY['Oscar','Mwenda'],    ARRAY['Priscilla','Nganga'],
    ARRAY['Quinton','Otieno'],  ARRAY['Rachael','Kamau'],   ARRAY['Stephen','Mwau'],
    ARRAY['Tabitha','Wangui'],  ARRAY['Uriah','Ochieng'],   ARRAY['Vivian','Wambua'],
    ARRAY['Wilfred','Mutuku'],  ARRAY['Xena','Chelagat'],   ARRAY['Yolanda','Njoroge'],
    ARRAY['Zed','Kipkoech'],    ARRAY['Amara','Ouma'],      ARRAY['Barnabas','Mwihia'],
    ARRAY['Cynthia','Adhiambo'],ARRAY['Douglas','Waweru'],  ARRAY['Eunice','Njeru'],
    ARRAY['Frederick','Ogawa'], ARRAY['Gladys','Wafula'],   ARRAY['Humphrey','Nzomo'],
    ARRAY['Iris','Koskei'],     ARRAY['Jonathan','Barasa'], ARRAY['Ketty','Mwanzia'],
    ARRAY['Laban','Wesonga'],   ARRAY['Monica','Munyua'],   ARRAY['Nicholas','Ogunda'],
    ARRAY['Ophelia','Wanjala'], ARRAY['Philip','Mutai'],    ARRAY['Queenie','Wanyoike'],
    ARRAY['Raphael','Kipchumba'],ARRAY['Sylvia','Onyango'], ARRAY['Terrence','Mbuvi'],
    ARRAY['Ulanda','Maina'],    ARRAY['Valentine','Otieno'],ARRAY['Wendy','Gathoni'],
    ARRAY['Xerxes','Wekesa'],   ARRAY['Yusuf','Kimotho'],   ARRAY['Zipporah','Muithya'],
    ARRAY['Adrian','Makori'],   ARRAY['Beatrice','Ndolo'],  ARRAY['Conrad','Ochieng'],
    ARRAY['Dorcas','Wangui'],   ARRAY['Edwin','Omari'],     ARRAY['Florence','Muriuki'],
    ARRAY['Gerald','Ndegwa'],   ARRAY['Harriet','Mwenda'],  ARRAY['Idah','Aluoch'],
    ARRAY['Jabari','Odhiambo'], ARRAY['Kezia','Wanyama'],   ARRAY['Levi','Mwamba'],
    ARRAY['Miriam','Atieno'],   ARRAY['Nathan','Kirwi'],    ARRAY['Orpha','Muthee'],
    ARRAY['Peninah','Cheboi'],  ARRAY['Reginald','Ochieng'],ARRAY['Sheila','Mwaniki'],
    ARRAY['Titus','Onyiso'],    ARRAY['Unity','Mwangi'],    ARRAY['Viola','Oloo'],
    ARRAY['Walter','Wainaina']
  ];
  i INT;
  uid UUID;
  raw_email TEXT;
  raw_first TEXT;
  atype TEXT;
  raw_key TEXT;
  key_name TEXT;
BEGIN
  FOR i IN 1..100 LOOP
    raw_first := names[i][1];
    raw_email := lower(names[i][1]) || '.' || lower(names[i][2]) || i || '@wekeza.dev';
    atype     := account_types[1 + ((i - 1) % array_length(account_types, 1))];

    -- Insert user (idempotent)
    INSERT INTO users (full_name, email, password_hash, role, account_type, kyc_status)
    VALUES (
      names[i][1] || ' ' || names[i][2],
      raw_email,
      dev_password_hash,
      'user',
      atype,
      'verified'
    )
    ON CONFLICT (email) DO NOTHING;

    -- Retrieve the user_id (may have been inserted now or previously)
    SELECT user_id INTO uid FROM users WHERE email = raw_email LIMIT 1;

    IF uid IS NOT NULL THEN
      raw_key  := 'wgi_' || encode(gen_random_bytes(32), 'hex');
      key_name := raw_first || '''s Default Key';

      -- Insert API key only if developer has no keys yet
      INSERT INTO api_keys (user_id, api_key, name, status)
      SELECT uid, raw_key, key_name, 'active'
      WHERE NOT EXISTS (
        SELECT 1 FROM api_keys WHERE user_id = uid
      );
    END IF;
  END LOOP;
END $$;
