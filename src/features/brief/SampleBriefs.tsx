import sampleBriefs from '../../data/kit/encargos-de-ejemplo.json';
import { ChoiceChips } from '../../design-system/extensions/ChoiceChips';
import styles from './BriefView.module.css';

/** "Éxito: encargo claro, …" becomes "Éxito"; the persona tells B and C apart. */
function chipLabel(sample: { persona: string; casoQuePrueba: string }): string {
  const [caseName = ''] = sample.casoQuePrueba.split(':');
  return sample.persona === 'A' ? caseName : `Persona ${sample.persona}`;
}

const SAMPLES = sampleBriefs.encargos.map((sample) => ({
  label: chipLabel(sample),
  text: sample.texto,
}));

export interface SampleBriefsProps {
  onPick: (text: string) => void;
}

/** The kit's sample needs, one tap away, so every state of the view can be reached. */
export function SampleBriefs({ onPick }: SampleBriefsProps) {
  return (
    <div className={styles.samples}>
      <p className={styles.meta}>O empieza con un ejemplo:</p>
      <ChoiceChips
        label="Ejemplos de necesidades"
        options={SAMPLES.map((sample) => sample.label)}
        onSelect={(label) => {
          const sample = SAMPLES.find((candidate) => candidate.label === label);
          if (sample) onPick(sample.text);
        }}
      />
    </div>
  );
}
