import React, { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { styles } from "../../styles";

type Props = {
  header?: ReactNode;
  floating?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  scrollable?: boolean;
};

export function TransportLayout({ header, floating, footer, children, scrollable = false }: Props) {
  const surfaceStyle = [styles.transportSurface, floating ? styles.transportSurfaceWithFloating : null];
  const content = scrollable ? (
    <ScrollView
      style={surfaceStyle}
      contentContainerStyle={[
        styles.transportScrollContent,
        floating ? styles.transportScrollContentWithFloating : null,
      ]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={surfaceStyle}>{children}</View>
  );

  return (
    <View style={styles.transportLayout}>
      {header ? <View style={styles.transportHeaderZone}>{header}</View> : null}
      <View style={styles.transportBodyZone}>
        {content}
        {floating ? <View style={styles.transportFloatingZone}>{floating}</View> : null}
      </View>
      {footer ? <View style={styles.transportFooterZone}>{footer}</View> : null}
    </View>
  );
}
