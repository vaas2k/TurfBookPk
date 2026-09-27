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
          className="flex-1 bg-[#F7F9F5]"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Header */}
          <View className="pt-12 pb-4 px-6 flex-row items-center justify-between border-b border-[#DFE6DC] bg-[#F7F9F5]">
            <View>
              <Text
                style={{
                  fontFamily: "BigShouldersDisplay_800ExtraBold",
                  fontSize: 26,
                }}
                className="text-[#172119]"
              >
                BECOME A VENDOR
              </Text>
              <Text className="text-[#6B786C] text-xs mt-0.5">
                Step {step} of 2
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close vendor registration"
              className="h-11 w-11 rounded-xl bg-white border border-[#D9E2D7] items-center justify-center"
              onPress={handleClose}
              disabled={isLoading}
            >
              <Ionicons name="close" size={24} color="#737373" />
            </TouchableOpacity>
          </View>

          <ScrollView
            className="flex-1 px-6 pt-4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <View className="flex-row mb-5">
              <View className="h-1.5 flex-1 rounded-full mr-2 bg-[#3EAF4C]" />
              <View
                className={`h-1.5 flex-1 rounded-full ${step === 2 ? "bg-[#3EAF4C]" : "bg-[#D9E2D7]"}`}
              />
            </View>
            <View className="bg-[#E5F3E6] border border-[#C5E2C8] rounded-2xl p-4 mb-6 flex-row">
              <View className="h-11 w-11 rounded-xl bg-[#3EAF4C] items-center justify-center">
                <Ionicons
                  name={
                    step === 1
                      ? "storefront-outline"
                      : "shield-checkmark-outline"
                  }
                  size={23}
                  color="white"
                />
              </View>
              <View className="flex-1 ml-3">
                <Text
                  style={{ fontFamily: "SpaceGrotesk_700Bold" }}
                  className="text-[#1E4725] text-base"
                >
                  {step === 1
                    ? "Your business details"
                    : "Confirm and get started"}
                </Text>
                <Text className="text-[#527057] text-xs mt-1">
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
                  <Text className="text-[#1A1A2E] font-medium mb-1.5">
                    Business Name <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    className={`bg-[#F5F5F5] rounded-xl px-4 py-3.5 text-[#1A1A2E] text-base border ${
                      errors.business_name
                        ? "border-red-500"
                        : "border-[#E5E5E5]"
                    }`}
                    placeholder="Enter your business name"
                    placeholderTextColor="#A3A3A3"
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
                  <Text className="text-[#1A1A2E] font-medium mb-1.5">
                    Business Phone <Text className="text-red-500">*</Text>
                  </Text>
                  <View
                    className={`flex-row items-center bg-[#F5F5F5] rounded-xl px-4 border ${
                      errors.business_phone
                        ? "border-red-500"
                        : "border-[#E5E5E5]"
                    }`}
                  >
                    <Text className="text-[#1A1A2E] font-medium py-3.5">
                      +92
                    </Text>
                    <View className="w-px h-6 bg-[#D4D4D4] mx-3" />
                    <TextInput
                      className="flex-1 py-3.5 text-[#1A1A2E] text-base"
                      placeholder="331 5139044"
                      placeholderTextColor="#A3A3A3"
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
                  <Text className="text-[#1A1A2E] font-medium mb-1.5">
                    City <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    className={`bg-[#F5F5F5] rounded-xl px-4 py-3.5 text-[#1A1A2E] text-base border ${
                      errors.business_city
                        ? "border-red-500"
                        : "border-[#E5E5E5]"
                    }`}
                    placeholder="Enter your city"
                    placeholderTextColor="#A3A3A3"
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
                  <Text className="text-[#1A1A2E] font-medium mb-1.5">
                    Business Description (Optional)
                  </Text>
                  <TextInput
                    className="bg-[#F5F5F5] rounded-xl px-4 py-3.5 text-[#1A1A2E] text-base border border-[#E5E5E5]"
                    placeholder="Tell us about your business..."
                    placeholderTextColor="#A3A3A3"
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
                        ? "bg-[#4CAF50] border-[#4CAF50]"
                        : "border-[#D4D4D4]"
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
                      <Ionicons name="checkmark" size={14} color="white" />
                    )}
                  </TouchableOpacity>
                  <Text className="text-[#737373] text-sm flex-1">
                    I agree to the{" "}
                    <Text className="text-[#4CAF50]">Terms of Service</Text> and{" "}
                    <Text className="text-[#4CAF50]">Privacy Policy</Text>
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
                isLoading ? "bg-[#E5E5E5]" : "bg-[#4CAF50]"
              }`}
              style={
                !isLoading
                  ? {
                      shadowColor: "#4CAF50",
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
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text className="text-white text-center font-bold text-base">
                    {step === 1 ? "Continue" : "Create Vendor Account"}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color="white"
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
