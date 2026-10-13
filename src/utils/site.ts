import * as WebBrowser from 'expo-web-browser';

// The GitHub Pages site built from docs/
export const SITE_URL = 'https://aviel3006.github.io/GoalGuess';

export const openTerms = () => WebBrowser.openBrowserAsync(`${SITE_URL}/terms.html`);
export const openPrivacyPolicy = () => WebBrowser.openBrowserAsync(`${SITE_URL}/privacy.html`);
