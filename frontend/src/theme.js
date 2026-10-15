import { createTheme, responsiveFontSizes } from '@mui/material/styles';

// Keep in sync with the CSS variables in index.css, which plain .css files use
export const colors = {
  bg: '#0F1623',
  surface: '#172131',
  surfaceRaised: '#1E2A3D',
  rowAlt: '#1B2639',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#E6EDF6',
  textMuted: '#8B9AB0',
  primary: '#5EE6A0',
  gold: '#F5C451',
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: colors.bg, paper: colors.surface },
    primary: { main: colors.primary },
    secondary: { main: colors.gold },
    divider: colors.border,
    text: { primary: colors.text, secondary: colors.textMuted },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    overline: { letterSpacing: '0.12em', fontWeight: 600, lineHeight: 1.6 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontFeatureSettings: '"cv11", "ss01"' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: colors.border },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(15, 22, 35, 0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${colors.border}`,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: colors.border, fontVariantNumeric: 'tabular-nums' },
        head: { textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' },
      },
    },
    MuiFormControl: {
      defaultProps: { size: 'small' },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: colors.surface,
          borderTop: `1px solid ${colors.border}`,
          // Clear the iOS home indicator
          height: 'calc(56px + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          color: colors.textMuted,
          '&.Mui-selected': { color: colors.primary },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { fontSize: 13 } },
    },
  },
});

export default responsiveFontSizes(theme);
