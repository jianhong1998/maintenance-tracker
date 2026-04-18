# Requirements for expiry date

## Description

When there is expiry date in a card, there is no information shows that there are how many days before expiry.

Look at the sample card info at @docs/raw-requirements/002-ui-redesign/004-expiry-date/screenshots/screenshot-002.png .
Look at the page `http://localhost:3000/vehicles/:vehicleId` screenshot at @docs/raw-requirements/002-ui-redesign/004-expiry-date/screenshots/screenshot-001.png .

## Expectation

- If the card is NOT expired, then the user should be able to see there are how many days before expired.
- If the card is due today, then the user should be able to see `Due today` or something to remind him/her the card is expired today.
- If the card is over due, then the user should be able to see overdue how many days.

## Colour constraints

- Should display the card and the `remaining days` words as warning colour when the remaining days are equal or less than the thredshold in @.env.template (environment variable name `NOTIFICATION_DAYS_BEFORE`)
  - Note that this environment variable is only available in backend. Should pass it to frontend UI via the `/config` endpoint.
- Should display the card and the `remaining days` words as error colour when it is overdue.
