import React from 'react';

interface ClockBannerProps {
  currentTimestamp: string;
  currentTickIndex: number;
  totalTicks: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrevTick: () => void;
  onNextTick: () => void;
  onSliderChange: (index: number) => void;
  onJumpIncident: (timestamp: string) => void;
}

const PRESET_INCIDENTS = [
  { value: '2015-09-06T06:00:00', label: 'Machine 5 (Comp1 breakdown at 06:00)' },
  { value: '2015-09-15T06:00:00', label: 'Machine 9 (Comp1 breakdown at 06:00)' },
  { value: '2015-09-21T06:00:00', label: 'Machine 7 (Comp4 breakdown at 06:00)' },
  { value: '2015-10-06T06:00:00', label: 'Machine 5 (Comp2 breakdown at 06:00)' },
  { value: '2015-10-18T06:00:00', label: 'Machine 8 (Comp4 breakdown at 06:00)' },
];

export const ClockBanner: React.FC<ClockBannerProps> = ({
  currentTimestamp,
  currentTickIndex,
  totalTicks,
  isPlaying,
  onTogglePlay,
  onPrevTick,
  onNextTick,
  onSliderChange,
  onJumpIncident,
}) => {
  return (
    <section className="clock-banner">
      <div className="clock-container">
        {/* Time Display */}
        <div className="clock-time-display">
          <div className="pulse-indicator"></div>
          <div>
            <div className="clock-digits" id="clockTimestamp">
              {currentTimestamp.replace('T', ' ')}
            </div>
            <div className="clock-subtext">Live Stream Replay Horizon (Held-out Test Split)</div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="playback-controls">
          <button
            className="ctrl-btn"
            id="btnPrevTick"
            title="Step Back 3 Hours"
            onClick={onPrevTick}
            disabled={currentTickIndex <= 0}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            -3h
          </button>

          <button
            className={`ctrl-btn play-btn ${isPlaying ? 'playing' : ''}`}
            id="btnPlayPause"
            title="Play / Pause Replay"
            onClick={onTogglePlay}
          >
            <span id="playIcon">{isPlaying ? '⏸ Pause' : '▶ Play'}</span>
          </button>

          <button
            className="ctrl-btn"
            id="btnNextTick"
            title="Step Forward 3 Hours"
            onClick={onNextTick}
            disabled={currentTickIndex >= totalTicks - 1}
          >
            +3h
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Scrubber Slider */}
        <div className="timeline-slider-wrap">
          <input
            type="range"
            id="timeSlider"
            className="time-slider"
            min={0}
            max={Math.max(totalTicks - 1, 0)}
            value={currentTickIndex}
            onChange={(e) => onSliderChange(parseInt(e.target.value, 10))}
          />
          <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }} id="sliderTickLabel">
            Tick: {totalTicks > 0 ? currentTickIndex + 1 : 0}/{totalTicks}
          </span>
        </div>

        {/* Quick Failure Event Selector for Judges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Jump to Incident:</span>
          <select
            id="jumpFailureSelect"
            className="jump-select"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onJumpIncident(e.target.value);
                e.target.value = '';
              }
            }}
          >
            <option value="">Select Failure Demo...</option>
            {PRESET_INCIDENTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
};
