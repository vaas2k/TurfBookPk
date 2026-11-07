import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = { label: string; value: string; onChange: (value: string) => void; minimum?: string; maximum?: string; dark?: boolean };
const display = (value: string) => { const hour = Number(value.slice(0, 2)); return `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:${value.slice(3, 5)} ${hour >= 12 ? 'PM' : 'AM'}`; };

const timeDate = (value: string) => {
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  return new Date(2000, 0, 1, hour, minute, 0, 0);
};
const apiTime = (value: Date) => `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;

export function TimePicker({ label, value, onChange, minimum = '00:00', maximum = '23:59', dark = false }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => timeDate(value));
  const minimumDate = useMemo(() => timeDate(minimum), [minimum]);
  const maximumDate = useMemo(() => timeDate(maximum), [maximum]);
  useEffect(() => { if (!open) setDraft(timeDate(value)); }, [open, value]);
  const show = () => { setDraft(timeDate(value)); setOpen(true); };
  const selectAndroid = (event: DateTimePickerEvent, selected?: Date) => {
    setOpen(false);
    if (event.type === 'set' && selected) onChange(apiTime(selected));
  };
  return <View>
    <Text className={`${dark ? 'text-[#D9DBD5]' : 'text-[#1A1A2E]'} font-medium mb-1`}>{label}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label}, ${display(value)}. Open time picker`} onPress={show} className={`${dark ? 'bg-[#252A22] border-[#30372B]' : 'bg-white border-[#E5E5E5]'} min-h-[54px] border rounded-xl px-4 py-3 flex-row items-center justify-between`}>
      <Text className={`${dark ? 'text-[#F5F5F0]' : 'text-[#1A1A2E]'} text-base font-semibold`}>{display(value)}</Text>
      <Ionicons name="time-outline" size={21} color="#57CC63" />
    </TouchableOpacity>
    {Platform.OS === 'android' && open && <DateTimePicker value={draft} mode="time" display="clock" is24Hour={false} minimumDate={minimumDate} maximumDate={maximumDate} onChange={selectAndroid} />}
    {Platform.OS === 'ios' && <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View className="flex-1 bg-black/60 justify-end">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close time picker" activeOpacity={1} className="flex-1" onPress={() => setOpen(false)} />
        <View className={`${dark ? 'bg-[#10120F] border-[#30372B]' : 'bg-white border-[#E5E5E5]'} border rounded-t-3xl px-5 pt-4 pb-7`}>
          <View className="flex-row items-center justify-between">
            <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(false)} className="min-h-[44px] justify-center pr-4"><Text className={dark ? 'text-[#B4B9B0] font-semibold' : 'text-[#60645D] font-semibold'}>Cancel</Text></TouchableOpacity>
            <Text className={`${dark ? 'text-[#F5F5F0]' : 'text-[#1A1A2E]'} text-lg font-bold`}>{label}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => { onChange(apiTime(draft)); setOpen(false); }} className="min-h-[44px] justify-center pl-4"><Text className="text-[#57CC63] font-bold">Done</Text></TouchableOpacity>
          </View>
          <DateTimePicker value={draft} mode="time" display="spinner" is24Hour={false} locale="en_US" minuteInterval={1} minimumDate={minimumDate} maximumDate={maximumDate} themeVariant={dark ? 'dark' : 'light'} textColor={dark ? '#F5F5F0' : '#1A1A2E'} onChange={(_, selected) => selected && setDraft(selected)} style={{ height: 190 }} />
        </View>
      </View>
    </Modal>}
  </View>;
}
