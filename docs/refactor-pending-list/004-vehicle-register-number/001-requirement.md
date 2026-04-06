# Requirement

As a vehicle owner, I will prefer to use my vehicle number to recognize my vehicle instead of using the brand and model.

If I choose to put the vehicle registration number, I want it to replace the brand and model position displayed on UI.

## More Details

### Home Page

Refer to screenshot @docs/refactor-pending-list/004-vehicle-register-number/screenshot-home-page.png

I want to see my vehicle registration number `FBA1234Z` replace the vehicle model `Honda ADV 160`.

Example:

```
FBA1234Z        --> This replaced the original `Honda ADV 160`
Honda ADV 160   --> This should be the same style with `Black`
Black
100 km
```

### Vehicle Dashboard

Refer to screenshot @docs/refactor-pending-list/004-vehicle-register-number/screenshot-vehicle-dashboard.png

I want to see my vehicle registration number `FBA1234Z` replace the word `Honda ADV 160`.

Then the brand and model name `Honda ADV 160` move down to above the `Black 100 km`

Example:

```
FBA1234Z        --> This replace the original `Honda ADV 160`
Honda ADV 160   --> This should be the same style with `Black - 100 km`
Black - 100 km
```

### Add vehicle modal

Refer to screenshot @docs/refactor-pending-list/004-vehicle-register-number/screenshot-add-vehicle-form.png

The add vehicle modal should have `Vehicle Registration Number` above the `BRAND` and `MODEL`.

Example:

```
Add Vehicle

Vehicle Registration Number (0/15) --> This is optional.
( e.g. SBC1234Z                  )

BRAND *           MODEL *
( e.g. Toyota )   ( e.g. Corolla )

...Other fields

```

## Constraints

- Vehicle registration number should be stored as string (varchar) with max 15 alphanumerics.
- Vehicle registration number can be nullable. As user can choose not to record his / her vehicle number in the app.
  - If vehicle registration number is not recorded, the UI display should fallback to the previous behaviour.
