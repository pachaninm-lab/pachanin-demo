-- PostgreSQL does not allow CREATE OR REPLACE FUNCTION to rename input
-- parameters. The command signatures remain type-compatible, but RUB-named
-- parameters are replaced by canonical kopeck-named parameters in the next
-- migration. Drop only those two functions before recreating them.

DROP FUNCTION IF EXISTS auction.register_verified_lot(
  text,
  text,
  text,
  numeric,
  bigint,
  bigint,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  boolean,
  integer,
  integer,
  text,
  text
);

DROP FUNCTION IF EXISTS auction.place_bid(
  text,
  bigint,
  numeric,
  bigint,
  text,
  text
);
