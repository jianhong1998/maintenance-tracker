export interface IAppConfigResDTO {
  mileageWarningThresholdKm: number;
  notificationDaysBefore: number;
}

/** Fallback mileage-warning threshold (km) when app config is unavailable. */
export const DEFAULT_MILEAGE_WARNING_THRESHOLD_KM = 500;

/** Fallback days-before-expiry threshold when app config is unavailable. */
export const DEFAULT_NOTIFICATION_DAYS_BEFORE = 7;
