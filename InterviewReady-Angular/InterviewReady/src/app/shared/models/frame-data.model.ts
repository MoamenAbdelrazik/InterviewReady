/**
 * Raw webcam frame data produced by the proctoring engine (face-api.js).
 * LOCAL ONLY — never sent to backend directly.
 * Aggregated into BehaviorData (session → windows → per-question).
 */
export interface FrameData {
  frame:         number;
  timestamp:     number;
  cameraCovered: boolean;
  faceDetected:  boolean;

  headPose: {
    yaw:   number;
    pitch: number;
    roll:  number;
  };

  eyesOpen: boolean;

  looking: {
    isLookingSide: boolean;
    isLookingDown: boolean;
    isLookingUp:   boolean;
  };

  expressions: {
    neutral:   number;
    happy:     number;
    sad:       number;
    angry:     number;
    fearful:   number;
    disgusted: number;
    surprised: number;
  };

  statusFlags: {
    faceMissing:   boolean;
    suspiciousYaw: boolean;
    eyesClosed:    boolean;
  };
}
