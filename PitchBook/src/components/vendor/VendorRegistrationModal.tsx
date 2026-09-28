import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";

export interface VendorFormData {
  business_name: string;
  business_phone: string;
  business_city: string;
  business_description: string;
  agreeToTerms: boolean;
}

interface VendorRegistrationModalProps {
  visible: boolean;
  onClose: () => void;
  onRegister: (data: VendorFormData) => Promise<void>;
  isLoading: boolean;
}

export default function VendorRegistrationModal({
  visible,
  onClose,
  onRegister,
  isLoading,
}: VendorRegistrationModalProps) {
  const [formData, setFormData] = useState<VendorFormData>({
    business_name: "",
    business_phone: "",
    business_city: "",
    business_description: "",
    agreeToTerms: false,
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [step, setStep] = useState<1 | 2>(1);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.business_name.trim()) {
      newErrors.business_name = "Business name is required";
    }
    if (!formData.business_phone.trim()) {
      newErrors.business_phone = "Business phone is required";
    } else if (formData.business_phone.replace(/\s/g, "").length < 10) {
      newErrors.business_phone = "Please enter a valid phone number";
    }
    if (!formData.business_city.trim()) {
      newErrors.business_city = "City is required";
    }
    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = "Please agree to the terms";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onRegister(formData);
    }
  };

  const continueToConfirmation = () => {
    const nextErrors: { [key: string]: string } = {};
    if (!formData.business_name.trim())
      nextErrors.business_name = "Business name is required";
    if (
      !formData.business_phone.trim() ||
      formData.business_phone.replace(/\s/g, "").length < 10
    )
      nextErrors.business_phone = "Enter a valid business phone number";
    if (!formData.business_city.trim())
      nextErrors.business_city = "City is required";
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) setStep(2);
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        business_name: "",
        business_phone: "",
        business_city: "",
        business_description: "",
        agreeToTerms: false,
      });
      setErrors({});
      setStep(1);
      onClose();
    }
  };

  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7)
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    if (cleaned.length <= 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7, 10)}`;
    }
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7, 10)}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <View className="flex-1 bg-black/50">
        <KeyboardAvoidingView
          className="flex-1 bg-[#10120F]"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Header */}
          <View className="pt-12 pb-4 px-6 flex-row items-center justify-between border-b border-[#30372B] bg-[#10120F]">
            <View>
              <Text
                style={{
                  fontFamily: "BigShouldersDisplay_800ExtraBold",
                  fontSize: 26,
                }}
                className="text-[#F5F5F0]"
              >
                BECOME A VENDOR
              </Text>
              <Text className="text-[#92978F] text-xs mt-0.5">
                Step {step} of 2
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close vendor registration"
              className="h-11 w-11 rounded-xl bg-[#1B1F19] border border-[#30372B] items-center justify-center"
              onPress={handleClose}
              disabled={isLoading}
            >
              <Ionicons name="close" size={24} color="#D9DBD5" />
            </TouchableOpacity>
          </View>

          <ScrollView
            className="flex-1 px-6 pt-4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <View className="flex-row mb-5">
              <View className="h-1.5 flex-1 rounded-full mr-2 bg-[#3EAF4C]" />
              <View className={`h-1.5 flex-1 rounded-full ${step === 2 ? "bg-[#42B84F]" : "bg-[#30372B]"}`} />
            </View>
            <View className="bg-[#1B251B] border border-[#315536] rounded-2xl p-4 mb-6 flex-row">
              <View className="h-11 w-11 rounded-xl bg-[#42B84F] items-center justify-center">
                <Ionicons
                  name={
                    step === 1
                      ? "storefront-outline"
                      : "shield-checkmark-outline"
                  }
                  size={23}
                  color="#102110"
                />
              </View>
              <View className="flex-1 ml-3">
                <Text
                  style={{ fontFamily: "SpaceGrotesk_700Bold" }}
                  className="text-[#F5F5F0] text-base"
                >
                  {step === 1
                    ? "Your business details"
                    : "Confirm and get started"}
                </Text>
                <Text className="text-[#A8C9AC] text-xs mt-1">
                  {step === 1
                    ? "Use the name and number your players know."
                    : "After this, we will help you add your first ground."}
                </Text>
              </View>
            </View>

            {step === 1 && (
              <>
                {/* Business Name */}
                <View className="mb-4">
                  <Text className="text-[#D9DBD5] font-medium mb-1.5">
                    Business Name <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    className={`bg-[#1B1F19] rounded-xl px-4 py-3.5 text-[#F5F5F0] text-base border ${
                      errors.business_name
                        ? "border-red-500"
                        : "border-[#30372B]"
                    }`}
                    placeholder="Enter your business name"
                    placeholderTextColor="#777D74"
                    value={formData.business_name}
                    onChangeText={(text) => {
                      setFormData({ ...formData, business_name: text });
                      if (errors.business_name) {
                        setErrors({ ...errors, business_name: "" });
                      }
                    }}
                    editable={!isLoading}
                  />
                  {errors.business_name && (
                    <Text className="text-red-500 text-xs mt-1">
                      {errors.business_name}
                    </Text>
                  )}
                </View>

                {/* Business Phone */}
                <View className="mb-4">
                  <Text className="text-[#D9DBD5] font-medium mb-1.5">
                    Business Phone <Text className="text-red-500">*</Text>
                  </Text>
                  <View
                    className={`flex-row items-center bg-[#1B1F19] rounded-xl px-4 border ${
                      errors.business_phone
                        ? "border-red-500"
                        : "border-[#30372B]"
                    }`}
                  >
                    <Text className="text-[#F5F5F0] font-medium py-3.5">
                      +92
                    </Text>
                    <View className="w-px h-6 bg-[#30372B] mx-3" />
                    <TextInput
                      className="flex-1 py-3.5 text-[#F5F5F0] text-base"
                      placeholder="331 5139044"
                      placeholderTextColor="#777D74"
                      value={formData.business_phone}
                      onChangeText={(text) => {
                        const formatted = formatPhoneNumber(text);
                        setFormData({ ...formData, business_phone: formatted });
                        if (errors.business_phone) {
                          setErrors({ ...errors, business_phone: "" });
                        }
                      }}
                      keyboardType="phone-pad"
                      maxLength={13}
                      editable={!isLoading}
                    />
                  </View>
                  {errors.business_phone && (
                    <Text className="text-red-500 text-xs mt-1">
                      {errors.business_phone}
                    </Text>
                  )}
                </View>

                {/* City */}
                <View className="mb-4">
                  <Text className="text-[#D9DBD5] font-medium mb-1.5">
                    City <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    className={`bg-[#1B1F19] rounded-xl px-4 py-3.5 text-[#F5F5F0] text-base border ${
                      errors.business_city
                        ? "border-red-500"
                        : "border-[#30372B]"
                    }`}
                    placeholder="Enter your city"
                    placeholderTextColor="#777D74"
                    value={formData.business_city}
                    onChangeText={(text) => {
                      setFormData({ ...formData, business_city: text });
                      if (errors.business_city) {
                        setErrors({ ...errors, business_city: "" });
                      }
                    }}
                    editable={!isLoading}
                  />
                  {errors.business_city && (
                    <Text className="text-red-500 text-xs mt-1">
                      {errors.business_city}
                    </Text>
                  )}
                </View>
              </>
            )}
            {step === 2 && (
              <>
                {/* Description */}
                <View className="mb-4">
                  <Text className="text-[#D9DBD5] font-medium mb-1.5">
                    Business Description (Optional)
                  </Text>
                  <TextInput
                    className="bg-[#1B1F19] rounded-xl px-4 py-3.5 text-[#F5F5F0] text-base border border-[#30372B]"
                    placeholder="Tell us about your business..."
                    placeholderTextColor="#777D74"
                    value={formData.business_description}
                    onChangeText={(text) =>
                      setFormData({ ...formData, business_description: text })
                    }
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    editable={!isLoading}
                  />
                </View>

                {/* Terms */}
                <View className="flex-row items-start mb-6">
                  <TouchableOpacity
                    className={`w-5 h-5 rounded border ${
                      formData.agreeToTerms
                        ? "bg-[#42B84F] border-[#42B84F]"
                        : "border-[#697064]"
                    } items-center justify-center mr-3 mt-0.5`}
                    onPress={() => {
                      setFormData({
                        ...formData,
                        agreeToTerms: !formData.agreeToTerms,
                      });
                      if (errors.agreeToTerms) {
                        setErrors({ ...errors, agreeToTerms: "" });
                      }
                    }}
                    disabled={isLoading}
                  >
                    {formData.agreeToTerms && (
                      <Ionicons name="checkmark" size={14} color="#102110" />
                    )}
                  </TouchableOpacity>
                  <Text className="text-[#B8BBB5] text-sm flex-1">
                    I agree to the{" "}
                    <Text className="text-[#57CC63]">Terms of Service</Text> and{" "}
                    <Text className="text-[#57CC63]">Privacy Policy</Text>
                  </Text>
                </View>
                {errors.agreeToTerms && (
                  <Text className="text-red-500 text-xs -mt-4 mb-4">
                    {errors.agreeToTerms}
                  </Text>
                )}
              </>
            )}

            {/* Register Button */}
            <TouchableOpacity
              className={`py-4 rounded-2xl mb-6 flex-row items-center justify-center ${
                isLoading ? "bg-[#596055]" : "bg-[#42B84F]"
              }`}
              style={
                !isLoading
                  ? {
                      shadowColor: "#42B84F",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 4,
                    }
                  : {}
              }
              onPress={step === 1 ? continueToConfirmation : handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#102110" />
              ) : (
                <>
                  <Text className="text-[#102110] text-center font-bold text-base">
                    {step === 1 ? "Continue" : "Create Vendor Account"}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color="#102110"
                    style={{ marginLeft: 8 }}
                  />
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
