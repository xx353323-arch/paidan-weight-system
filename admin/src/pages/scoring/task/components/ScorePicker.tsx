import { Tooltip } from 'antd';
import { SCORE_HINT, SCORE_RANGE, SCORE_TONE } from '../constants';
import { useScoringStyles } from '../styles';

type ScorePickerProps = {
  value?: number;
  onChange?: (score: number) => void;
  disabled?: boolean;
  readonly?: boolean;
};

const ScorePicker = ({
  value,
  onChange,
  disabled,
  readonly,
}: ScorePickerProps) => {
  const { styles, cx } = useScoringStyles();

  return (
    <div className={styles.scoreRow}>
      {SCORE_RANGE.map((score) => {
        const active = value === score;
        const tone = SCORE_TONE[score];
        const button = (
          <button
            key={score}
            type="button"
            disabled={disabled || readonly}
            aria-pressed={active}
            className={cx(
              styles.scoreButton,
              readonly && styles.scoreButtonReadonly,
            )}
            style={
              active
                ? { background: tone, borderColor: tone, color: '#fff' }
                : undefined
            }
            onClick={() => {
              if (disabled || readonly || active) return;
              onChange?.(score);
            }}
          >
            {score}
          </button>
        );
        if (disabled || readonly) return button;
        return (
          <Tooltip key={score} title={SCORE_HINT[score]} mouseEnterDelay={0.45}>
            {button}
          </Tooltip>
        );
      })}
    </div>
  );
};

export default ScorePicker;
