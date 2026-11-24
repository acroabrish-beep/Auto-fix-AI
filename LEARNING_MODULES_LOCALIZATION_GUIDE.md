# Learning Modules Localization Migration Guide

This guide explains how to update the Appwrite `learning_modules` collection to support full localization for course content across all 4 languages (English, Amharic, Oromo, Sidama).

## Overview

The application now supports localized course content stored directly in the Appwrite database. This approach is more reliable and performant than on-the-fly API translation.

## Schema Changes

Add the following optional attributes to your `learning_modules` collection in Appwrite:

### Title Fields
- `title_am` (string, optional): Amharic translation of the module title
- `title_om` (string, optional): Oromo translation of the module title
- `title_sid` (string, optional): Sidama translation of the module title

### Description Fields
- `description_am` (string, optional): Amharic translation of the module description
- `description_om` (string, optional): Oromo translation of the module description
- `description_sid` (string, optional): Sidama translation of the module description

### Content Fields
- `content_am` (string, optional): Amharic translation of the module content
- `content_om` (string, optional): Oromo translation of the module content
- `content_sid` (string, optional): Sidama translation of the module content

## Migration Steps

### Step 1: Add New Attributes in Appwrite Console

1. Go to your Appwrite Console
2. Navigate to Databases → your database → `learning_modules` collection
3. Click on "Attributes" → "Add Attribute"
4. Add the following attributes one by one:

For each language (am, om, sid):
- Add `title_{lang}` as String (optional)
- Add `description_{lang}` as String (optional)
- Add `content_{lang}` as String (optional, can be long text)

Example for Amharic:
- `title_am` → String → Optional
- `description_am` → String → Optional
- `content_am` → String → Optional (set size to large if needed)

### Step 2: Populate Translations

For each existing learning module document:

1. Open the document in Appwrite Console
2. Add translations for each field:
   - If you have Amharic content, fill in `title_am`, `description_am`, `content_am`
   - If you have Oromo content, fill in `title_om`, `description_om`, `content_om`
   - If you have Sidama content, fill in `title_sid`, `description_sid`, `content_sid`
3. Save the document

### Step 3: Verify the Implementation

The application code has been updated to:
- Automatically detect the user's language preference
- Display the appropriate localized content
- Fall back to English if a translation is not available

## How It Works

### Localization Logic

The `localizeLearningModule` function in `src/lib/localizeContent.ts` handles the localization:

```typescript
export const localizeLearningModule = (module: LearningModule, t: TFunction): LearningModule => {
  const currentLang = t('language') || 'en';

  const getLocalizedField = (
    field: string,
    fieldAm?: string,
    fieldOm?: string,
    fieldSid?: string
  ): string => {
    switch (currentLang) {
      case 'am':
        return fieldAm || field;
      case 'om':
        return fieldOm || field;
      case 'sid':
        return fieldSid || field;
      default:
        return field;
    }
  };

  return {
    ...module,
    title: getLocalizedField(module.title, module.title_am, module.title_om, module.title_sid),
    description: getLocalizedField(
      module.description,
      module.description_am,
      module.description_om,
      module.description_sid
    ),
    content: getLocalizedField(
      module.content || '',
      module.content_am,
      module.content_om,
      module.content_sid
    ),
  };
};
```

### Fallback Behavior

- If the user's language is Amharic but `title_am` is empty, it falls back to `title` (English)
- If the user's language is English, it uses the original `title`, `description`, `content` fields
- This ensures the app always displays content, even if translations are incomplete

## Components Updated

1. **LearningModule.tsx** - Uses `localizeLearningModule` to display localized title, description, and content
2. **LearningCard.tsx** - Uses `localizeLearningModule` to display localized title and description in the card view
3. **types/index.ts** - Updated `LearningModule` interface to include optional localized fields

## Testing

After completing the migration:

1. Change your language preference in Settings to Amharic, Oromo, or Sidama
2. Navigate to the Learning page
3. Verify that module titles and descriptions appear in the selected language
4. Click on a module and verify the content is also localized
5. Switch back to English to verify the fallback works correctly

## Example Data Structure

Before migration:
```json
{
  "title": "Automotive Fundamentals",
  "description": "Learn the basics of automotive systems",
  "content": "This course covers...",
  "category": "Automotive Fundamentals",
  "level": "beginner"
}
```

After migration (with Amharic example):
```json
{
  "title": "Automotive Fundamentals",
  "title_am": "የመኪና መሠረታዊ ነገሮች",
  "description": "Learn the basics of automotive systems",
  "description_am": "የመኪና ስርዓቶችን መሰረታዊ ነገሮች ይማሩ",
  "content": "This course covers...",
  "content_am": "ይህ ኮርስ የሚያስተምረው...",
  "category": "Automotive Fundamentals",
  "level": "beginner"
}
```

## Notes

- All localized fields are **optional**. You can add them gradually as translations become available
- The existing English content (`title`, `description`, `content`) should remain as the primary/backup content
- UI labels (buttons, navigation, etc.) are already localized via the translation files in `src/lib/appTranslations/`
- Only the course content itself needs to be added to the database

## Support

If you encounter any issues during migration:
1. Check that all new attributes are added correctly in Appwrite
2. Verify the attribute names match exactly: `title_am`, `title_om`, `title_sid`, etc.
3. Ensure the TypeScript types are updated (already done in this implementation)
4. Check the browser console for any errors related to data fetching
