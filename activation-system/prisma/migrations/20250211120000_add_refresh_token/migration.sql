-- CreateTable
CREATE TABLE "RefreshToken" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER,
  "clientId" INTEGER,
  "role" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");
CREATE UNIQUE INDEX "RefreshToken_userId_role_key" ON "RefreshToken"("userId", "role");
CREATE UNIQUE INDEX "RefreshToken_clientId_role_key" ON "RefreshToken"("clientId", "role");

-- Foreign keys
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Trigger to update "updatedAt"
CREATE OR REPLACE FUNCTION refresh_token_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_token_set_updated_at
BEFORE UPDATE ON "RefreshToken"
FOR EACH ROW
EXECUTE FUNCTION refresh_token_set_updated_at();
