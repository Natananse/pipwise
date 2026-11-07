import { useEffect, useState } from 'react';
import { Keyboard, Platform, useWindowDimensions } from 'react-native';
import { tradingLandscape } from './tradingLayout';

export function useTradingWindow() {
  const window = useWindowDimensions();
  const [keyboardVisible, setKeyboardVisible] = useState(() => Platform.OS !== 'web' && Keyboard.isVisible());
  const [inputFocused, setInputFocused] = useState(false);
  const [fullWindow, setFullWindow] = useState({ width: window.width, height: window.height });
  const editing = keyboardVisible || inputFocused;
  const landscape = tradingLandscape(window.width, window.height, editing, fullWindow);
  if (!editing && (fullWindow.width !== window.width || fullWindow.height !== window.height)) {
    setFullWindow({ width: window.width, height: window.height });
  }
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => { setKeyboardVisible(false); setInputFocused(false); });
    return () => { show.remove(); hide.remove(); };
  }, []);
  return { ...window, landscape, keyboardVisible, onInputFocus: () => setInputFocused(true), onInputBlur: () => setInputFocused(false) };
}
