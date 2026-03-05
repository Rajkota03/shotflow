-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "genre" TEXT,
    "format" TEXT NOT NULL DEFAULT 'film',
    "budgetCap" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShootDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "date" DATETIME,
    "callTime" TEXT,
    "estimatedWrap" TEXT,
    "dayType" TEXT NOT NULL DEFAULT 'full',
    "isTravelDay" BOOLEAN NOT NULL DEFAULT false,
    "weatherContingency" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "locationId" TEXT,
    CONSTRAINT "ShootDay_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShootDay_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "shootDayId" TEXT,
    "sceneNumber" TEXT NOT NULL,
    "sceneName" TEXT NOT NULL,
    "intExt" TEXT NOT NULL DEFAULT 'INT',
    "dayNight" TEXT NOT NULL DEFAULT 'DAY',
    "pageCount" REAL NOT NULL DEFAULT 1,
    "synopsis" TEXT,
    "scriptPageRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unscheduled',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Scene_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CastMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "characterName" TEXT,
    "roleType" TEXT NOT NULL DEFAULT 'lead',
    "dayRate" REAL NOT NULL DEFAULT 0,
    "travelRequired" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CastMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CastSceneLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "castId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CastSceneLink_castId_fkey" FOREIGN KEY ("castId") REFERENCES "CastMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CastSceneLink_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "locationType" TEXT NOT NULL DEFAULT 'studio',
    "dailyRentalCost" REAL NOT NULL DEFAULT 0,
    "permitCost" REAL NOT NULL DEFAULT 0,
    "travelDistanceKm" REAL NOT NULL DEFAULT 0,
    "hasPower" BOOLEAN NOT NULL DEFAULT true,
    "hasParking" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Location_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrewMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT 'production',
    "role" TEXT NOT NULL,
    "dayRate" REAL NOT NULL DEFAULT 0,
    "overtimeRate" REAL NOT NULL DEFAULT 0,
    "contractedDays" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrewMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'camera',
    "dailyRental" REAL NOT NULL DEFAULT 0,
    "vendor" TEXT,
    "quantityAvailable" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Equipment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentDayLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "shootDayId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipmentDayLink_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquipmentDayLink_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sceneId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "shotNumber" TEXT NOT NULL,
    "shotType" TEXT NOT NULL DEFAULT 'Wide',
    "cameraAngle" TEXT,
    "lensMm" INTEGER,
    "cameraMovement" TEXT NOT NULL DEFAULT 'Static',
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "dialogueRef" TEXT,
    "setupTimeMinutes" INTEGER NOT NULL DEFAULT 15,
    "isVfx" BOOLEAN NOT NULL DEFAULT false,
    "storyboardUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shot_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Shot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "costDelta" REAL NOT NULL DEFAULT 0,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetChangeLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ShootDay_projectId_idx" ON "ShootDay"("projectId");

-- CreateIndex
CREATE INDEX "Scene_projectId_idx" ON "Scene"("projectId");

-- CreateIndex
CREATE INDEX "Scene_shootDayId_idx" ON "Scene"("shootDayId");

-- CreateIndex
CREATE INDEX "CastMember_projectId_idx" ON "CastMember"("projectId");

-- CreateIndex
CREATE INDEX "CastSceneLink_castId_idx" ON "CastSceneLink"("castId");

-- CreateIndex
CREATE INDEX "CastSceneLink_sceneId_idx" ON "CastSceneLink"("sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "CastSceneLink_castId_sceneId_key" ON "CastSceneLink"("castId", "sceneId");

-- CreateIndex
CREATE INDEX "Location_projectId_idx" ON "Location"("projectId");

-- CreateIndex
CREATE INDEX "CrewMember_projectId_idx" ON "CrewMember"("projectId");

-- CreateIndex
CREATE INDEX "Equipment_projectId_idx" ON "Equipment"("projectId");

-- CreateIndex
CREATE INDEX "EquipmentDayLink_equipmentId_idx" ON "EquipmentDayLink"("equipmentId");

-- CreateIndex
CREATE INDEX "EquipmentDayLink_shootDayId_idx" ON "EquipmentDayLink"("shootDayId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentDayLink_equipmentId_shootDayId_key" ON "EquipmentDayLink"("equipmentId", "shootDayId");

-- CreateIndex
CREATE INDEX "Shot_sceneId_idx" ON "Shot"("sceneId");

-- CreateIndex
CREATE INDEX "Shot_projectId_idx" ON "Shot"("projectId");

-- CreateIndex
CREATE INDEX "BudgetChangeLog_projectId_idx" ON "BudgetChangeLog"("projectId");

-- CreateIndex
CREATE INDEX "BudgetChangeLog_createdAt_idx" ON "BudgetChangeLog"("createdAt");
