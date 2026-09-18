import { createStyles, responsive } from 'antd-style';

export const useWorkbenchStyles = createStyles(({ token, css }) => ({
  welcome: css`
    margin-bottom: 16px;
  `,
  welcomeRow: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  `,
  greeting: css`
    font-size: 22px;
    font-weight: 600;
    color: ${token.colorText};
    line-height: 1.4;
  `,
  subGreeting: css`
    font-size: 13px;
    color: ${token.colorTextTertiary};
    margin-top: 4px;
  `,
  deadline: css`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    ${responsive.mobile} {
      align-items: flex-start;
    }
  `,
  deadlineValue: css`
    font-size: 18px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: ${token.colorText};
  `,
  deadlineUrgent: css`
    color: ${token.colorError};
  `,
  deadlineLabel: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  ringRow: css`
    display: flex;
    align-items: center;
    gap: 24px;
    flex-wrap: wrap;
  `,
  ringMeta: css`
    flex: 1;
    min-width: 160px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,
  ringHeadline: css`
    font-size: 16px;
    color: ${token.colorText};
  `,
  ringNumber: css`
    font-size: 22px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: ${token.colorPrimary};
    margin: 0 4px;
  `,
  miniTiles: css`
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
  `,
  miniTile: css`
    display: flex;
    flex-direction: column;
    line-height: 1.3;
  `,
  miniValue: css`
    font-size: 16px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  `,
  miniLabel: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  rankName: css`
    font-weight: 600;
  `,
  rankScore: css`
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  `,
  pendingBox: css`
    max-height: 132px;
    overflow: auto;
    padding: 8px 10px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};
  `,
  cardFooter: css`
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
  `,
}));
