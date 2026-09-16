// Small pockets of pure client-side state (see CLAUDE.md) — Alpine.js components
// for the sheet auto-scroll control and the hidden-video YouTube audio toggle.

function autoScroll() {
  return {
    playing: false,
    speed: 0.6,
    _rafId: null,
    _lastTs: null,
    _basePxPerSec: 32,

    toggle() {
      this.playing ? this.stop() : this.start();
    },

    start() {
      this.playing = true;
      this._lastTs = null;
      const step = (ts) => {
        if (!this.playing) return;
        if (this._lastTs != null) {
          const dt = (ts - this._lastTs) / 1000;
          window.scrollBy(0, this._basePxPerSec * this.speed * dt);
        }
        this._lastTs = ts;
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
        if (atBottom) {
          this.stop();
          return;
        }
        this._rafId = requestAnimationFrame(step);
      };
      this._rafId = requestAnimationFrame(step);
    },

    stop() {
      this.playing = false;
      if (this._rafId) cancelAnimationFrame(this._rafId);
      this._rafId = null;
    },

    inc() {
      this.speed = Math.min(3, Math.round((this.speed + 0.1) * 10) / 10);
    },

    dec() {
      this.speed = Math.max(0.1, Math.round((this.speed - 0.1) * 10) / 10);
    },
  };
}

function youtubeAudio(videoId) {
  return {
    playing: false,
    player: null,

    init() {
      const host = this.$refs.ytHost;
      const create = () => {
        this.player = new YT.Player(host, {
          videoId,
          height: "1",
          width: "1",
          playerVars: { playsinline: 1, controls: 0 },
          events: {
            onStateChange: (e) => {
              this.playing = e.data === YT.PlayerState.PLAYING;
            },
          },
        });
      };
      if (window.YT && window.YT.Player) {
        create();
      } else {
        window.__jamseshYtCallbacks = window.__jamseshYtCallbacks || [];
        window.__jamseshYtCallbacks.push(create);
      }
    },

    toggle() {
      if (!this.player) return;
      if (this.playing) this.player.pauseVideo();
      else this.player.playVideo();
    },
  };
}

window.onYouTubeIframeAPIReady = function () {
  (window.__jamseshYtCallbacks || []).forEach((fn) => fn());
  window.__jamseshYtCallbacks = [];
};
