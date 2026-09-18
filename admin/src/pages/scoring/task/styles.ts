import { createStyles, keyframes, responsive } from 'antd-style';
import { LAYOUT_HEADER_OFFSET } from './constants';

const flash = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0); }
  20% { box-shadow: 0 0 0 3px rgba(255, 77, 79, 0.55); }
  60% { box-shadow: 0 0 0 3px rgba(255, 77, 79, 0.55); }
  100% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0); }
`;

export const useScoringStyles = createStyles(({ token, css }) => ({
  shell: css`
    display: flex;
    align-items: flex-start;
    gap: 16px;
    ${responsive.laptop} {
      display: block;
    }
  `,
  mainColumn: css`
    flex: 1;
    min-width: 0;
  `,
  navColumn: css`
    flex: 0 0 196px;
    width: 196px;
    position: sticky;
    top: ${LAYOUT_HEADER_OFFSET + 96}px;
    max-height: calc(100vh - ${LAYOUT_HEADER_OFFSET + 128}px);
    overflow: auto;
    ${responsive.laptop} {
      display: none;
    }
  `,
  statsBar: css`
    position: sticky;
    top: ${LAYOUT_HEADER_OFFSET}px;
    z-index: 12;
    margin-bottom: 12px;
    padding: 10px 16px;
    border-radius: ${token.borderRadiusLG}px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorBgContainer};
    box-shadow: ${token.boxShadowTertiary};
  `,
  statsRow: css`
    display: flex;
    align-items: center;
    gap: 24px;
    flex-wrap: wrap;
  `,
  statTile: css`
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 62px;
  `,
  statValue: css`
    font-size: 22px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  `,
  statLabel: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  groupHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 4px 8px 12px;
    margin: 18px 0 8px;
    border-left: 3px solid ${token.colorPrimary};
    background: ${token.colorFillQuaternary};
    border-radius: 0 ${token.borderRadius}px ${token.borderRadius}px 0;
    flex-wrap: wrap;
  `,
  card: css`
    display: flex;
    align-items: stretch;
    gap: 16px;
    padding: 12px 16px;
    margin-bottom: 10px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    transition: border-color 0.2s, box-shadow 0.2s;
    scroll-margin-top: ${LAYOUT_HEADER_OFFSET + 108}px;
    &:hover {
      border-color: ${token.colorPrimaryBorder};
    }
    ${responsive.laptop} {
      flex-wrap: wrap;
    }
  `,
  cardSkipped: css`
    background: ${token.colorFillQuaternary};
    border-style: dashed;
    align-items: center;
    padding: 10px 16px;
  `,
  cardSubmitted: css`
    background: ${token.colorSuccessBg};
    border-color: ${token.colorSuccessBorder};
  `,
  cardFlash: css`
    animation: ${flash} 1.4s ease-in-out 2;
    border-color: ${token.colorError};
  `,
  identity: css`
    flex: 0 0 168px;
    width: 168px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    min-width: 0;
  `,
  identityName: css`
    font-size: 15px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  identityMeta: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    font-variant-numeric: tabular-nums;
  `,
  familiarity: css`
    flex: 0 0 208px;
    width: 208px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    padding-right: 16px;
    border-right: 1px dashed ${token.colorSplit};
    ${responsive.laptop} {
      border-right: none;
    }
  `,
  famChips: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  `,
  chip: css`
    padding: 2px 10px;
    font-size: 13px;
    line-height: 20px;
    border-radius: 12px;
    border: 1px solid ${token.colorBorder};
    background: ${token.colorBgContainer};
    color: ${token.colorText};
    cursor: pointer;
    user-select: none;
    transition: all 0.15s;
    &:hover:not(:disabled) {
      border-color: ${token.colorPrimary};
      color: ${token.colorPrimary};
    }
    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  `,
  chipActive: css`
    border-color: ${token.colorPrimary};
    background: ${token.colorPrimary};
    color: #fff;
    &:hover:not(:disabled) {
      color: #fff;
    }
  `,
  chipUnknown: css`
    border-style: dashed;
    color: ${token.colorTextSecondary};
  `,
  chipUnknownActive: css`
    border-color: ${token.colorTextQuaternary};
    background: ${token.colorTextQuaternary};
    color: #fff;
  `,
  itemsArea: css`
    flex: 1;
    min-width: 0;
    position: relative;
  `,
  itemGrid: css`
    display: grid;
    gap: 10px;
  `,
  itemHead: css`
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: ${token.colorTextSecondary};
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  scoreRow: css`
    display: flex;
    gap: 4px;
  `,
  scoreButton: css`
    flex: 1;
    min-width: 0;
    height: 30px;
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    border-radius: ${token.borderRadius}px;
    border: 1px solid ${token.colorBorder};
    background: ${token.colorBgContainer};
    color: ${token.colorTextTertiary};
    cursor: pointer;
    transition: all 0.12s;
    &:hover:not(:disabled) {
      border-color: ${token.colorPrimary};
      color: ${token.colorPrimary};
    }
    &:disabled {
      cursor: not-allowed;
    }
  `,
  scoreButtonReadonly: css`
    cursor: default;
    &:hover {
      border-color: ${token.colorBorder};
    }
  `,
  commentZone: css`
    display: grid;
    gap: 10px;
    margin-top: 8px;
    min-height: 72px;
  `,
  commentHint: css`
    font-size: 12px;
    color: ${token.colorTextQuaternary};
    line-height: 1.5;
    padding-top: 6px;
  `,
  commentCounter: css`
    font-size: 11px;
    line-height: 16px;
    margin-top: 2px;
  `,
  gate: css`
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorBgContainer};
    color: ${token.colorTextQuaternary};
    font-size: 13px;
    z-index: 2;
  `,
  gateInner: css`
    opacity: 0.55;
    pointer-events: none;
    user-select: none;
  `,
  navCard: css`
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    padding: 10px 10px 4px;
  `,
  navGroupTitle: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    margin: 8px 0 4px;
  `,
  navItem: css`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    border-radius: ${token.borderRadius}px;
    font-size: 13px;
    cursor: pointer;
    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  navDot: css`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex: none;
  `,
  unfilledName: css`
    cursor: pointer;
    color: ${token.colorPrimary};
    &:hover {
      text-decoration: underline;
    }
  `,
}));
