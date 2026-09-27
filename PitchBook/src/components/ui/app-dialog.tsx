import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type AppDialogAction = {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: 'cancel' | 'default' | 'destructive';
};

type DialogRequest = { title: string; message?: string; actions?: AppDialogAction[] };
type DialogListener = (request: DialogRequest) => void;
let listener: DialogListener | null = null;

/** Imperative dialog service for screens that previously used React Native Alert. */
export const appDialog = {
  alert(title: string, message?: string, actions?: AppDialogAction[]) {
    listener?.({ title, message, actions });
  },
};

export function AppDialogHost() {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const sheetTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    listener = setRequest;
    return () => { listener = null; };
  }, []);

  const actions = request?.actions?.length ? request.actions : [{ text: 'OK' }];
  const dismiss = () => { if (!busy) { sheetTranslateY.setValue(0); setRequest(null); } };
  const select = async (action: AppDialogAction) => {
    if (busy) return;
    setBusy(true);
    setRequest(null);
    try { await action.onPress?.(); } finally { setBusy(false); }
  };
  const destructive = actions.some((action) => action.style === 'destructive');
  const sheetPan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onMoveShouldSetPanResponderCapture: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, gesture) => sheetTranslateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 110 || gesture.vy > 1.25) dismiss();
      else Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true }).start();
    },
  });

  return <Modal visible={Boolean(request)} transparent animationType="slide" onRequestClose={dismiss}>
    <View className="flex-1 justify-end bg-black/65">
      <Pressable className="absolute inset-0" onPress={dismiss} accessibilityLabel="Close dialog" />
      <Animated.View {...sheetPan.panHandlers} style={{ transform: [{ translateY: sheetTranslateY }] }}>
      <SafeAreaView edges={['bottom']} accessibilityRole="alert" className="w-full rounded-t-[32px] border-t border-[#30372B] bg-[#1A1E17] px-6 pt-3" style={{ elevation: 14 }}>
        <View className="h-8 items-center justify-center -mt-3"><View className="h-1.5 w-12 rounded-full bg-[#6B7167]" /></View>
        <View className={`mt-6 h-12 w-12 items-center justify-center rounded-full ${destructive ? 'bg-[#3A211E]' : 'bg-[#19331D]'}`}>
          <Ionicons name={destructive ? 'warning-outline' : 'information-circle-outline'} size={27} color={destructive ? '#FF5A55' : '#3DB54A'} />
        </View>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="mt-4 text-xl text-[#F8F7F0]">{request?.title}</Text>
        {!!request?.message && <Text className="mt-2 text-[15px] leading-6 text-[#BFC1B9]">{request.message}</Text>}
        <View className="mt-6 gap-3">
          {actions.map((action) => {
            const isCancel = action.style === 'cancel';
            const isDestructive = action.style === 'destructive';
            return <Pressable key={action.text} accessibilityRole="button" accessibilityLabel={action.text} disabled={busy} onPress={() => select(action)} className={`min-h-[52px] items-center justify-center rounded-full px-4 ${isCancel ? 'border border-[#3A4034] bg-[#1A1E17]' : isDestructive ? 'bg-[#F24848]' : 'bg-[#3DB54A]'} ${busy ? 'opacity-60' : 'active:opacity-80'}`}>
              <Text className={`font-bold ${isCancel ? 'text-[#374151]' : 'text-white'}`}>{busy ? 'Please wait…' : action.text}</Text>
            </Pressable>;
          })}
        </View>
      </SafeAreaView>
      </Animated.View>
    </View>
  </Modal>;
}
