import Field from '../../shared/components/Field'
import { PROPERTY_FIELDS } from '../../shared/constants/formHelpers'

export default function StepMapping({ wizard }) {
  const { propertyMap, setPropertyMap, notionResult } = wizard

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-fg-muted">
        감지된 Notion 속성과 GitHub 메타데이터를 연결합니다. 기본값은 자동으로 맞춰지며 필요한 경우 직접 수정할 수 있습니다.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {PROPERTY_FIELDS.map((field) => (
          <Field key={field.key} label={field.label}>
            <select
              value={propertyMap[field.key] || ''}
              onChange={(event) => setPropertyMap((prev) => ({
                ...prev,
                [field.key]: event.target.value,
              }))}
            >
              <option value="">선택 안 함</option>
              {Object.keys(notionResult?.properties || {}).map((propertyName) => (
                <option key={propertyName} value={propertyName}>
                  {propertyName}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>
    </div>
  )
}
