/** Honeywell/Resideo system mode. "EmergencyHeat" only applies to heat pumps. */
export type ResideoMode = "Heat" | "Cool" | "Auto" | "Off" | "EmergencyHeat";

export type ResideoFanMode = "Auto" | "On" | "Circulate";

export interface ResideoThermostat {
  /** Resideo's device id, e.g. "LCC-<mac>" (T-Series) or "TCC-..." (Round/Lyric). */
  deviceId: string;
  locationId: number;
  name: string;
  model: string;
  macId: string;
  units: "Fahrenheit" | "Celsius";
  indoorTemperature: number;
  indoorHumidity: number | null;
  outdoorTemperature: number | null;
  mode: ResideoMode;
  allowedModes: ResideoMode[];
  heatSetpoint: number;
  coolSetpoint: number;
  minSetpoint: number;
  maxSetpoint: number;
  fanMode: ResideoFanMode;
  allowedFanModes: ResideoFanMode[];
  /** "NoHold" = following schedule, "Hold"/"TemporaryHold"/"PermanentHold" = manual override. */
  setpointStatus: string;
  isAlive: boolean;
  online: boolean;
  lastSeen: string;
}

export interface ResideoStateChange {
  mode?: ResideoMode;
  heatSetpoint?: number;
  coolSetpoint?: number;
  fanMode?: ResideoFanMode;
  /** Clears a temporary hold and resumes the schedule. */
  resumeSchedule?: boolean;
}

export interface ResideoDiscoveryResult {
  connected: boolean;
  devices: ResideoThermostat[];
  fetchedAt: string;
  durationMs: number;
}

export interface ResideoStatus {
  connected: boolean;
  /** Present only when connected, so the UI can show which account this is. */
  expiresAt?: string;
}
