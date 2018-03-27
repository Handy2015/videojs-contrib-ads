import {ContentState, Preroll} from '../states.js';
import cancelContentPlay from '../cancelContentPlay.js';

/*
 * This is the initial state for a player with an ad plugin. Normally, it remains in this
 * state until a "play" event is seen. After that, we enter the Preroll state to check for
 * prerolls. This happens regardless of whether or not any prerolls ultimately will play.
 * Errors and other conditions may lead us directly from here to ContentPlayback.
 */
export default class BeforePreroll extends ContentState {

  init(player) {
    this.adsReady = false;
    this.shouldResumeToContent = false;

    player.ads._shouldBlockPlay = true;
  }

  /*
   * The integration may trigger adsready before the play request. If so,
   * we record that adsready already happened so the Preroll state will know.
   */
  onAdsReady(player) {
    player.ads.debug('Received adsready event (BeforePreroll)');
    this.adsReady = true;
  }

  /*
   * Ad mode officially begins on the play request, because at this point
   * content playback is blocked by the ad plugin.
   */
  onPlay(player) {
    player.ads.debug('Received play event (BeforePreroll)');

    // Don't start content playback yet
    cancelContentPlay(player);

    // Check for prerolls
    this.transitionTo(Preroll, this.adsReady, this.shouldResumeToContent);
  }

  /*
   * All ads for the entire video are canceled.
   */
  onAdsCanceled(player) {
    player.ads.debug('adscanceled (BeforePreroll)');

    // this.transitionTo(ContentPlayback, true);
    // eslint-disable-next-line no-console
    console.log('**** transition to preroll instead of ContentPlayback',
      this.contentResuming);
    this.shouldResumeToContent = true;
  }

  /*
   * An ad error occured. Play content instead.
   */
  onAdsError() {
    // this.transitionTo(ContentPlayback, true);
    this.player.ads.debug('adserror (BeforePreroll)');
    this.shouldResumeToContent = true;
  }

  /*
   * If there is no preroll, don't wait for a play event to move forward.
   */
  onNoPreroll() {
    this.player.ads.debug('Skipping prerolls due to nopreroll event (BeforePreroll)');

    // this.transitionTo(ContentPlayback, true);
    // eslint-disable-next-line no-console
    console.log('**** transition to preroll instead of ContentPlayback',
      this.contentResuming, this.player.ads.nopreroll_);
    this.shouldResumeToContent = true;
  }

  /*
   * Prerolls skipped by integration. Play content instead.
   */
  skipLinearAdMode() {
    const player = this.player;

    player.trigger('adskip');
    // this.transitionTo(ContentPlayback, true);
    player.ads.debug('skipLinearAdMode (BeforePreroll)');
    this.shouldResumeToContent = true;
  }

  /*
   * Content source change before preroll is currently not handled. When
   * developed, this is where to start.
   */
  onContentChanged() {}

}
