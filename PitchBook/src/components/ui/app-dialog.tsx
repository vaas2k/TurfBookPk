import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

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

  useEffect(() => {
    listener = setRequest;
    return () => { listener = null; };
  }, []);

  const actions = request?.actions?.length ? request.actions : [{ text: 'OK' }];
  const dismiss = () => { if (!busy) setRequest(null); };
  const select = async (action: AppDialogAction) => {
    if (busy) return;
    setBusy(true);
    setRequest(null);
    try { await action.onPress?.(); } finally { setBusy(false); }
  };
  const destructive = actions.some((action) => action.style === 'destructive');

  return <Modal visible={Boolean(request)} transparent animationType="fade" onRequestClose={dismiss}>
    <View className="flex-1 items-center justify-center bg-black/45 px-6">
      <Pressable className="absolute inset-0" onPress={dismiss} accessibilityLabel="Close dialog" />
      <View accessibilityRole="alert" className="w-full max-w-md rounded-3xl bg-white p-6" style={{ elevation: 14 }}>
        <View className={`h-12 w-12 items-center justify-center rounded-full ${destructive ? 'bg-red-50' : 'bg-green-50'}`}>
          <Ionicons name={destructive ? 'warning-outline' : 'information-circle-outline'} size={27} color={destructive ? '#DC2626' : '#2E7D32'} />
        </View>
        <Text className="mt-4 text-xl font-bold text-[#1A1A2E]">{request?.title}</Text>
        {!!request?.message && <Text className="mt-2 text-[15px] leading-6 text-[#5F6368]">{request.message}</Text>}
        <View className="mt-6 gap-3">
          {actions.map((action) => {
            const isCancel = action.style === 'cancel';
            const isDestructive = action.style === 'destructive';
            return <Pressable key={action.text} accessibilityRole="button" accessibilityLabel={action.text} disabled={busy} onPress={() => select(action)} className={`min-h-[48px] items-center justify-center rounded-xl px-4 ${isCancel ? 'border border-[#E5E7EB] bg-white' : isDestructive ? 'bg-[#DC2626]' : 'bg-[#2E7D32]'} ${busy ? 'opacity-60' : 'active:opacity-80'}`}>
              <Text className={`font-bold ${isCancel ? 'text-[#374151]' : 'text-white'}`}>{busy ? 'Please wait…' : action.text}</Text>
            </Pressable>;
          })}
        </View>
      </View>
    </View>
  </Modal>;
}
