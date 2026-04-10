DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = '_UserKebuns'
  ) THEN
    CREATE TABLE "_UserKebuns" (
      "A" INTEGER NOT NULL,
      "B" INTEGER NOT NULL
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "_UserKebuns_AB_unique" ON "_UserKebuns"("A", "B");
CREATE INDEX IF NOT EXISTS "_UserKebuns_B_index" ON "_UserKebuns"("B");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_UserKebuns_A_fkey') THEN
    ALTER TABLE "_UserKebuns"
      ADD CONSTRAINT "_UserKebuns_A_fkey"
      FOREIGN KEY ("A") REFERENCES "Kebun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_UserKebuns_B_fkey') THEN
    ALTER TABLE "_UserKebuns"
      ADD CONSTRAINT "_UserKebuns_B_fkey"
      FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

