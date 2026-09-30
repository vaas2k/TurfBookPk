import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

type IconButtonProps = {
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  disabled?: boolean;
};

/** A consistent, screen-reader labelled 44px icon target for pushed screens. */
export function IconButton({ accessibilityLabel, icon, color, onPress, disabled = false }: IconButtonProps) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} className={`h-11 w-11 items-center justify-center rounded-xl ${disabled ? 'opacity-50' : 'active:opacity-70'}`}><Ionicons name={icon} size={23} color={color} /></TouchableOpacity>;
}
