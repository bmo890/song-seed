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
import { ScreenHeader } from "../../common/ScreenHeader";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { useWordLadderScreenModel } from "../hooks/useWordLadderScreenModel";
import { WordLadderColumnEditor } from "./WordLadderColumnEditor";
import { WordLadderPairingBoard } from "./WordLadderPairingBoard";
import { WordLadderHelpSheet } from "./WordLadderHelpSheet";
import {
  COLUMN_A_LABEL,
  COLUMN_B_LABEL,
  PLACE_SEED_PLACEHOLDER,
  ROLE_SEED_PLACEHOLDER,
  getColumnAPlaceholder,
  getColumnBPlaceholder,
  pairingSeedWords,
} from "../../../wordLadder";
import type { WordLadderStep } from "../../../types";

const KRAFT_BG = "#F2E9DC";

const STEPS: Array<{ key: WordLadderStep; label: string }> = [
  { key: "setup", label: "Words" },
  { key: "pairs", label: "Pair" },
  { key: "draft", label: "Draft" },
  { key: "revise", label: "Revise" },
];

/** "a, b and c" — joins the still-missing setup pieces into a readable hint. */
function formatMissing(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function WordLadderScreenContent() {
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
        <ScreenHeader title="Word Ladder" leftIcon="back" onLeftPress={model.goBack} />
        <View style={contentStyles.missingState}>
          <Ionicons name="trail-sign-outline" size={28} color={colors.textMuted} />
          <Text style={contentStyles.missingTitle}>This exercise is gone</Text>
          <Text style={contentStyles.missingBody}>
            It may have been deleted. Head back to the Lyrics Notebook to start a new one.
          </Text>
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
  if (!hasRole) setupMissing.push("a job/role");
  if (!hasVerbs) setupMissing.push("a verb");
  if (!hasPlace) setupMissing.push("a room/place");
  if (!hasNouns) setupMissing.push("a noun");

  // Single setup message: list what's missing first, then nudge toward an even
  // count once both columns have words but differ in length.
  let setupWarning: string | null = null;
  if (setupMissing.length > 0) {
    setupWarning = `Add ${formatMissing(setupMissing)} to continue.`;
  } else if (!countsMatch) {
    const diff = Math.abs(verbCount - nounCount);
    const side = verbCount > nounCount ? "noun" : "verb";
    const verbLabel = verbCount === 1 ? "verb" : "verbs";
    const nounLabel = nounCount === 1 ? "noun" : "nouns";
    setupWarning = `${verbCount} ${verbLabel} vs ${nounCount} ${nounLabel} — add ${diff} more ${side}${diff === 1 ? "" : "s"} so both sides match.`;
  }

  return (
    <SafeAreaView style={[contentStyles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={contentStyles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScreenHeader
        title="Word Ladder"
        leftIcon="back"
        onLeftPress={model.goBack}
        rightElement={
          <Pressable
            style={({ pressed }) => [contentStyles.deleteBtn, pressed ? appStyles.pressDown : null]}
            onPress={model.deleteExercise}
            hitSlop={6}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
          </Pressable>
        }
      />

      <StepProgress step={model.step} />

      <HelpButton
        label={STEPS.find((s) => s.key === model.step)?.label ?? "Help"}
        seen={exercise.seenHelpSteps.includes(model.step)}
        onPress={() => {
          model.markHelpSeen(model.step);
          setHelpVisible(true);
        }}
      />

      {model.step === "setup" ? (
        <>
          <View style={contentStyles.columnsRow}>
            <WordLadderColumnEditor
              label={COLUMN_A_LABEL}
              placeholder={getColumnAPlaceholder(exercise.roleSeed)}
              words={exercise.columnA}
              seedSlot={
                <SetupSeedField
                  label="Job / role"
                  value={exercise.roleSeed}
                  placeholder={ROLE_SEED_PLACEHOLDER}
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
              label={COLUMN_B_LABEL}
              placeholder={getColumnBPlaceholder(exercise.placeSeed)}
              words={exercise.columnB}
              seedSlot={
                <SetupSeedField
                  label="Room / place"
                  value={exercise.placeSeed}
                  placeholder={PLACE_SEED_PLACEHOLDER}
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
                Next: pair them up
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
                <Text style={contentStyles.footerHint}>Connect at least one pair to continue.</Text>
              </View>
            ) : unpairedCount > 0 ? (
              <Text style={contentStyles.footerHint}>
                {unpairedCount} word{unpairedCount === 1 ? "" : "s"} still unpaired — only pairs become sparks.
              </Text>
            ) : null}
            <View style={contentStyles.footerRow}>
              <Pressable
                style={({ pressed }) => [contentStyles.backBtn, pressed ? appStyles.pressDown : null]}
                onPress={() => model.goToStep("setup")}
              >
                <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
                <Text style={contentStyles.backBtnText}>Words</Text>
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
                  Next: draft a poem
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
                <Text style={contentStyles.paletteLabel}>Your sparks</Text>
                <Text style={contentStyles.paletteHint}>tap one when you've used it</Text>
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
                      <Text style={[contentStyles.sparkText, used ? contentStyles.sparkTextUsed : null]}>
                        {spark.seedA}
                        <Text style={contentStyles.sparkDot}>  ·  </Text>
                        {spark.seedB}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <View style={contentStyles.poemCard}>
            <TextInput
              style={contentStyles.poemInput}
              value={exercise.draft}
              onChangeText={model.setDraft}
              multiline
              textAlignVertical="top"
              placeholder="Write loosely. Pull from the sparks above, bend them, leave some behind — don't judge it. This is just a warm-up."
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
                  <Text style={contentStyles.backBtnText}>Pairs</Text>
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
                    Next: revise
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
            <Text style={contentStyles.draftRefLabel}>Your draft</Text>
            <ScrollView
              style={[
                contentStyles.draftRefScroll,
                keyboardVisible ? contentStyles.draftRefScrollCompact : null,
              ]}
              showsVerticalScrollIndicator={false}
            >
              <Text style={contentStyles.draftRefText}>{exercise.draft.trim() || "—"}</Text>
            </ScrollView>
          </View>

          {keyboardVisible ? null : (
            <Text style={contentStyles.reviseHint}>
              Rewrite it below into lines you'd keep — cut, reorder, change words. The revision is what gets
              saved.
            </Text>
          )}

          <View style={contentStyles.poemCard}>
            <TextInput
              style={contentStyles.poemInput}
              value={exercise.revision}
              onChangeText={model.setRevision}
              multiline
              textAlignVertical="top"
              placeholder="Start your revision on a clean page…"
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
                  <Text style={contentStyles.backBtnText}>Draft</Text>
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
                    Save as lyrics
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

/** Non-interactive wizard progress — clarifies "step N of 4" without letting
 * the writer jump around (that's what the Next/Back buttons are for). */
function StepProgress({ step }: { step: WordLadderStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === step);
  return (
    <View style={contentStyles.progressRow}>
      {STEPS.map((s, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        const isCurrent = state === "current";
        return (
          <View key={s.key} style={contentStyles.progressItem}>
            <View
              style={[
                contentStyles.progressDot,
                isCurrent ? contentStyles.progressDotCurrent : null,
                state === "done" ? contentStyles.progressDotDone : null,
              ]}
            >
              {state === "done" ? (
                <Ionicons name="checkmark" size={11} color={colors.onPrimary} />
              ) : (
                <Text
                  style={[contentStyles.progressNum, isCurrent ? contentStyles.progressNumCurrent : null]}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              style={[contentStyles.progressLabel, isCurrent ? contentStyles.progressLabelCurrent : null]}
            >
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** A "(?) {step}" button. It highlights (filled) until the current step's help
 * has been opened, then recedes to a quiet link — the re-highlight on each new
 * step signals there's fresh, step-specific guidance to read. */
function HelpButton({ label, seen, onPress }: { label: string; seen: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        contentStyles.helpBtn,
        seen ? contentStyles.helpBtnSeen : contentStyles.helpBtnNew,
        pressed ? appStyles.pressDown : null,
      ]}
      onPress={onPress}
      hitSlop={6}
    >
      <Ionicons
        name="help-circle"
        size={15}
        color={seen ? colors.textMuted : colors.onPrimary}
      />
      <Text style={[contentStyles.helpBtnText, seen ? contentStyles.helpBtnTextSeen : contentStyles.helpBtnTextNew]}>
        {label}
      </Text>
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
      <TextInput
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
          <Text style={contentStyles.frozenText}>{role}</Text>
        </View>
      ) : null}
      {role && place ? <View style={contentStyles.frozenDot} /> : null}
      {place ? (
        <View style={contentStyles.frozenChip}>
          <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
          <Text style={contentStyles.frozenText}>{place}</Text>
        </View>
      ) : null}
    </View>
  );
}

