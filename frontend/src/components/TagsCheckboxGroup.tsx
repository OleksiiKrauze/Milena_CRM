import { PREDEFINED_TAGS } from '@/constants/tags';

interface TagsCheckboxGroupProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  error?: string;
}

export function TagsCheckboxGroup({ selectedTags, onChange, error }: TagsCheckboxGroupProps) {
  const handleToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter(t => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Теги для категоризації
      </label>
      <div className="space-y-2 border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
        {PREDEFINED_TAGS.map((tag) => (
          <label
            key={tag}
            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
          >
            <input
              type="checkbox"
              checked={selectedTags.includes(tag)}
              onChange={() => handleToggle(tag)}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">{tag}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      {selectedTags.length > 0 && (
        <p className="text-xs text-gray-500 mt-2">Вибрано: {selectedTags.length}</p>
      )}
    </div>
  );
}
