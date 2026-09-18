import { createStyles } from 'antd-style';

export const useDispatchStyles = createStyles(({ token, css }) => ({
  filterRow: css`
    display: flex;
    align-items: center;
    gap: 12px 20px;
    flex-wrap: wrap;
  `,
  filterBlock: css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  `,
  filterLabel: css`
    font-size: 13px;
    color: ${token.colorTextTertiary};
    white-space: nowrap;
  `,
  tagArea: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 260px;
  `,
  rankBadge: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: ${token.colorTextSecondary};
    background: ${token.colorFillSecondary};
  `,
  rankGold: css`
    color: #7c4a00;
    background: linear-gradient(135deg, #ffe58f 0%, #ffc53d 100%);
    box-shadow: 0 1px 4px rgba(250, 173, 20, 0.45);
  `,
  rankSilver: css`
    color: #4d4d4d;
    background: linear-gradient(135deg, #f0f0f0 0%, #c9c9c9 100%);
    box-shadow: 0 1px 4px rgba(140, 140, 140, 0.35);
  `,
  rankBronze: css`
    color: #6b3a10;
    background: linear-gradient(135deg, #ffd8a8 0%, #d48806 100%);
    box-shadow: 0 1px 4px rgba(212, 136, 6, 0.35);
  `,
  scoreCell: css`
    display: flex;
    align-items: baseline;
    gap: 8px;
  `,
  scoreValue: css`
    font-size: 20px;
    font-weight: 600;
    line-height: 26px;
    font-variant-numeric: tabular-nums;
    color: ${token.colorText};
  `,
  scoreBand: css`
    font-size: 12px;
    color: ${token.colorTextQuaternary};
    font-variant-numeric: tabular-nums;
  `,
  tagHit: css`
    font-weight: 700;
    box-shadow: 0 0 0 1px ${token.colorPrimaryBorder};
  `,
  tagDim: css`
    opacity: 0.45;
  `,
  tieRow: css`
    &&& > td {
      background: ${token.colorWarningBg};
    }
  `,
  frozenRow: css`
    &&& > td {
      opacity: 0.5;
    }
  `,
  nameButton: css`
    padding: 0;
    height: auto;
    font-weight: 600;
  `,
  sectionTitle: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
    margin-bottom: 4px;
  `,
  blockRow: css`
    padding: 10px 0;
    border-bottom: 1px dashed ${token.colorSplit};
    &:last-child {
      border-bottom: none;
    }
  `,
  blockMissing: css`
    opacity: 0.55;
  `,
  blockHead: css`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 4px;
  `,
  blockName: css`
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  blockScore: css`
    font-size: 16px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  `,
  blockMeta: css`
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin-top: 4px;
    font-size: 12px;
    color: ${token.colorTextTertiary};
    font-variant-numeric: tabular-nums;
  `,
  coverRow: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 0;
    border-bottom: 1px dashed ${token.colorSplit};
    font-size: 13px;
    &:last-child {
      border-bottom: none;
    }
  `,
  coverMeta: css`
    color: ${token.colorTextSecondary};
    font-variant-numeric: tabular-nums;
  `,
  adjustRow: css`
    padding: 8px 0;
    border-bottom: 1px dashed ${token.colorSplit};
    font-size: 13px;
    &:last-child {
      border-bottom: none;
    }
  `,
  adjustMeta: css`
    margin-top: 2px;
    font-size: 12px;
    color: ${token.colorTextTertiary};
    font-variant-numeric: tabular-nums;
  `,
}));
