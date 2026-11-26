# Lab Schema Documentation

## Overview

This document describes the Appwrite table schemas for the Interactive Automotive Lab system. These tables support offline-capable lab exercise tracking with no AI or network requirements.

## Tables

### 1. `learning_progress` (Existing - Reusable)

| Column | Type | Size/Constraints | Index | Permissions |
|--------|------|------------------|-------|-------------|
| `$id` | String | 36 chars (UUID) | Primary Key | - |
| `userId` | String | 36 chars (UUID) | Index | User can read/write own rows |
| `moduleId` | String | 36 chars (UUID) | Index | - |
| `progressPercent` | Number | 0-100 | - | - |
| `completed` | Boolean | - | - | - |
| `startedAt` | String (ISO Date) | - | - | - |
| `completedAt` | String (ISO Date, nullable) | - | - | - |

## 4. User Profiles (Existing - Authentication)

| Column | Type | Size/Constraints | Index | Permissions |
|--------|------|------------------|-------|-------------|
| `$id` | String | 36 chars (UUID) | Primary Key | - |
| `userId` | String | - | Unique | - |
| `fullName` | String | - | - | - |
| `email` | String | - | Unique | - |
| `role` | String | 'student' 'mechanic' 'instructor' 'admin' | - | - |
| `institutionId` | String (nullable) | - | - | - |
| `departmentId` | String (nullable) | - | - | - |

**Permissions:** User can read/write own profile. Instructors/admins have broader access.

---

## API Functions

### `saveLabAttempt(userId, exerciseId, score, durationSec, mistakes, passed)`

Creates a new lab attempt record in the `lab_attempts` table.

**Parameters:**
- `userId` (string): Appwrite user ID
- `exerciseId` (string): Exercise ID (e.g., 'exercise-1')
- `score` (number): Score achieved (0-100)
- `durationSec` (number): Time spent in seconds
- `mistakes` (number): Number of mistakes made
- `passed` (boolean): Whether the passScore was achieved

**Returns:** The created lab attempt document

---

### `getModuleLabProgress(userId, moduleId)`

Gets the lab progress for a user on a specific module.

**Parameters:**
- `userId` (string): Appwrite user ID
- `moduleId` (string): Module ID

**Returns:** Array of lab attempt objects, or empty array if no attempts found

**Query:**
```javascript
const results = await databases.listDocuments(
  DATABASE_ID,
  COLLECTIONS.LAB_ATTEMPTS,
  [Query.equal('userId', userId), Query.equal('exerciseId', /* filter by exercises in module */)]
);
```

---

## Offline Fallback

When Appwrite is not available (offline mode), the lab engine:

1. **Stores attempts in localStorage** with key `lab_attempts_${userId}`
2. **Synchronizes when connection is restored** by re-saving to Appwrite
3. **Shows "progress not saved" message** instead of crashing if the database is unavailable
4. **Displays existing local attempts** on the finish screen if any exist

**LocalStorage Schema:**
```javascript
{
  attempts: [
    { exerciseId, score, durationSec, mistakes, passed, completedAt }
  ]
}
```
**Usage for lab attempts:** This existing table can store lab progress percent and completion status. Each row represents a user's progress on a module.