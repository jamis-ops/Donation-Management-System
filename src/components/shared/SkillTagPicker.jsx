import { Sparkles } from 'lucide-react'
import { VOLUNTEER_SKILLS } from '../../constants/options'
import MultiSelectBox from './MultiSelectBox'

/**
 * Multi-select skill picker inside a clean box/card layout with live CMS synchronization.
 */
export default function SkillTagPicker({
  value = [],
  other = '',
  onChange,
  onOtherChange,
  label = 'Skills & Expertise',
  placeholder = 'Select a skill to add…',
  required = false,
  showOther = true,
  hint = 'Select skills you can contribute to volunteer activities.',
}) {
  return (
    <MultiSelectBox
      catalog="volunteer_skills"
      fallback={VOLUNTEER_SKILLS}
      value={value}
      onChange={onChange}
      other={other}
      onOtherChange={onOtherChange}
      label={label}
      placeholder={placeholder}
      required={required}
      showOther={showOther}
      otherLabel="Other skills (optional)"
      otherPlaceholder="e.g. Scuba certified, Forklift operator, Licensed drone pilot…"
      icon={Sparkles}
      hint={hint}
    />
  )
}
