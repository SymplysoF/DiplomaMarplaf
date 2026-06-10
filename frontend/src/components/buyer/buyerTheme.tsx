export const buyerTheme = {
  bg: '#f6f3ed',
  card: '#ffffff',
  border: '#ebe4d8',
  text: '#223127',
  muted: '#6f7a71',
  green: '#2f6b3a',
  greenDark: '#244f2b',
  greenSoft: '#dfeadf',
  purple: '#7a5af5',
  blue: '#4f7cff',
  orange: '#d97706',
  red: '#c2410c',
  badgeDark: '#49566a',
  shadow: '0 14px 35px rgba(34, 49, 39, 0.08)',
  shadowHover: '0 20px 45px rgba(34, 49, 39, 0.14)'
};

export const softChip = (bg: string, color: string) => ({
  background: bg,
  color,
  border: '1px solid transparent',
  padding: '0.48rem 0.78rem',
  borderRadius: 999,
  fontSize: '0.88rem',
  fontWeight: 600
});