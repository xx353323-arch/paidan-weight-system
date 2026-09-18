import React from 'react';
import { GRADE_TONE } from '../constants';
import { useBoardStyles } from '../styles';

type Props = {
  code: string | null;
  size?: 'default' | 'large';
};

const GradeTag: React.FC<Props> = ({ code, size = 'default' }) => {
  const { styles } = useBoardStyles();
  if (!code) return null;
  const tone = GRADE_TONE[code] ?? GRADE_TONE.B;
  return (
    <span
      className={styles.gradeTag}
      title={tone.desc}
      style={{
        color: tone.color,
        background: tone.bg,
        height: size === 'large' ? 28 : 24,
        fontSize: size === 'large' ? 13 : 12,
      }}
    >
      {code}
    </span>
  );
};

export default GradeTag;
