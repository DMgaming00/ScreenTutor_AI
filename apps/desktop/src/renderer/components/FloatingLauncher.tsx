import TutorCursorIcon from './TutorCursorIcon';
import './FloatingLauncher.css';

interface Props {
  state: 'idle' | 'listening' | 'thinking' | 'responding' | 'pointing' | 'error' | 'privacy';
  isExpanded: boolean;
  onToggle: () => void;
  isRecordingVoice: boolean;
  isSpeaking: boolean;
}

export default function FloatingLauncher({
  state,
  isExpanded,
  onToggle,
  isRecordingVoice,
  isSpeaking,
}: Props) {
  const getTooltip = () => {
    if (isExpanded) return 'Minimize ScreenTutor';
    switch (state) {
      case 'listening': return 'Listening...';
      case 'thinking': return 'ScreenTutor is thinking...';
      case 'pointing': return 'Pointing at target...';
      case 'responding': return 'Speaking response...';
      case 'error': return 'An error occurred';
      case 'privacy': return 'Privacy mode active';
      default: return 'Open ScreenTutor (Ctrl+Shift+E)';
    }
  };

  return (
    <div className="floating-launcher no-drag">
      <button
        type="button"
        className={`launcher-btn state-${state} ${isExpanded ? 'expanded' : ''} ${isRecordingVoice ? 'recording' : ''} ${isSpeaking ? 'speaking' : ''}`}
        onClick={() => {
          window.electronAPI.setIgnoreMouseEvents(false);
          onToggle();
        }}
        title={getTooltip()}
        aria-label={getTooltip()}
      >
        <TutorCursorIcon size={isExpanded ? 24 : 30} className="launcher-cursor-icon" />
        {(state === 'thinking' || state === 'listening' || isSpeaking) && (
          <span className="launcher-activity-ring" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
