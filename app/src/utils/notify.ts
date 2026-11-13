/**
 * A simple message pop-up that works everywhere.
 * React Native's Alert does nothing in a web browser, so on the web we use the browser's own alert.
 */
import { Alert, Platform } from 'react-native';

export function notify(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}
