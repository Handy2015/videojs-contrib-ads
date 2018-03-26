import videojs from 'video.js';

import {AdState} from '../states.js';
import cancelContentPlay from '../cancelContentPlay.js';
import adBreak from '../adBreak.js';

/*
 * This state encapsulates waiting for prerolls, preroll playback, and
 * content restoration after a preroll.
 */
export default class Preroll extends AdState {

  init(player, adsReady) {
    // Loading spinner from now until ad start or end of ad break.
    player.addClass('vjs-ad-loading');

    // Determine preroll timeout based on plugin settings
    let timeout = player.ads.settings.timeout;

    if (typeof player.ads.settings.prerollTimeout === 'number') {
      timeout = player.ads.settings.prerollTimeout;
    }

    // Start the clock ticking for ad timeout
    this._timeout = player.setTimeout(function() {
      player.trigger('adtimeout');
    }, timeout);

    player.ads._shouldBlockPlay = true;

    // If adsready already happened, lets get started. Otherwise,
    // wait until onAdsReady.
    // Note: if nopreroll is seen, this causes a state transition
    if (adsReady) {
      this.handleAdsReady();
    } else {
      this.adsReady = false;
    }
  }

  onAdsReady(player) {
    if (!player.ads.inAdBreak() && !player.ads.isContentResuming()) {
      player.ads.debug('Received adsready event (Preroll)');
      this.handleAdsReady();
    } else {
      videojs.log.warn('Unexpected adsready event (Preroll)');
    }
  }

  /*
   * Ad integration is ready. Let's get started on this preroll.
   */
  handleAdsReady() {
    this.adsReady = true;
    if (this.player.ads.nopreroll_) {
      this.noPreroll();
    } else {
      this.readyForPreroll();
    }
  }

  /*
   * Helper to call a callback only after a loadstart event.
   * If we start content or ads before loadstart, loadstart
   * will not be prefixed correctly.
   */
  afterLoadStart(callback) {
    const player = this.player;

    if (player.ads._hasThereBeenALoadStartDuringPlayerLife) {
      callback();
    } else {
      player.ads.debug('Waiting for loadstart...');
      player.one('loadstart', () => {
        player.ads.debug('Received loadstart event');
        callback();
      });
    }
  }

  /*
   * If there is no preroll, play content instead.
   */
  noPreroll() {
    this.afterLoadStart(() => {
      this.player.ads.debug('Skipping prerolls due to nopreroll event (Preroll)');

      // this.transitionTo(ContentPlayback, true);
      this.resumeAfterNoPreroll(this.player);
    });
  }

  /*
   * Fire the readyforpreroll event. If loadstart hasn't happened yet,
   * wait until loadstart first.
   */
  readyForPreroll() {
    const player = this.player;

    this.afterLoadStart(() => {
      player.ads.debug('Triggered readyforpreroll event (Preroll)');
      player.trigger('readyforpreroll');
    });
  }

  /*
   * Don't allow the content to start playing while we're dealing with ads.
   */
  onPlay(player) {
    player.ads.debug('Received play event (Preroll)');

    if (!this.inAdBreak() && !this.isContentResuming()) {
      cancelContentPlay(this.player);
    }
  }

  /*
   * adscanceled cancels all ads for the source. Play content now.
   */
  onAdsCanceled(player) {
    player.ads.debug('adscanceled (Preroll)');

    this.afterLoadStart(() => {
      // this.transitionTo(ContentPlayback, true);
      this.resumeAfterNoPreroll(player);
    });
  }

  /*
   * An ad error occured. Play content instead.
   */
  onAdsError(player) {
    videojs.log('adserror (Preroll)');
    // In the future, we may not want to do this automatically.
    // Integrations should be able to choose to continue the ad break
    // if there was an error.
    if (this.inAdBreak()) {
      player.ads.endLinearAdMode();

    } else {
      this.afterLoadStart(() => {
        // this.transitionTo(ContentPlayback, true);
        this.resumeAfterNoPreroll(player);
      });
    }
  }

  /*
   * Integration invoked startLinearAdMode, the ad break starts now.
   */
  startLinearAdMode() {
    const player = this.player;

    if (this.adsReady && !player.ads.inAdBreak() && !this.isContentResuming()) {
      player.clearTimeout(this._timeout);
      player.ads.adType = 'preroll';
      adBreak.start(player);

      // We don't need to block play calls anymore
      player.ads._shouldBlockPlay = false;
    } else {
      videojs.log.warn('Unexpected startLinearAdMode invocation (Preroll)');
    }
  }

  /*
   * An ad has actually started playing.
   * Remove the loading spinner.
   */
  onAdStarted(player) {
    player.removeClass('vjs-ad-loading');
  }

  /*
   * Integration invoked endLinearAdMode, the ad break ends now.
   */
  endLinearAdMode() {
    const player = this.player;

    // eslint-disable-next-line no-console
    console.log('*** in Preroll endLinearAdMode');

    if (this.inAdBreak()) {
      player.removeClass('vjs-ad-loading');
      adBreak.end(player);
      this.contentResuming = true;
    }
  }

  /*
   * Ad skipped by integration. Play content instead.
   */
  skipLinearAdMode() {
    const player = this.player;

    if (player.ads.inAdBreak() || this.isContentResuming()) {
      videojs.log.warn('Unexpected skipLinearAdMode invocation');
    } else {
      this.afterLoadStart(() => {
        player.trigger('adskip');
        player.ads.debug('skipLinearAdMode (Preroll)');

        // this.transitionTo(ContentPlayback, true);
        this.resumeAfterNoPreroll(player);
      });
    }
  }

  /*
   * Prerolls took too long! Play content instead.
   */
  onAdTimeout(player) {
    this.afterLoadStart(() => {
      player.ads.debug('adtimeout (Preroll)');

      // this.transitionTo(ContentPlayback, true);
      this.resumeAfterNoPreroll(player);
    });
  }

  /*
   * Check if nopreroll event was too late before handling it.
   */
  onNoPreroll(player) {
    if (player.ads.inAdBreak() || this.isContentResuming()) {
      videojs.log.warn('Unexpected nopreroll event (Preroll)');
    } else {
      this.noPreroll();
    }
  }

  resumeAfterNoPreroll(player) {
    // eslint-disable-next-line no-console
    console.log('**** contentResuming instead of direct transition');
    // Resume to content and unblock play as there is no preroll ad
    this.contentResuming = true;
    player.ads._shouldBlockPlay = false;
    player.play();
  }

  /*
   * Cleanup timeouts and spinner.
   */
  cleanup() {
    const player = this.player;

    if (!player.ads._hasThereBeenALoadStartDuringPlayerLife) {
      videojs.log.warn('Leaving Preroll state before loadstart event can cause issues.');
    }

    player.removeClass('vjs-ad-loading');
    player.clearTimeout(this._timeout);
  }

}
