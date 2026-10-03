import { ActivityIndicator, Image, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { uploadPrivateDocument } from '@/lib/api/media';
import { getVendorProfile, getVendorVerification, saveVendorVerificationStep, submitVendorVerification } from '@/lib/api/vendors';

export type VendorBaseData = { business_name: string; business_phone: string; business_city: string; business_description: string; agreeToTerms: boolean };
type LocalDocument = { uri: string; mimeType?: string | null; fileSize?: number | null; fileName?: string | null } | null;
type Step = 1 | 2 | 3 | 4 | 5 | 6;
type RequestedArea = 'identity' | 'business' | 'payout' | null;

function nextStep(verification: Awaited<ReturnType<typeof getVendorVerification>>, hasProfile: boolean): Step {
  if (!verification) return hasProfile ? 2 : 1;
  if (verification.identity_status === 'changes_requested' || !verification.cnic_last_four) return 2;
  if (verification.business_status === 'changes_requested' || !verification.business_type) return 3;
  if (verification.payout_status === 'changes_requested' || !verification.payout_bank_name) return 4;
  if (verification.status === 'under_review' || verification.status === 'approved') return 6;
  return 5;
}

function errorMessage(error: unknown, fallback: string): string {
  return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : fallback;
}

export default function VendorVerificationFlow({ visible, onClose, onCreateVendor }: { visible: boolean; onClose: () => void; onCreateVendor: (data: VendorBaseData) => Promise<void> }) {
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [base, setBase] = useState<VendorBaseData>({ business_name: '', business_phone: '', business_city: '', business_description: '', agreeToTerms: false });
  const [cnic, setCnic] = useState(''); const [front, setFront] = useState<LocalDocument>(null); const [back, setBack] = useState<LocalDocument>(null);
  const [businessType, setBusinessType] = useState('sole_proprietor'); const [businessNumber, setBusinessNumber] = useState(''); const [relationship, setRelationship] = useState('owner_director'); const [businessDocument, setBusinessDocument] = useState<LocalDocument>(null); const [authorizationLetter, setAuthorizationLetter] = useState<LocalDocument>(null);
  const [bank, setBank] = useState(''); const [accountTitle, setAccountTitle] = useState(''); const [accountNumber, setAccountNumber] = useState('');
  const [requestedArea, setRequestedArea] = useState<RequestedArea>(null);

  useEffect(() => {
    if (!visible) return;
    let mounted = true; setError('');
    void Promise.all([getVendorProfile(), getVendorVerification()]).then(([profile, verification]) => {
      if (!mounted) return;
      if (profile) setBase({ business_name: profile.business_name, business_phone: profile.business_phone, business_city: profile.business_city, business_description: profile.business_description || '', agreeToTerms: true });
      if (verification) { setBusinessType(verification.business_type || 'sole_proprietor'); setRelationship(verification.registrant_relationship || 'owner_director'); setBank(verification.payout_bank_name || ''); setAccountTitle(verification.payout_account_title || ''); const changed = verification.identity_status === 'changes_requested' ? 'identity' : verification.business_status === 'changes_requested' ? 'business' : verification.payout_status === 'changes_requested' ? 'payout' : null; setRequestedArea(changed); if (changed) { const reason = changed === 'identity' ? verification.identity_reason : changed === 'business' ? verification.business_reason : verification.payout_reason; setError(`Changes requested: ${reason || 'Please review and update this section.'}`); } }
      setStep(nextStep(verification, Boolean(profile)));
    }).catch(() => { if (mounted) setStep(1); });
    return () => { mounted = false; };
  }, [visible]);

  async function chooseDocument(setter: (file: LocalDocument) => void) {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], copyToCacheDirectory: true });
    if (result.canceled) return;
    const file = result.assets[0];
    setter({ uri: file.uri, mimeType: file.mimeType || (file.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'), fileSize: file.size, fileName: file.name });
  }

  async function saveAndContinue() {
    setBusy(true); setError('');
    try {
      if (step === 1) {
        if (!base.business_name.trim() || !base.business_phone.trim() || !base.business_city.trim() || !base.agreeToTerms) throw new Error('Complete your business details and accept the confirmation.');
        await onCreateVendor(base);
      } else if (step === 2) {
        if (!front || !back || cnic.replace(/\D/g, '').length !== 13) throw new Error('Enter your 13-digit CNIC and upload both sides.');
        const [frontUpload, backUpload] = await Promise.all([uploadPrivateDocument(front, 'vendor_identity_document'), uploadPrivateDocument(back, 'vendor_identity_document')]);
        await saveVendorVerificationStep('identity', { cnic_number: cnic, documents: [{ type: 'cnic_front', storage_key: frontUpload.key, content_type: frontUpload.content_type, original_filename: frontUpload.original_filename }, { type: 'cnic_back', storage_key: backUpload.key, content_type: backUpload.content_type, original_filename: backUpload.original_filename }] });
      } else if (step === 3) {
        if (!businessNumber.trim() || !businessDocument || (relationship === 'authorized_representative' && !authorizationLetter)) throw new Error('Add the business number and all required proof documents.');
        const proof = await uploadPrivateDocument(businessDocument, 'vendor_business_document');
        const documents: Record<string, string | null>[] = [{ type: 'business_registration', storage_key: proof.key, content_type: proof.content_type, original_filename: proof.original_filename }];
        if (authorizationLetter) { const letter = await uploadPrivateDocument(authorizationLetter, 'vendor_authorization_document'); documents.push({ type: 'authorization_letter', storage_key: letter.key, content_type: letter.content_type, original_filename: letter.original_filename }); }
        await saveVendorVerificationStep('business', { business_type: businessType, business_number: businessNumber, registrant_relationship: relationship, documents });
      } else if (step === 4) {
        if (!bank.trim() || !accountTitle.trim() || !accountNumber.trim()) throw new Error('Complete your payout account details.');
        await saveVendorVerificationStep('payout', { bank_name: bank, account_title: accountTitle, account_number: accountNumber });
      } else if (step === 5) {
        await submitVendorVerification(); setStep(6); return;
      }
      if ((step === 2 && requestedArea === 'identity') || (step === 3 && requestedArea === 'business') || (step === 4 && requestedArea === 'payout')) { setRequestedArea(null); setStep(5); return; }
      setStep((current) => (current + 1) as Step);
    } catch (caught) { setError(errorMessage(caught, step === 5 ? 'Unable to submit verification. Please try again.' : 'Unable to save this step.')); } finally { setBusy(false); }
  }

  const documentButton = (label: string, value: LocalDocument, setter: (file: LocalDocument) => void) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={() => void chooseDocument(setter)} className="border border-dashed border-[#4D754D] bg-[#192219] rounded-xl p-3 mb-3 flex-row items-center"><Ionicons name={value ? 'checkmark-circle' : 'document-attach-outline'} size={22} color="#59C462" /><Text className="text-[#E5E7E1] ml-3 flex-1">{value ? `${label} selected` : `${label} (image or PDF)`}</Text>{value?.mimeType !== 'application/pdf' ? <Image source={{ uri: value?.uri }} className="h-9 w-9 rounded" /> : null}</TouchableOpacity>;
  const previous = () => { setError(''); if (step > 1 && step < 6) setStep((current) => (current - 1) as Step); };

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-[#10120F]"><View className="px-5 py-3 flex-row items-center border-b border-[#30372B]"><TouchableOpacity accessibilityRole="button" accessibilityLabel={step > 1 && step < 6 ? 'Previous verification step' : 'Close vendor verification'} disabled={busy} onPress={step > 1 && step < 6 ? previous : onClose} className="h-11 w-11 items-center justify-center"><Ionicons name={step > 1 && step < 6 ? 'arrow-back' : 'close'} size={24} color="#E5E7E1" /></TouchableOpacity><View className="flex-1 ml-2"><Text numberOfLines={1} className="text-[#F5F5F0] text-[20px] font-bold">Vendor verification</Text><Text className="text-[#9BA097] text-xs mt-0.5">{step === 6 ? 'Verification status' : `Step ${step} of 5`}</Text></View></View><View className="px-5 pt-4 flex-row gap-1">{[1, 2, 3, 4, 5].map((value) => <View key={value} className={`h-1.5 flex-1 rounded ${step >= value ? 'bg-[#42B84F]' : 'bg-[#30372B]'}`} />)}</View><ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{step === 1 && <><Title title="Business profile" note="Your phone is already verified with OTP. Add the public details players will see." /><Field label="Business name" value={base.business_name} onChangeText={(value) => setBase({ ...base, business_name: value })} /><Field label="Business phone" value={base.business_phone} keyboardType="phone-pad" onChangeText={(value) => setBase({ ...base, business_phone: value })} /><Field label="City" value={base.business_city} onChangeText={(value) => setBase({ ...base, business_city: value })} /><Field label="Description (optional)" value={base.business_description} onChangeText={(value) => setBase({ ...base, business_description: value })} /><TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: base.agreeToTerms }} onPress={() => setBase({ ...base, agreeToTerms: !base.agreeToTerms })} className="flex-row items-center mt-2"><Ionicons name={base.agreeToTerms ? 'checkbox' : 'square-outline'} size={22} color="#59C462" /><Text className="text-[#C9CEC4] text-xs ml-2 flex-1">I confirm this information is accurate and agree to verification.</Text></TouchableOpacity></>}{step === 2 && <><Title title="Identity verification" note="Your CNIC is fingerprinted securely. Documents remain private." /><Field label="CNIC number" value={cnic} keyboardType="number-pad" onChangeText={setCnic} /><View className="mt-3">{documentButton('Upload CNIC front', front, setFront)}{documentButton('Upload CNIC back', back, setBack)}</View></>}{step === 3 && <><Title title="Business verification" note="Upload one business proof. An authorization letter is needed only when registering for another owner." /><Choice label="Business type" value={businessType} values={[['sole_proprietor', 'Sole proprietor'], ['partnership', 'Partnership'], ['private_limited', 'Private limited'], ['other', 'Other']]} onChange={setBusinessType} /><Field label="NTN / registration number" value={businessNumber} onChangeText={setBusinessNumber} /><Choice label="You are" value={relationship} values={[['owner_director', 'Owner / director'], ['authorized_representative', 'Authorized representative']]} onChange={setRelationship} />{documentButton('Upload business registration proof', businessDocument, setBusinessDocument)}{relationship === 'authorized_representative' ? documentButton('Upload authorization letter', authorizationLetter, setAuthorizationLetter) : null}</>}{step === 4 && <><Title title="Payout details" note="Your account number is encrypted and used only after payout activation." /><Field label="Bank name" value={bank} onChangeText={setBank} /><Field label="Account title" value={accountTitle} onChangeText={setAccountTitle} /><Field label="Pakistan IBAN or account number" value={accountNumber} autoCapitalize="characters" onChangeText={setAccountNumber} /></>}{step === 5 && <><Title title="Ready to submit" note="Review the information using Back if needed. Submit sends your application to the admin team." /><Text className="text-[#C9CEC4] leading-5">Your identity, business, and payout information is saved privately. You cannot add grounds until approval.</Text></>}{step === 6 && <View className="items-center py-10"><Ionicons name="time-outline" size={62} color="#59C462" /><Text className="text-[#F5F5F0] text-xl font-bold mt-4">Submitted for review</Text><Text className="text-[#A5AAA1] text-center mt-2">We will notify you if changes are needed.</Text></View>}{error ? <Text className="text-[#FF8A8A] mt-4 leading-5">{error}</Text> : null}{step < 6 ? <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void saveAndContinue()} className="bg-[#42B84F] rounded-xl min-h-[52px] mt-7 items-center justify-center">{busy ? <ActivityIndicator color="#102110" /> : <Text className="text-[#102110] font-bold">{step === 5 ? 'Submit for review' : 'Save and continue'}</Text>}</TouchableOpacity> : <TouchableOpacity accessibilityRole="button" onPress={onClose} className="bg-[#42B84F] rounded-xl min-h-[52px] mt-7 items-center justify-center"><Text className="text-[#102110] font-bold">Done</Text></TouchableOpacity>}</ScrollView></SafeAreaView></Modal>;
}

function Title({ title, note }: { title: string; note: string }) { return <View className="mb-5"><Text className="text-[#F5F5F0] text-xl font-bold">{title}</Text><Text className="text-[#A5AAA1] text-sm mt-1 leading-5">{note}</Text></View>; }
function Field(props: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: 'default' | 'phone-pad' | 'number-pad'; autoCapitalize?: 'none' | 'characters' }) { return <View className="mb-4"><Text className="text-[#D9DBD5] mb-1.5">{props.label}</Text><TextInput accessibilityLabel={props.label} className="bg-[#1B1F19] border border-[#30372B] rounded-xl px-4 py-3 text-[#F5F5F0]" placeholderTextColor="#777D74" keyboardType={props.keyboardType} autoCapitalize={props.autoCapitalize} value={props.value} onChangeText={props.onChangeText} /></View>; }
function Choice({ label, value, values, onChange }: { label: string; value: string; values: string[][]; onChange: (value: string) => void }) { return <View className="mb-4"><Text className="text-[#D9DBD5] mb-2">{label}</Text>{values.map(([id, title]) => <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: value === id }} key={id} onPress={() => onChange(id)} className="flex-row items-center py-2"><Ionicons name={value === id ? 'radio-button-on' : 'radio-button-off'} size={20} color="#59C462" /><Text className="text-[#E5E7E1] ml-2">{title}</Text></TouchableOpacity>)}</View>; }
