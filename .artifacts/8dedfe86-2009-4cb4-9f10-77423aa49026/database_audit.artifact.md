# Appwrite Database Configuration Checklist

This document details the exact configuration required for the Appwrite database `autofix-ai-db` based on the current AutoFix AI codebase.

## Database ID: `autofix-ai-db`

---

## 1. Collection: `profiles`
**Collection ID**: `profiles`

### Attributes
| Attribute ID | Type | Size | Required | Array | Default |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `userId` | string | 36 | Yes | No | - |
| `fullName` | string | 255 | Yes | No | - |
| `email` | string | 255 | Yes | No | - |
| `role` | string | 20 | Yes | No | `student` |
| `avatarUrl` | string | 500 | No | No | - |
| `preferredLanguage` | string | 5 | Yes | No | `en` |
| `createdAt` | datetime | - | Yes | No | - |
| `updatedAt` | datetime | - | Yes | No | - |

### Indexes
- **Type**: Key, **Attributes**: `userId` (Unique)

### Permissions (Document Level Security: ON)
- **Role**: `Any`, **Action**: `Create` (During registration)
- **Role**: `User (Self)`, **Action**: `Read`, `Update`

---

## 2. Collection: `learning_modules`
**Collection ID**: `learning_modules`

### Attributes
| Attribute ID | Type | Size | Required | Array | Default |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `title` | string | 255 | Yes | No | - |
| `description` | string | 1000 | Yes | No | - |
| `category` | string | 100 | Yes | No | - |
| `level` | string | 20 | Yes | No | `beginner` |
| `thumbnail` | string | 500 | No | No | - |
| `content` | string | 16381 | No | No | - |
| `estimatedMinutes` | integer | - | Yes | No | 0 |
| `isPublished` | boolean | - | Yes | No | `false` |
| `createdAt` | datetime | - | Yes | No | - |
| `updatedAt` | datetime | - | Yes | No | - |

### Indexes
- **Type**: Key, **Attributes**: `isPublished`
- **Type**: Key, **Attributes**: `category`

### Permissions
- **Role**: `Any`, **Action**: `Read`
- **Role**: `Admin`, **Action**: `Create`, `Update`, `Delete`

---

## 3. Collection: `learning_progress`
**Collection ID**: `learning_progress`

### Attributes
| Attribute ID | Type | Size | Required | Array | Default |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `userId` | string | 36 | Yes | No | - |
| `moduleId` | string | 36 | Yes | No | - |
| `progressPercent` | integer | - | Yes | No | 0 |
| `completed` | boolean | - | Yes | No | `false` |
| `startedAt` | datetime | - | Yes | No | - |
| `completedAt` | datetime | - | No | No | - |
| `updatedAt` | datetime | - | Yes | No | - |

### Indexes
- **Type**: Key, **Attributes**: `userId`, `moduleId` (Unique/Composite)

### Permissions (Document Level Security: ON)
- **Role**: `User (Self)`, **Action**: `Read`, `Create`, `Update`

---

## 4. Collection: `vehicle_profiles`
**Collection ID**: `vehicle_profiles`

### Attributes
| Attribute ID | Type | Size | Required | Array | Default |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `userId` | string | 36 | Yes | No | - |
| `make` | string | 100 | Yes | No | - |
| `model` | string | 100 | Yes | No | - |
| `year` | integer | - | Yes | No | - |
| `engine` | string | 100 | Yes | No | - |
| `fuelType` | string | 50 | Yes | No | - |
| `mileage` | integer | - | Yes | No | 0 |
| `notes` | string | 1000 | No | No | - |
| `createdAt` | datetime | - | Yes | No | - |
| `updatedAt` | datetime | - | Yes | No | - |

### Indexes
- **Type**: Key, **Attributes**: `userId`

### Permissions (Document Level Security: ON)
- **Role**: `User (Self)`, **Action**: `Read`, `Create`, `Update`, `Delete`

---

## 5. Collection: `diagnostic_sessions`
**Collection ID**: `diagnostic_sessions`

### Attributes
| Attribute ID | Type | Size | Required | Array | Default |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `userId` | string | 36 | Yes | No | - |
| `vehicleId` | string | 36 | Yes | No | - |
| `userInput` | string | 5000 | Yes | No | - |
| `requestData` | string | 16381 | Yes | No | - |
| `result` | string | 16381 | Yes | No | - |
| `status` | string | 20 | Yes | No | `active` |
| `createdAt` | datetime | - | Yes | No | - |
| `updatedAt` | datetime | - | Yes | No | - |

> [!IMPORTANT]
> `requestData` and `result` must be stored as **stringified JSON**.
> Note: Appwrite has a maximum string size of **16,381** characters.

### Indexes
- **Type**: Key, **Attributes**: `userId`
- **Type**: Key, **Attributes**: `$createdAt` (Descending)

### Permissions (Document Level Security: ON)
- **Role**: `User (Self)`, **Action**: `Read`, `Create`, `Update`, `Delete`

---

## 6. Collection: `repair_guides`
**Collection ID**: `repair_guides`

### Attributes
| Attribute ID | Type | Size | Required | Array | Default |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `title` | string | 255 | Yes | No | - |
| `description` | string | 1000 | Yes | No | - |
| `category` | string | 100 | Yes | No | - |
| `difficulty` | string | 20 | Yes | No | - |
| `steps` | string | 5000 | Yes | Yes | - |
| `safetyNotes` | string | 2000 | No | No | - |
| `requiredTools` | string | 255 | No | Yes | - |
| `createdAt` | datetime | - | Yes | No | - |
| `updatedAt` | datetime | - | Yes | No | - |

### Indexes
- **Type**: Key, **Attributes**: `category`

### Permissions
- **Role**: `Any`, **Action**: `Read`
- **Role**: `Admin`, **Action**: `Create`, `Update`, `Delete`

---

## Summary of Missing vs. Required
1. **Large String Sizes**: `diagnostic_sessions.result` requires a very large size (20k+) to store structured AI output.
2. **JSON Handling**: Since Appwrite doesn't have a native JSON type, the frontend must `JSON.stringify` before saving and `JSON.parse` after fetching.
3. **Document Level Security**: Must be explicitly enabled for `profiles`, `learning_progress`, `vehicle_profiles`, and `diagnostic_sessions`.
4. **Roles**: Ensure the `UserRole` string values match exactly: `student`, `mechanic`, `teacher`, `vehicle_owner`, `admin`.
