ALTER TABLE auth.registration_applications
  ADD COLUMN request_hash TEXT NOT NULL;

CREATE INDEX registration_applications_request_hash_idx
  ON auth.registration_applications(request_hash);
