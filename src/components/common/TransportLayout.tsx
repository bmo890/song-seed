import React, { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { styles } from "../../styles";

type Props = {
  header?: ReactNode;
  /** Fixed region between the header and the scrollable body (e.g. a pinned waveform). */
  stickyTop?: ReactNode;
  floating?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  scrollable?: boolean;
  /** When the footer's first row draws its own top line (the full-view progress
   *  thread doubles as the divider), the zone's hairline must stand down. */
  footerDivider?: boolean;
};

export function TransportLayout({
  header,
  stickyTop,
  floating,
  footer,
  children,
  scrollable = false,
  footerDivider = true,
}: Props) {
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
      {stickyTop ?? null}
      <View style={styles.transportBodyZone}>
        {content}
        {floating ? <View style={styles.transportFloatingZone}>{floating}</View> : null}
      </View>
      {footer ? (
        <View
          style={[
            styles.transportFooterZone,
            footerDivider ? null : styles.transportFooterZoneNoDivider,
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
