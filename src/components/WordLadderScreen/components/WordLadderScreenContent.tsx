import { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { contentStyles } from "./WordLadderScreenContent.styles";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../design/tokens";
import { Press } from "../../common/Press";
import { InkKey } from "../../common/InkKey";
import { toast } from "../../common/toastStore";
import { useSparkTextScale } from "../../common/sparkTextScale";
import { SPARK_PAPER, SparkFooter, SparkHeader, SparkMissing, SparkSteps } from "../../common/SparkFrame";
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
  const { size, lineHeight } = useSparkTextScale();
  const [helpVisible, setHelpVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // The shared spark zoom drives the poem pages and the draft reference.
  const scaledPoem = { fontSize: size + 1, lineHeight: lineHeight + 2 };
  const scaledRef = { fontSize: size - 1.5, lineHeight: lineHeight - 3 };
  const scaledToken = { fontSize: size - 3 };

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
      <SafeAreaView style={[contentStyles.shell, { backgroundColor: SPARK_PAPER }]} edges={["top", "bottom"]}>
        <SparkMissing
          icon={<Ionicons name="trail-sign-outline" size={28} color={colors.textMuted} />}
          title={t("wordSparks.gone")}
          body={t("wordSparks.goneBody")}
          onBack={model.goBack}
        />
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
  const hasDraft = model.draftField.draft.trim().length > 0;
  const hasRevision = model.revisionField.draft.trim().length > 0;

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
  const stepLabel = (item: WordLadderStep) =>
    t(`wordSparks.${item === "setup" ? "words" : item === "pairs" ? "pair" : item}`);

  return (
    <SafeAreaView style={[contentStyles.shell, { backgroundColor: SPARK_PAPER }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={contentStyles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <SparkHeader
        title={t("wordSparks.wordLadder")}
        onBack={model.goBack}
        onHelp={openHelp}
        onDelete={model.deleteExercise}
      />

      <SparkSteps steps={STEPS.map(stepLabel)} current={STEPS.indexOf(model.step)} />

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
                  surpriseLabel={t("wordLadder.randomRole")}
                  onSurprise={model.surpriseRole}
                />
              }
              onAdd={(text) => model.addColumnWord("a", text)}
              onSuggest={() => model.suggestColumnWords("a")}
              onEdit={(id, text) => model.editColumnWord("a", id, text)}
              onReorder={(words) => model.reorderColumnWords("a", words)}
              onRemove={(id) => model.removeColumnWord("a", id)}
            />
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
                  surpriseLabel={t("wordLadder.randomPlace")}
                  onSurprise={model.surprisePlace}
                />
              }
              onAdd={(text) => model.addColumnWord("b", text)}
              onSuggest={() => model.suggestColumnWords("b")}
              onEdit={(id, text) => model.editColumnWord("b", id, text)}
              onReorder={(words) => model.reorderColumnWords("b", words)}
              onRemove={(id) => model.removeColumnWord("b", id)}
            />
          </View>

          <SparkFooter
            hint={setupWarning}
            next={{ label: t("wordSparks.pair"), onPress: () => model.goToStep("pairs"), disabled: !canLeaveSetup }}
          />
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
              history={model.pairingHistory}
            />
          </View>

          <SparkFooter
            hint={canLeavePairs && unpairedCount > 0 ? t("wordLadder.unpaired", { count: unpairedCount }) : null}
            back={{ label: t("wordSparks.words"), onPress: () => model.goToStep("setup") }}
            next={{ label: t("wordSparks.draft"), onPress: () => model.goToStep("draft"), disabled: !canLeavePairs }}
          />
        </>
      ) : null}

      {model.step === "draft" ? (
        <>
          {sparks.length > 0 ? (
            <View style={contentStyles.palette}>
              <View style={contentStyles.labelRow}>
                <Text style={contentStyles.label}>{t("wordLadder.yourSparks")}</Text>
                <Text style={contentStyles.labelHint}>{t("wordLadder.sparkHint")}</Text>
              </View>
              <ScrollView
                style={contentStyles.paletteScroll}
                contentContainerStyle={contentStyles.paletteWrap}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {sparks.map((spark) => {
                  const used = usedSparks.has(spark.id);
                  return (
                    <Press
                      key={spark.id}
                      // Haptics vocabulary: light, a small state flip (struck through, or back).
                      feel="glyph"
                      haptic="light"
                      style={contentStyles.sparkToken}
                      onPress={() => model.toggleSparkUsed(spark.id)}
                      hitSlop={{ top: 5, bottom: 5 }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: used }}
                      accessibilityLabel={`${spark.seedA} · ${spark.seedB}`}
                    >
                      <View style={[contentStyles.sparkDot, used ? contentStyles.sparkDotUsed : null]} />
                      <UserText
                        value={spark.seedA}
                        style={[contentStyles.sparkText, scaledToken, used ? contentStyles.sparkTextUsed : null]}
                      >
                        {spark.seedA} · {spark.seedB}
                      </UserText>
                    </Press>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <View style={contentStyles.poemCard}>
            <UserTextInput
              style={[contentStyles.poemInput, scaledPoem]}
              value={model.draftField.draft}
              onChangeText={model.draftField.onChangeText}
              onBlur={model.draftField.flush}
              multiline
              textAlignVertical="top"
              placeholder={t("wordLadder.draftPlaceholder")}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {keyboardVisible ? null : (
            <SparkFooter
              back={{ label: t("wordSparks.pair"), onPress: () => model.goToStep("pairs") }}
              next={{ label: t("wordSparks.revise"), onPress: () => model.goToStep("revise"), disabled: !hasDraft }}
            />
          )}
        </>
      ) : null}

      {model.step === "revise" ? (
        <>
          <View style={contentStyles.draftRef}>
            <View style={contentStyles.labelRow}>
              <Text style={contentStyles.label}>{t("wordLadder.yourDraft")}</Text>
              {hasDraft ? (
                <InkKey
                  glyph={<Ionicons name="copy-outline" size={15} color={colors.textStrong} />}
                  label={t("common.copy")}
                  style={contentStyles.copyKey}
                  onPress={() => {
                    void Clipboard.setStringAsync(exercise.draft).catch(() => {});
                    toast(t("common.copied"), "checkmark-outline");
                  }}
                />
              ) : null}
            </View>
            <ScrollView
              style={[
                contentStyles.draftRefScroll,
                keyboardVisible ? contentStyles.draftRefScrollCompact : null,
              ]}
              showsVerticalScrollIndicator={false}
            >
              <UserText style={[contentStyles.draftRefText, scaledRef]}>{exercise.draft.trim() || "—"}</UserText>
            </ScrollView>
          </View>

          <View style={contentStyles.poemCard}>
            <UserTextInput
              style={[contentStyles.poemInput, scaledPoem]}
              value={model.revisionField.draft}
              onChangeText={model.revisionField.onChangeText}
              onBlur={model.revisionField.flush}
              multiline
              textAlignVertical="top"
              placeholder={t("wordLadder.revisionPlaceholder")}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {keyboardVisible ? null : (
            <SparkFooter
              back={{ label: t("wordSparks.draft"), onPress: () => model.goToStep("draft") }}
              next={{ label: t("common.save"), onPress: model.saveAsLyrics, disabled: !hasRevision, final: true }}
            />
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

/** A column's seed: a small-caps label over the tonal field, the dice inside
 *  it for a random one. */
function SetupSeedField({
  label,
  value,
  placeholder,
  onChange,
  surpriseLabel,
  onSurprise,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (text: string) => void;
  surpriseLabel: string;
  onSurprise: () => void;
}) {
  return (
    <View>
      <Text style={contentStyles.label}>{label}</Text>
      <View style={contentStyles.seedField}>
        <UserTextInput
          style={contentStyles.seedInput}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          returnKeyType="done"
        />
        <Press
          // Haptics vocabulary: tap, an acknowledged press.
          feel="glyph"
          style={contentStyles.seedDice}
          onPress={onSurprise}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={surpriseLabel}
        >
          <Ionicons name="dice-outline" size={18} color={colors.textStrong} />
        </Press>
      </View>
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
