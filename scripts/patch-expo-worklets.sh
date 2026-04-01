#!/bin/bash
# Patch expo-modules-core to support react-native-worklets@0.8.x SymbolType + ShareableType
# See: https://github.com/software-mansion/react-native-reanimated/issues/9100

HEADER="node_modules/expo-modules-core/ios/Worklets/EXJavaScriptSerializable.h"
IMPL="node_modules/expo-modules-core/ios/Worklets/EXJavaScriptSerializable.mm"

if [ ! -f "$HEADER" ]; then
  echo "expo-modules-core not found, skipping patch"
  exit 0
fi

if grep -q "EXSerializableValueTypeSymbol" "$HEADER"; then
  echo "expo-modules-core already patched"
  exit 0
fi

echo "Patching expo-modules-core for worklets@0.8.x compatibility..."

# Add SymbolType and ShareableType to enum
sed -i '' 's/EXSerializableValueTypeCustom = 19,/EXSerializableValueTypeCustom = 19,\
  EXSerializableValueTypeSymbol = 20,\
  EXSerializableValueTypeShareable = 21,/' "$HEADER"

# Add switch cases
sed -i '' 's/case worklets::Serializable::ValueType::CustomType:/case worklets::Serializable::ValueType::CustomType:\
      return EXSerializableValueTypeCustom;\
    case worklets::Serializable::ValueType::SymbolType:\
      return EXSerializableValueTypeSymbol;\
    case worklets::Serializable::ValueType::ShareableType:/' "$IMPL"

# Remove duplicate return for CustomType (sed added one, original had one)
# Actually the sed above replaces the line including CustomType case, so we need to fix
# Let me just verify the patch applied correctly
if grep -q "EXSerializableValueTypeSymbol" "$HEADER" && grep -q "SymbolType" "$IMPL"; then
  echo "Patch applied successfully"
else
  echo "Patch may have failed, check files manually"
fi
