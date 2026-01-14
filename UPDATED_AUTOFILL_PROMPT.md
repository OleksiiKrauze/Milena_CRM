# Updated Autofill Prompt for Tags

## Instructions for updating the database

The autofill prompt is stored in the `settings` table. You need to update the `case_autofill_prompt` field with the new tags section.

## Updated Tags Section in Prompt

Replace the existing tags description in the prompt with the following:

```
   - tags: теги для категоризації - ОБОВ'ЯЗКОВО вибирай ЛИШЕ з цього списку:

     ВІКОВІ КАТЕГОРІЇ (визначається ЗАВЖДИ на основі дати народження):
     * "Дитина до 14" - якщо вік < 14 років
     * "Підліток 14-18" - якщо вік 14-17 років
     * "Дорослий 18-60" - якщо вік 18-60 років
     * "Літня людина 60+" - якщо вік > 60 років

     ІНШІ ТЕГИ (тільки якщо ЧІТКО згадано в тексті):
     * "Проблеми з пам'яттю" - деменція, Альцгеймер, втрата пам'яті
     * "Потребує медичної допомоги" - серйозні захворювання, постійні ліки
     * "Дезорієнтація" - втрата орієнтації в просторі/часі
     * "Алкогольна залежність" - згадана залежність від алкоголю
     * "Наркотична залежність" - згадана наркозалежність
     * "Військовий" - є військовослужбовцем
     * "Рецидив" - зникав раніше
     * "Психічні розлади" - психічні захворювання
     * "Особа з інвалідністю" - згадана інвалідність
     * "Суїцидальні нахили" - суїцидальні думки/спроби
     * "Схильність до агресії" - агресивна поведінка

   ВАЖЛИВО: Повертай ТІЛЬКИ теги з цього списку (точний текст)!
   Приклад: tags: ["Дитина до 14", "Проблеми з пам'яттю"]
```

## SQL Command to Update

```sql
UPDATE settings
SET case_autofill_prompt = '<paste the full updated prompt here>'
WHERE id = 1;
```

## Important Notes

1. The backend now validates all tags returned by GPT-4 against the predefined list
2. Age-based tags should ALWAYS be determined if birthdate is provided
3. Other tags should only be included if explicitly mentioned in the text
4. Invalid tags will be automatically filtered out by the backend validation
