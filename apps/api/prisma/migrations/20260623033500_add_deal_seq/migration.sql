-- Atomic, contention-free deal id allocation for concurrent creates
-- (replaces a max()+1 scan that collides under parallel load).
-- Starts above any seeded DEAL-00x ids.
CREATE SEQUENCE IF NOT EXISTS deal_seq START WITH 1000 INCREMENT BY 1;
