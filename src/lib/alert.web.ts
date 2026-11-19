/** react-native-web's Alert is a no-op, so implement the same API with a modal (rendered by <AlertHost/>). */
export interface AlertButton { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }
export interface AlertState { title: string; message?: string; buttons: AlertButton[] }
let listener: ((a: AlertState | null) => void) | null = null;
export const setAlertListener = (l: typeof listener) => { listener = l; };
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    const b = buttons?.length ? buttons : [{ text: 'OK' }];
    if (listener) listener({ title, message, buttons: b });
    else if (typeof window !== 'undefined') window.alert([title, message].filter(Boolean).join('\n\n'));
  },
};
