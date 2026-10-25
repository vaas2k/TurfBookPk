import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useAppearanceStore } from '@/store/appearanceStore';
import { playerThemes } from '@/theme/playerTheme';

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
  const appearance = useAppearanceStore((state) => state.appearance);
  const theme = playerThemes[appearance];
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const sheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['42%', '70%'], []);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    listener = setRequest;
    return () => { listener = null; };
  }, []);

  useEffect(() => {
    if (request) sheetRef.current?.present();
  }, [request]);

  const actions = request?.actions?.length ? request.actions : [{ text: 'OK' }];
  const select = async (action: AppDialogAction) => {
    if (busy) return;
    setBusy(true);
    sheetRef.current?.dismiss();
    try { await action.onPress?.(); } finally { setBusy(false); setRequest(null); }
  };
  const destructive = actions.some((action) => action.style === 'destructive');
  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.65} />
    ),
    [],
  );

  return <BottomSheetModal
    ref={sheetRef}
    index={0}
    snapPoints={snapPoints}
    enableDynamicSizing={false}
    enablePanDownToClose
    keyboardBehavior="interactive"
    keyboardBlurBehavior="restore"
    backdropComponent={renderBackdrop}
    onDismiss={() => { if (!busy) setRequest(null); }}
    backgroundStyle={{ backgroundColor: theme.surfaceRaised }}
    handleIndicatorStyle={{ backgroundColor: theme.muted, width: 48 }}
    topInset={insets.top}
  >
    <BottomSheetView accessibilityRole="alert" className="flex-1 border-t px-6" style={{ paddingBottom: Math.max(insets.bottom, 16), borderTopColor: theme.border }}>
        <View className="mt-6 h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: destructive ? (appearance === 'dark' ? '#3A211E' : '#FCE9E7') : theme.businessSurface }}>
          <Ionicons name={destructive ? 'warning-outline' : 'information-circle-outline'} size={27} color={destructive ? '#FF5A55' : '#3DB54A'} />
        </View>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: theme.text }} className="mt-4 text-xl">{request?.title}</Text>
        {!!request?.message && <Text style={{ color: theme.subtle }} className="mt-2 text-[15px] leading-6">{request.message}</Text>}
        <View className="mt-6 gap-3">
          {actions.map((action) => {
            const isCancel = action.style === 'cancel';
            const isDestructive = action.style === 'destructive';
            return <Pressable key={action.text} accessibilityRole="button" accessibilityLabel={action.text} disabled={busy} onPress={() => select(action)} className={`min-h-[52px] items-center justify-center rounded-full px-4 ${isCancel ? 'border border-[#3A4034] bg-[#1A1E17]' : isDestructive ? 'bg-[#F24848]' : 'bg-[#3DB54A]'} ${busy ? 'opacity-60' : 'active:opacity-80'}`} style={isCancel ? { backgroundColor: theme.surface, borderColor: theme.border } : isDestructive ? undefined : { backgroundColor: theme.green }}>
              <Text className={`font-bold ${isCancel ? 'text-[#374151]' : 'text-white'}`}>{busy ? 'Please wait…' : action.text}</Text>
            </Pressable>;
          })}
        </View>
    </BottomSheetView>
  </BottomSheetModal>;
}
