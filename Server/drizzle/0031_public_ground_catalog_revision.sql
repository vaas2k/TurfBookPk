CREATE TABLE IF NOT EXISTS public_ground_catalog_revision (
  id integer PRIMARY KEY CHECK (id = 1),
  revision bigint NOT NULL DEFAULT 1
);
INSERT INTO public_ground_catalog_revision (id, revision) VALUES (1, 1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION bump_public_ground_catalog_revision() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public_ground_catalog_revision SET revision = revision + 1 WHERE id = 1;
  RETURN NULL;
END;
$$;

CREATE TRIGGER grounds_catalog_revision_change
AFTER INSERT OR UPDATE OR DELETE ON grounds
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_ground_catalog_revision();

CREATE TRIGGER vendors_catalog_visibility_change
AFTER UPDATE OF is_active, verification_status ON vendors
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_ground_catalog_revision();
