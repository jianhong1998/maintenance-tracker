# Daily mileage prompt refactoring

## Problem statement

Realised that the current design for daily mileage prompt is to stored the state in frontend local storage.

This design bring an issue: when user switches device or browse with incognito mode, it will reprompt the user to update the vehicle mileage again.

## Potential solution

Use database to store the mileage last update date in `vehicle` entity, name it `mileage_last_updated_at`.
Then modify the response payload of endpoint `GET /vehicle/:vehicleId` to add `mileageLastUpdatedAt`.
The frontend component should based on the `mileageLastUpdatedAt` date to decide if prompting user to update the mileage.

## Note

- Should only prompt user when the date is more than 1 nature day (regardless of time)
  - For example, user updated the mileage at 2024-04-01T23:59:59+08 . When user open app at 2024-04-02T00:00:00+08 , it should prompt user to update the mileage again.
