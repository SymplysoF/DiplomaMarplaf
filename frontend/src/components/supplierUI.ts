import React from 'react';

export const ui = {
  navbarBg: 'rgba(255,255,255,0.88)',
  border: '#e7e2d8',
  text: '#243126',
  muted: '#6d786f',

  green: '#2f6b3a',
  greenDark: '#234f2b',
  greenSoft: '#dceadf',

  purple: '#6c56d9',
  purpleSoft: '#f1ecff',

  gold: '#9a6b00',
  goldSoft: '#fbf1d9',

  blueGray: '#44546a',
  blueGraySoft: '#eef2f7',

  red: '#c2410c',
  redSoft: '#fde7df',

  shadow: '0 18px 42px rgba(34,49,39,0.14), 0 4px 14px rgba(34,49,39,0.08)',
shadowSoft: '0 12px 28px rgba(34,49,39,0.10), 0 2px 8px rgba(34,49,39,0.05)'
};

export const chip = (bg: string, color: string): React.CSSProperties => ({
  background: bg,
  color,
  borderRadius: 999,
  padding: '0.56rem 0.9rem',
  fontSize: '0.84rem',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: `1px solid ${ui.border}`,
  lineHeight: 1
});

export const btnMain = (): React.CSSProperties => ({
  background: ui.green,
  color: '#fff',
  border: `1px solid ${ui.green}`,
  borderRadius: 12,
  fontWeight: 600,
  boxShadow: '0 8px 18px rgba(47,107,58,0.16)'
});

export const btnSoft = (): React.CSSProperties => ({
  background: ui.greenSoft,
  color: ui.greenDark,
  border: `1px solid ${ui.border}`,
  borderRadius: 12,
  fontWeight: 600
});

export const btnDangerSoft = (): React.CSSProperties => ({
  background: '#fff',
  color: ui.red,
  border: `1px solid ${ui.red}`,
  borderRadius: 12,
  fontWeight: 600
});

export const glassCard = (): React.CSSProperties => ({
  background: 'rgba(255,255,255,0.75)',
  border: `1px solid ${ui.border}`,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: ui.shadowSoft,
  borderRadius: 24
});