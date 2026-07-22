import { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { contentStyles } from "./WordLadderScreenContent.styles";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { useWordLadderScreenModel } from "../hooks/useWordLadderScreenModel";
import { WordLadderColumnEditor } from "./WordLadderColumnEditor";
import { WordLadderPairingBoard } from "./WordLadderPairingBoard";
import { WordLadderHelpSheet } from "./WordLadderHelpSheet";
import {
  pairingSeedWords,
} from "../../../domain/wordLadder";
import type { WordLadderStep } from "../../../types";
import { UserText, UserTextInput } from "../../../i18n";
import { useTranslation } from "react-i18next";

const KRAFT_BG = "#F2E9DC";

const STEPS: WordLadderStep[] = ["setup", "pairs", "draft", "revise"];

/** "a, b and c" — joins the still-missing setup pieces into a readable hint. */
function formatMissing(parts: string[], t: ReturnType<typeof useTranslation>["t"]): string {
  if (parts.length <= 1) return parts.join("");
  if (parts.length === 2) return t("wordLadder.listTwo", { first: parts[0], second: parts[1] });
  return t("wordLadder.listMany", { items: parts.slice(0, -1).join(", "), last: parts[parts.length - 1] });
}

export function WordLadderScreenContent() {
  const { t } = useTranslation();
  const model = useWordLadderScreenModel();
  const { exercise } = model;
  const [helpVisible, setHelpVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Hide the step-nav footer (and shrink the draft reference) while typing so
  // the editor gets the room — the nav buttons aren't needed mid-keystroke.
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (!exercise) {
    return (
      <SafeAreaView style={[contentStyles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
        <View style={contentStyles.missingState}>
          <Ionicons name="trail-sign-outline" size={28} color={colors.textMuted} />
          <Text style={contentStyles.missingTitle}>{t("wordSparks.gone")}</Text>
          <Text style={contentStyles.missingBody}>{t("wordSparks.goneBody")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Per-step completion gates ─────────────────────────────────────────────
  // The writer can't advance until the current step holds enough to make the
  // next one meaningful: setup needs both seeds, at least one word per column,
  // AND an equal count on each side so every word finds a partner; pairing
  // needs at least one connected pair.
  const verbCount = exercise.columnA.length;
  const nounCount = exercise.columnB.length;
  const hasRole = exercise.roleSeed.trim().length > 0;
  const hasPlace = exercise.placeSeed.trim().length > 0;
  const hasVerbs = verbCount > 0;
  const hasNouns = nounCount > 0;
  const countsMatch = verbCount === nounCount;
  const canLeaveSetup = hasRole && hasPlace && hasVerbs && hasNouns && countsMatch;

  const pairCount = exercise.pairings.length;
  const canLeavePairs = pairCount > 0;
  // Each pairing consumes one word from each column, so leftovers are simply
  // the difference. We nudge (non-blocking) when words would be left behind.
  const unpairedCount = verbCount - pairCount + (nounCount - pairCount);

  // The pairs become a reference palette of sparks on the draft step.
  const sparks = exercise.pairings
    .map((pairing) => {
      const seed = pairingSeedWords(pairing, exercise.columnA, exercise.columnB);
      return seed ? { id: pairing.id, ...seed } : null;
    })
    .filter((spark): spark is { id: string; seedA: string; seedB: string } => spark !== null);
  const usedSparks = new Set(exercise.usedSparkIds);
  const hasDraft = exercise.draft.trim().length > 0;
  const hasRevision = exercise.revision.trim().length > 0;

  const setupMissing: string[] = [];
  if (!hasRole) setupMissing.push(t("wordLadder.missingRole"));
  if (!hasVerbs) setupMissing.push(t("wordLadder.missingVerb"));
  if (!hasPlace) setupMissing.push(t("wordLadder.missingPlace"));
  if (!hasNouns) setupMissing.push(t("wordLadder.missingNoun"));

  // Single setup message: list what's missing first, then nudge toward an even
  // count once both columns have words but differ in length.
  let setupWarning: string | null = null;
  if (setupMissing.length > 0) {
    setupWarning = t("wordLadder.addMissing", { items: formatMissing(setupMissing, t) });
  } else if (!countsMatch) {
    const diff = Math.abs(verbCount - nounCount);
    const sideKey = verbCount > nounCount ? "wordLadder.nounSide" : "wordLadder.verbSide";
    setupWarning = t("wordLadder.mismatch", { verbs: t("wordLadder.verbCount", { count: verbCount }), nouns: t("wordLadder.nounCount", { count: nounCount }), count: diff, side: t(sideKey, { count: diff }) });
  }

  const openHelp = () => {
    model.markHelpSeen(model.step);
    setHelpVisible(true);
  };

  return (
    <SafeAreaView style={[contentStyles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={contentStyles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <View style={contentStyles.header}>
        <IconBtn icon="chevron-back" label="Back" onPress={model.goBack} />
        <Text style={contentStyles.headerTitle}>{t("wordSparks.wordLadder")}</Text>
        <IconBtn icon="help-circle-outline" label="How this works" onPress={openHelp} />
        <IconBtn icon="trash-outline" label="Delete" onPress={model.deleteExercise} muted />
      </View>

      <StepRail step={model.step} />

      {model.step === "setup" ? (
        <>
          <View style={contentStyles.columnsRow}>
            <WordLadderColumnEditor
              label={t("wordLadder.verbs")}
              placeholder={t("wordLadder.addVerb")}
              words={exercise.columnA}
              seedSlot={
                <SetupSeedField
                  label={t("wordSparks.jobRole")}
                  value={exercise.roleSeed}
                  placeholder={t("wordLadder.rolePlaceholder")}
                  onChange={model.setRoleSeed}
                />
              }
              onAdd={(text) => model.addColumnWord("a", text)}
              onEdit={(id, text) => model.editColumnWord("a", id, text)}
              onReorder={(words) => model.reorderColumnWords("a", words)}
              onRemove={(id) => model.removeColumnWord("a", id)}
            />
            <View style={contentStyles.columnDivider} />
            <WordLadderColumnEditor
              label={t("wordLadder.nouns")}
              placeholder={t("wordLadder.addNoun")}
              words={exercise.columnB}
              seedSlot={
                <SetupSeedField
                  label={t("wordSparks.roomPlace")}
                  value={exercise.placeSeed}
                  placeholder={t("wordLadder.placePlaceholder")}
                  onChange={model.setPlaceSeed}
                />
              }
              onAdd={(text) => model.addColumnWord("b", text)}
              onEdit={(id, text) => model.editColumnWord("b", id, text)}
              onReorder={(words) => model.reorderColumnWords("b", words)}
              onRemove={(id) => model.removeColumnWord("b", id)}
            />
          </View>

          <View style={contentStyles.setupSpacer} />

          <View style={contentStyles.wizardFooter}>
            {setupWarning ? (
              <View style={contentStyles.warnRow}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.textSecondary} />
                <Text style={contentStyles.footerHint}>{setupWarning}</Text>
              </View>
            ) : null}
            <Pressable
              style={({ pressed }) => [
                contentStyles.nextBtn,
                !canLeaveSetup ? contentStyles.nextBtnDisabled : null,
                pressed && canLeaveSetup ? appStyles.pressDown : null,
              ]}
              onPress={() => model.goToStep("pairs")}
              disabled={!canLeaveSetup}
            >
              <Text
                style={[contentStyles.nextBtnText, !canLeaveSetup ? contentStyles.nextBtnTextDisabled : null]}
              >
                {t("wordSparks.nextPair")}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={16}
                color={canLeaveSetup ? colors.onPrimary : colors.textSecondary}
              />
            </Pressable>
          </View>
        </>
      ) : null}

      {model.step === "pairs" ? (
        <>
          <FrozenSeedBanner roleSeed={exercise.roleSeed} placeSeed={exercise.placeSeed} />
          <View style={contentStyles.stepBody}>
            <WordLadderPairingBoard
              exercise={exercise}
              armedWord={model.armedWord}
              onTapWord={model.handleWordTapForPairing}
              onUnpair={model.unpairWord}
              onToggleLock={model.toggleLockPairing}
              onShuffle={model.shuffle}
            />
          </View>

          <View style={contentStyles.wizardFooter}>
            {!canLeavePairs ? (
              <View style={contentStyles.warnRow}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.textSecondary} />
                <Text style={contentStyles.footerHint}>{t("wordSparks.connectPair")}</Text>
              </View>
            ) : unpairedCount > 0 ? (
              <Text style={contentStyles.footerHint}>
                {t("wordLadder.unpaired", { count: unpairedCount })}
              </Text>
            ) : null}
            <View style={contentStyles.footerRow}>
              <Pressable
                style={({ pressed }) => [contentStyles.backBtn, pressed ? appStyles.pressDown : null]}
                onPress={() => model.goToStep("setup")}
              >
                <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
                <Text style={contentStyles.backBtnText}>{t("wordSparks.words")}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  contentStyles.nextBtn,
                  contentStyles.nextBtnGrow,
                  !canLeavePairs ? contentStyles.nextBtnDisabled : null,
                  pressed && canLeavePairs ? appStyles.pressDown : null,
                ]}
                onPress={() => model.goToStep("draft")}
                disabled={!canLeavePairs}
              >
                <Text
                  style={[contentStyles.nextBtnText, !canLeavePairs ? contentStyles.nextBtnTextDisabled : null]}
                >
                  {t("wordLadder.nextDraft")}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={canLeavePairs ? colors.onPrimary : colors.textSecondary}
                />
              </Pressable>
            </View>
          </View>
        </>
      ) : null}

      {model.step === "draft" ? (
        <>
          {sparks.length > 0 ? (
            <View style={contentStyles.palette}>
              <View style={contentStyles.paletteHeader}>
                <Text style={contentStyles.paletteLabel}>{t("wordLadder.yourSparks")}</Text>
                <Text style={contentStyles.paletteHint}>{t("wordLadder.sparkHint")}</Text>
              </View>
              <ScrollView
                style={contentStyles.paletteScroll}
                contentContainerStyle={contentStyles.paletteWrap}
                showsVerticalScrollIndicator={false}
              >
                {sparks.map((spark) => {
                  const used = usedSparks.has(spark.id);
                  return (
                    <Pressable
                      key={spark.id}
                      style={({ pressed }) => [
                        contentStyles.sparkChip,
                        used ? contentStyles.sparkChipUsed : null,
                        pressed ? appStyles.pressDown : null,
                      ]}
                      onPress={() => model.toggleSparkUsed(spark.id)}
                    >
                      <UserText value={spark.seedA} style={[contentStyles.sparkText, used ? contentStyles.sparkTextUsed : null]}>
                        {spark.seedA}
                        <Text style={contentStyles.sparkDot}>  ·  </Text>
                        {spark.seedB}
                      </UserText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <View style={contentStyles.poemCard}>
            <UserTextInput
              style={contentStyles.poemInput}
              value={exercise.draft}
              onChangeText={model.setDraft}
              multiline
              textAlignVertical="top"
              placeholder={t("wordLadder.draftPlaceholder")}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {keyboardVisible ? null : (
            <View style={contentStyles.wizardFooter}>
              <View style={contentStyles.footerRow}>
                <Pressable
                  style={({ pressed }) => [contentStyles.backBtn, pressed ? appStyles.pressDown : null]}
                  onPress={() => model.goToStep("pairs")}
                >
                  <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
                  <Text style={contentStyles.backBtnText}>{t("wordSparks.pair")}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    contentStyles.nextBtn,
                    contentStyles.nextBtnGrow,
                    !hasDraft ? contentStyles.nextBtnDisabled : null,
                    pressed && hasDraft ? appStyles.pressDown : null,
                  ]}
                  onPress={() => model.goToStep("revise")}
                  disabled={!hasDraft}
                >
                  <Text style={[contentStyles.nextBtnText, !hasDraft ? contentStyles.nextBtnTextDisabled : null]}>
                    {t("wordLadder.nextRevise")}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={hasDraft ? colors.onPrimary : colors.textSecondary}
                  />
                </Pressable>
              </View>
            </View>
          )}
        </>
      ) : null}

      {model.step === "revise" ? (
        <>
          <View style={contentStyles.draftRef}>
            <Text style={contentStyles.draftRefLabel}>{t("wordLadder.yourDraft")}</Text>
            <ScrollView
              style={[
                contentStyles.draftRefScroll,
                keyboardVisible ? contentStyles.draftRefScrollCompact : null,
              ]}
              showsVerticalScrollIndicator={false}
            >
              <UserText style={contentStyles.draftRefText}>{exercise.draft.trim() || "—"}</UserText>
            </ScrollView>
          </View>

          {keyboardVisible ? null : (
            <Text style={contentStyles.reviseHint}>{t("wordLadder.reviseHint")}</Text>
          )}

          <View style={contentStyles.poemCard}>
            <UserTextInput
              style={contentStyles.poemInput}
              value={exercise.revision}
              onChangeText={model.setRevision}
              multiline
              textAlignVertical="top"
              placeholder={t("wordLadder.revisionPlaceholder")}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {keyboardVisible ? null : (
            <View style={contentStyles.wizardFooter}>
              <View style={contentStyles.footerRow}>
                <Pressable
                  style={({ pressed }) => [contentStyles.backBtn, pressed ? appStyles.pressDown : null]}
                  onPress={() => model.goToStep("draft")}
                >
                  <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
                  <Text style={contentStyles.backBtnText}>{t("wordSparks.draft")}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    contentStyles.nextBtn,
                    contentStyles.nextBtnGrow,
                    !hasRevision ? contentStyles.nextBtnDisabled : null,
                    pressed && hasRevision ? appStyles.pressDown : null,
                  ]}
                  onPress={model.saveAsLyrics}
                  disabled={!hasRevision}
                >
                  <Ionicons
                    name="bookmark-outline"
                    size={15}
                    color={hasRevision ? colors.onPrimary : colors.textSecondary}
                  />
                  <Text
                    style={[contentStyles.nextBtnText, !hasRevision ? contentStyles.nextBtnTextDisabled : null]}
                  >
                    {t("wordSparks.saveLyrics")}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </>
      ) : null}
      </KeyboardAvoidingView>

      <WordLadderHelpSheet
        visible={helpVisible}
        step={model.step}
        onClose={() => setHelpVisible(false)}
      />
    </SafeAreaView>
  );
}

/** A slim step rail — the four labels with the current step accented, over a
 * progress bar. Wayfinding without the clunky numbered dots. */
function StepRail({ step }: { step: WordLadderStep }) {
  const { t } = useTranslation();
  const currentIndex = STEPS.findIndex((item) => item === step);
  const progress = (currentIndex + 1) / STEPS.length;
  const labelFor = (item: WordLadderStep) =>
    t(`wordSparks.${item === "setup" ? "words" : item === "pairs" ? "pair" : item}`);
  return (
    <View style={contentStyles.rail}>
      <View style={contentStyles.railLabels}>
        {STEPS.map((item, index) => (
          <Text
            key={item}
            style={[
              contentStyles.railLabel,
              index === currentIndex
                ? contentStyles.railLabelCurrent
                : index < currentIndex
                  ? contentStyles.railLabelDone
                  : null,
            ]}
          >
            {labelFor(item)}
          </Text>
        ))}
      </View>
      <View style={contentStyles.railTrack}>
        <View style={[contentStyles.railFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

function IconBtn({
  icon,
  label,
  onPress,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  muted?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [contentStyles.iconBtn, pressed ? appStyles.pressDown : null]}
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={muted ? colors.textSecondary : colors.textStrong} />
    </Pressable>
  );
}

/** The seed input that sits atop a column during the setup step. */
function SetupSeedField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (text: string) => void;
}) {
  return (
    <View style={contentStyles.seedHeader}>
      <Text style={contentStyles.seedLabel}>{label}</Text>
      <UserTextInput
        style={contentStyles.seedInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
      />
      <View style={contentStyles.seedHeaderDivider} />
    </View>
  );
}

/** A read-only reminder of the locked seeds, shown on the pair and line steps. */
function FrozenSeedBanner({ roleSeed, placeSeed }: { roleSeed: string; placeSeed: string }) {
  const role = roleSeed.trim();
  const place = placeSeed.trim();
  if (!role && !place) return null;
  return (
    <View style={contentStyles.frozenBanner}>
      {role ? (
        <View style={contentStyles.frozenChip}>
          <Ionicons name="briefcase-outline" size={12} color={colors.textSecondary} />
          <UserText style={contentStyles.frozenText}>{role}</UserText>
        </View>
      ) : null}
      {role && place ? <View style={contentStyles.frozenDot} /> : null}
      {place ? (
        <View style={contentStyles.frozenChip}>
          <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
          <UserText style={contentStyles.frozenText}>{place}</UserText>
        </View>
      ) : null}
    </View>
  );
}
