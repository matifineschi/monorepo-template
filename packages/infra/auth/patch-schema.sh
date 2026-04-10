#!/bin/bash

# Since better auth's drizzle adapter doesn't allow specifying a custom pg
# schema we have to patch the output so that the auth schema used is a schema
# that doesn't clash with the public schema

FILE=../db/src/schema/user-auth.ts &&
  grep -q "const userAuthSchema = pgSchema" "$FILE" ||
  sed -i.bak '1s|^|import { pgSchema } from "drizzle-orm/pg-core";\nexport const userAuthSchema = pgSchema("user_auth");\n\n|' "$FILE" &&
  sed -i.bak 's/\pgTable\s*(/userAuthSchema.table(/g' "$FILE" &&
  # Replace the email column definition to drop the unique constraint
  sed -i.bak 's/email: text("email")\.notNull()\.unique(),/email: text("email"),/g' "$FILE" &&
  rm "$FILE.bak" &&
  bun biome check --write --unsafe "$FILE"
