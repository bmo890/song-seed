package expo.modules.songnookpitchshift

import androidx.media3.common.PlaybackParameters
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.AudioProcessorChain
import androidx.media3.common.audio.SonicAudioProcessor
import androidx.media3.common.audio.ToInt16PcmAudioProcessor
import androidx.media3.common.util.UnstableApi

/**
 * The practice engine's processing order (2026-10-21): 16-bit → pitch/speed
 * (Sonic) → the take's sound chain, limiter last.
 *
 * media3's own chain always runs the caller's processors BEFORE Sonic, so the
 * limiter was limiting the input to the pitch shifter and whatever the shifter
 * added on top went straight to the speaker, clipped. With the limiter after
 * Sonic the output is held under the ceiling whatever the shift does.
 */
@UnstableApi
class SongNookAudioProcessorChain(
  private val sonic: SonicAudioProcessor,
  private val soundChain: SoundChainAudioProcessor,
) : AudioProcessorChain {
  private val processors: Array<AudioProcessor> =
    arrayOf(ToInt16PcmAudioProcessor(), sonic, soundChain)

  override fun getAudioProcessors(): Array<AudioProcessor> = processors

  override fun applyPlaybackParameters(playbackParameters: PlaybackParameters): PlaybackParameters {
    sonic.setSpeed(playbackParameters.speed)
    sonic.setPitch(playbackParameters.pitch)
    return playbackParameters
  }

  /** No silence skipping in a practice player: a rest is part of the take. */
  override fun applySkipSilenceEnabled(skipSilenceEnabled: Boolean): Boolean = false

  override fun getMediaDuration(playoutDuration: Long): Long = sonic.getMediaDuration(playoutDuration)

  override fun getSkippedOutputFrameCount(): Long = 0
}
